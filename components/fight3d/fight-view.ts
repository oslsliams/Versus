// VERSUS live fights: Three.js view. Loads the Blender-built arena and the MakeHuman
// fighters (Mixamo motion capture), drives animation from the fight engine state and
// renders with a broadcast-style camera, spotlights, haze and bloom.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {distance, type Fighter, type FightEvent, type LiveFight, type MoveId, type Target} from '../../lib/fight3d/engine';
import {Stadium} from './stadium';
import {applyLook, loadLookAssets, patchShorts, type LookAssets} from './look';
import {WalkoutDirector} from './walkout-scene';
import {REFEREE_LOOK, type Look} from '../../lib/cosmetics';

const PLAT = .9;           // mat height in the arena model
const X_SCALE = .82;       // engine metres -> arena metres along the fight line
const FPS = 30;

// clip segments measured from the Mixamo files (frames at 30 fps)
const SEGMENTS: Record<string, {clip: string; from: number; to: number; speed: number}> = {
  jab: {clip: 'combo', from: 15, to: 36, speed: 1.9},
  cross: {clip: 'combo', from: 49, to: 70, speed: 1.6},
  hook: {clip: 'combo', from: 69, to: 88, speed: 1.6},
  elbow: {clip: 'combo', from: 83, to: 104, speed: 1.3},
  kick_high: {clip: 'kick_high', from: 5, to: 45, speed: 1.35},
  kick_feint: {clip: 'kick_feint', from: 14, to: 46, speed: 1.35},
  kick_lead: {clip: 'kick_lead', from: 5, to: 34, speed: 1.3},
  // Mixamo punch captures (retargeted in Blender). Each cut starts 6 frames before the measured impact frame,
  // so at x1.1 the fist lands ~0.18 s in, matching the engine's hit timing.
  jab_a: {clip: 'punching2', from: 12, to: 30, speed: 1.1},     // single lead straight (impact f18)
  jab_b: {clip: 'combo_punch', from: 6, to: 17, speed: 1.1},    // first of a double jab (f12)
  jab_c: {clip: 'punch_combo', from: 14, to: 25, speed: 1.1},   // jab opening the 1-2 (f20)
  jab_d: {clip: 'combo_punch', from: 45, to: 57, speed: 1.1},   // lead to the chest (f51)
  cross_a: {clip: 'punching', from: 6, to: 24, speed: 1.1},     // rear straight (f12)
  cross_b: {clip: 'punch_combo', from: 21, to: 34, speed: 1.1}, // cross off the jab (f27)
  cross_c: {clip: 'combo_punch', from: 24, to: 37, speed: 1.1}, // cross (f30)
  cross_d: {clip: 'cross_punch', from: 27, to: 52, speed: 1.5}, // loaded power cross with the wind-up (f36)
  cross_e: {clip: 'combo_punch', from: 52, to: 65, speed: 1.1}, // rear to the chest (f58)
};
// Move library: each engine move picks from several real animations by range and combo position.
// 'u:' = upper-body only (legs keep their stance and footwork underneath); others are full-body.
type Pick = {anim: string; range: 'close' | 'mid' | 'long' | 'any'; weight: number; body?: boolean; leg?: boolean};
const MOVE_ANIMS: Record<MoveId, Pick[]> = {
  // punches: Mixamo motion capture only (the user's punch clips); hooks/elbows come from the Mixamo combo clip
  jab: [{anim: 'jab_a', range: 'any', weight: 3}, {anim: 'jab_b', range: 'any', weight: 2.5}, {anim: 'jab_c', range: 'any', weight: 2.5},
        {anim: 'jab_d', range: 'close', weight: 1.5, body: true}, {anim: 'jab', range: 'mid', weight: 1}],
  cross: [{anim: 'cross_a', range: 'any', weight: 3}, {anim: 'cross_b', range: 'any', weight: 2.5}, {anim: 'cross_c', range: 'any', weight: 2.5},
          {anim: 'cross_d', range: 'mid', weight: 1.5}, {anim: 'cross_e', range: 'close', weight: 1.5, body: true}, {anim: 'hook', range: 'close', weight: 1.2}],
  upper: [{anim: 'elbow', range: 'any', weight: 2.5}, {anim: 'u:lead_elbow', range: 'close', weight: 1.2},
          {anim: 'u:rear_uppercut', range: 'close', weight: 1}, {anim: 'u:lead_uppercut', range: 'close', weight: 1}],
  // kicks: Mixamo motion capture only (the hand-keyed kicks looked stiff); the clinch knee stays for close range
  kick: [{anim: 'kick_high', range: 'any', weight: 2}, {anim: 'kick_lead', range: 'any', weight: 2, body: true},
         {anim: 'kick_feint', range: 'any', weight: 1.2, leg: true}, {anim: 'rear_knee', range: 'close', weight: 1, body: true}],
};
const ONE_SHOT = ['jab_head', 'jab_body', 'cross_head', 'cross_body', 'lead_hook', 'lead_body_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut', 'overhand', 'lead_elbow', 'superman',
  'rear_low_kick', 'calf_kick', 'body_kick', 'teep', 'rear_knee', 'slip_out', 'slip_in', 'roll', 'block_high', 'block_body', 'check',
  'hit_head', 'hit_head_l', 'hit_head_r', 'hit_body', 'hit_leg', 'stagger', 'victory', 'ground_back', 'knocked', 'shoot', 'sprawl'];
const UPPER_ONLY = ['jab_head', 'cross_head', 'lead_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut', 'lead_elbow', 'block_high', 'hit_head', 'hit_head_l', 'hit_head_r', 'idle'];
const isUpperTrack = (t: THREE.KeyframeTrack) => /(Spine|Neck|Head|Shoulder|Arm|Hand)/.test(t.name.split('.')[0]);
function pickMove(m: MoveId, dist: number, combo: number, target: Target): Pick {
  const range = dist < 1.12 ? 'close' : dist > 1.4 ? 'long' : 'mid';
  // the animation has to match where the strike is aimed (head kick, body kick, leg kick, body punch)
  const fits = (p: Pick) => m === 'kick' ? (target === 'head' ? p.anim === 'kick_high' : target === 'legs' ? !!p.leg : !!p.body)
    : m === 'upper' ? true : target === 'body' ? !!p.body : !p.body;
  const pool = MOVE_ANIMS[m].filter(fits);
  const opts = (pool.length ? pool : MOVE_ANIMS[m]).map(p => ({p, w: p.weight * (p.range === 'any' || p.range === range ? 1 : .15) * (combo > 0 && /hook|body|upper/.test(p.anim) ? 1.6 : 1)}));
  let r = Math.random() * opts.reduce((a, o) => a + o.w, 0);
  for (const o of opts) { r -= o.w; if (r <= 0) return o.p; }
  return opts[0].p;
}

type Src = {scene: THREE.Group; clips: THREE.AnimationClip[]};
type Assets = {arena: THREE.Group; red: Src; blue: Src; crowd: number[] | null; looks?: [Look | undefined, Look | undefined]; dress?: [LookAssets | undefined, LookAssets | undefined];
  /** the referee: a third body (never one of the fighters') in the all-black officials' kit */
  ref?: Src; refLook?: Look; refDress?: LookAssets;
  /** a body for the walkout crews (cornermen in team shirts) */
  crew?: Src};
// original MakeHuman fighter bodies built by scripts/art/build_fighter_mh.py
export {FIGHTER_MODELS, modelFor, type FighterModel} from '../../lib/fight3d/tape';
import type {FighterModel} from '../../lib/fight3d/tape';
const loads = new Map<string, Promise<{scene: THREE.Group; animations: THREE.AnimationClip[]}>>();
const loader = new GLTFLoader();
function loadGlb(url: string, onProgress: (p: number) => void) {
  let p = loads.get(url);
  if (!p) {
    p = new Promise((res, rej) => loader.load(url, res, e => { if (e.total) onProgress(Math.min(.99, e.loaded / e.total)); }, rej));
    p.catch(() => loads.delete(url)); loads.set(url, p);
  }
  return p.then(g => { onProgress(1); return g; });
}
/** a look's extras: tattoo masks and (if any gear is worn) the gear meshes fitted to that body */
export async function loadDress(look: Look | undefined): Promise<LookAssets | undefined> {
  if (!look) return undefined;
  const [la, gear] = await Promise.all([loadLookAssets(look), look.gear.length ? loadGlb(`/cosmetics/gear-${look.model}.glb`, () => {}).catch(() => null) : Promise.resolve(null)]);
  return {...la, gear: gear as any};
}
export function loadFightAssets(red: FighterModel, blue: FighterModel, onProgress?: (p: number) => void, looks?: [Look | undefined, Look | undefined]): Promise<Assets> {
  const pool = (['delacroix', 'takeda', 'volkov', 'okafor', 'bianchi', 'mwangi', 'ashford', 'kalani'] as FighterModel[]).filter(m => m !== red && m !== blue);
  const refModel = pool[0], crewModel = pool[1];
  const refLook = REFEREE_LOOK(refModel);
  const urls = ['/models/arena.glb', `/models/fighter-${red}.glb`, `/models/fighter-${blue}.glb`, `/models/fighter-${refModel}.glb`, `/models/fighter-${crewModel}.glb`];
  const done = [0, 0, 0, 0, 0];
  const report = () => onProgress?.(done.reduce((a, b) => a + b, 0) / 5);
  const crowd = fetch('/models/arena-crowd.json').then(r => r.ok ? r.json() as Promise<{seats?: number[]}> : null).then(j => j?.seats ?? null).catch(() => null);
  const dress = Promise.all([loadDress(looks?.[0]), loadDress(looks?.[1]), loadDress(refLook)]);
  return Promise.all([...urls.map((u, i) => loadGlb(u, p => { done[i] = p; report(); }).catch(e => { if (i >= 3) return null; throw e; })), crowd, dress])
    .then(([a, r, b, rf, cw, c, d]) => ({
      crew: cw ? {scene: (cw as any).scene, clips: (cw as any).animations} : undefined,arena: (a as any).scene, red: {scene: (r as any).scene, clips: (r as any).animations}, blue: {scene: (b as any).scene, clips: (b as any).animations}, crowd: c as number[] | null,
      looks, dress: [(d as any)[0], (d as any)[1]] as [LookAssets | undefined, LookAssets | undefined],
      ref: rf ? {scene: (rf as any).scene, clips: (rf as any).animations} : undefined, refLook, refDress: (d as any)[2] as LookAssets | undefined}));
}
export {loadGlb};

function inPlace(clip: THREE.AnimationClip) {
  const c = clip.clone();
  for (const t of c.tracks) {
    if (t.name.endsWith('Hips.position')) {
      const v = t.values; const x0 = v[0], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
  }
  return c;
}

const _p = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion();
/** rotate a bone (in world space) so the segment from it to its child points along dir */
function aimBone(bone: THREE.Bone, child: THREE.Object3D, dir: THREE.Vector3, amt = 1) {
  bone.getWorldPosition(_p); child.getWorldPosition(_c);
  const cur = _c.sub(_p).normalize();
  _q.setFromUnitVectors(cur, dir.clone().normalize());
  _qa.identity().slerp(_q, amt);
  bone.getWorldQuaternion(_wq);
  const parent = bone.parent!; parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_qa.multiply(_wq)));
  bone.updateMatrixWorld(true);
}

export class FighterRig {
  root = new THREE.Group(); body: THREE.Object3D; mixer: THREE.AnimationMixer; walkout: THREE.Object3D[] = []; wobble = 0;
  rest = new Map<string, THREE.Quaternion>();
  actions = new Map<string, THREE.AnimationAction>(); current: THREE.AnimationAction | null = null; currentKey = '';
  // layered playback: legs run 'idle' underneath while the upper body plays strikes/blocks/reactions
  lower: THREE.AnimationAction | null = null; upperCur: THREE.AnimationAction | null = null; upperKey = ''; split = true;
  // legs layer: the stance loop, or in-place step loops while the fighter moves (lead foot first forward, rear foot first back)
  lowers = new Map<string, THREE.AnimationAction>(); lowerKey = 'idle'; prevX: number | null = null; prevZ: number | null = null; stepRate = 1;
  bones: Record<string, THREE.Bone | undefined> = {};
  flash = 0; skinMats: THREE.MeshStandardMaterial[] = [];
  lastPick: Pick | null = null; lastState = ''; lastMove: MoveId | null = null;
  /** react to a landed strike, choosing the reaction from what hit us */
  hit(power: number, by: Pick | null, target?: Target) {
    if (['down', 'ko', 'bottom', 'top'].includes(this.lastState)) return;
    if (power > 1.1) this.play('stagger', .05);
    else if (target === 'legs' || (!target && by?.leg)) this.play('hit_leg', .05);
    else if (target === 'body' || (!target && by?.body)) this.play('hit_body', .05);
    else this.playUpper(['hit_head', 'hit_head_l', 'hit_head_r'][Math.floor(Math.random() * 3)], .04);
  }
  dodge() { if (['idle', 'walk'].includes(this.lastState)) this.play(['slip_out', 'slip_in', 'roll'][Math.floor(Math.random() * 3)], .06); }
  blocked(by: Pick | null) { if (by?.leg) this.play('check', .05); else if (by?.body) this.play('block_body', .05); else this.playUpper('block_high', .05); }
  constructor(src: Src, look?: Look, dress?: LookAssets) {
    this.body = cloneSkinned(src.scene);
    this.body.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
        if (/^Icosphere/.test(m.name)) m.visible = false;
        const clone = (x: THREE.Material) => {
          const c = x.clone() as THREE.MeshStandardMaterial;
          if (/body|skin/i.test(c.name)) this.skinMats.push(c);
          // eyebrows, lashes, hair cards and eyes ship with alpha: render them as cut-outs, not blended
          if (c.transparent || c.alphaMap || (c.map && /brow|lash|hair|high-poly|eye/i.test(c.name))) { c.transparent = false; c.alphaTest = .5; c.depthWrite = true; }
          return c;
        };
        m.material = Array.isArray(m.material) ? m.material.map(clone) : clone(m.material);
      }
      const b = o as THREE.Bone;
      if (b.isBone) this.bones[b.name.replace(/^mixamorig:?/, '')] = b;
    });
    // the bind pose: upright and facing forward (the walk rebuilds the torso from it)
    for (const [n, b] of Object.entries(this.bones)) if (b) this.rest.set(n, b.quaternion.clone());
    // kit colours, tattoos and gear (chain / bandana only for the walkout)
    try { this.walkout = applyLook(this.body, look, dress); } catch { this.walkout = []; }
    try { patchShorts(this.body); } catch { /* cosmetic fix only */ }
    this.root.add(this.body);
    // same-size fighters: MakeHuman's ethnicity blend changes height (1.64-1.88 m), so normalise every
    // body to ~1.80 m from its bind-pose head height, keeping a hint (±1.5%) of natural difference
    this.body.updateMatrixWorld(true);
    const headY = this.bones.Head ? this.bones.Head.getWorldPosition(new THREE.Vector3()).y : 0;
    if (headY > 1) this.body.scale.multiplyScalar(Math.pow(1.6 / headY, .88));
    this.mixer = new THREE.AnimationMixer(this.body);
    const byName = new Map(src.clips.map(c => [c.name, inPlace(c)]));
    for (const loop of ['idle', 'idle_box', 'ground_top']) {
      const c = byName.get(loop); if (!c) continue;
      const a = this.mixer.clipAction(c); a.setLoop(THREE.LoopRepeat, Infinity); this.actions.set(loop, a);
    }
    for (const [key, seg] of Object.entries(SEGMENTS)) {
      const c = byName.get(seg.clip); if (!c) continue;
      const sub = THREE.AnimationUtils.subclip(c, key, seg.from, seg.to, FPS);
      const a = this.mixer.clipAction(sub); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = seg.speed;
      this.actions.set(key, a);
    }
    for (const name of ONE_SHOT) {
      const c = byName.get(name); if (!c) continue;
      const a = this.mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; this.actions.set(name, a);
    }
    // split versions: upper-body-only strikes/reactions, and a lower-body-only idle that keeps the stance alive
    for (const name of UPPER_ONLY) {
      const c = byName.get(name); if (!c) continue;
      const up = new THREE.AnimationClip('u:' + name, c.duration, c.tracks.filter(isUpperTrack));
      const a = this.mixer.clipAction(up);
      if (name === 'idle') a.setLoop(THREE.LoopRepeat, Infinity); else { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions.set('u:' + name, a);
    }
    for (const name of ['idle', 'step_fwd', 'step_back']) {
      const c = byName.get(name); if (!c) continue;
      const a = this.mixer.clipAction(new THREE.AnimationClip('lower:' + name, c.duration, c.tracks.filter(t => !isUpperTrack(t))));
      a.setLoop(THREE.LoopRepeat, Infinity); this.lowers.set(name, a);
    }
    this.lower = this.lowers.get('idle') ?? null;
    this.toSplit(0);
    this.mixer.update(Math.random() * 2);
  }
  /** procedural pose on top of the animation: point an arm's upper arm and forearm along world directions
   *  (amt 0..1 blends from the animated pose). Used for the referee's stance and the hand raise. */
  poseArm(side: 'Left' | 'Right', upper: THREE.Vector3, fore: THREE.Vector3, amt = 1) {
    const ua = this.bones[side + 'Arm'], fa = this.bones[side + 'ForeArm'], hd = this.bones[side + 'Hand'];
    if (!ua || !fa || !hd || amt <= 0) return;
    aimBone(ua, fa, upper, amt); aimBone(fa, hd, fore, amt);
  }
  /** Walking, built on top of whatever the mixer played (there's no walk capture, only fighting-stance footwork):
   *  torso back to upright, thighs swing from the hip, knees fold on the swing-through, arms swing against the legs.
   *  mv 0..1 = how much he's moving (0 = standing tall, arms loose). Feet are kept on the floor by liftToFloor(). */
  walkPose(phase: number, mv: number, armsLoose = true) {
    const {fwd, left, up} = this.axes(), down = up.clone().negate();
    for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']) { const b = this.bones[n], r = this.rest.get(n); if (b && r) b.quaternion.copy(r); }
    this.body.updateMatrixWorld(true);
    const along = (a: number, base: THREE.Vector3) => base.clone().multiplyScalar(Math.cos(a)).addScaledVector(fwd, Math.sin(a));
    for (const [s, sg, off] of [['Left', 1, 0], ['Right', -1, Math.PI]] as const) {
      const ph = phase + off;
      const a = Math.sin(ph) * .36 * mv, bend = .08 + .72 * Math.pow(Math.max(0, Math.cos(ph)), 1.5) * mv;
      const ul = this.bones[s + 'UpLeg'], lg = this.bones[s + 'Leg'], ft = this.bones[s + 'Foot'], toe = this.bones[s + 'ToeBase'];
      if (ul && lg && ft) { aimBone(ul, lg, along(a, down).addScaledVector(left, sg * .05), 1); aimBone(lg, ft, along(a - bend, down), 1); }
      if (ft && toe) aimBone(ft, toe, fwd.clone().multiplyScalar(.9).addScaledVector(down, .35 + Math.max(0, -Math.sin(ph)) * .25 * mv), 1);
      if (armsLoose) { const b = -Math.sin(ph) * .3 * mv; this.poseArm(s, along(b, down).addScaledVector(left, sg * .17), along(b + .35, down).addScaledVector(left, sg * .04)); }
    }
  }
  private lift = 0;
  /** raise or lower the whole body so the lower foot sits on the floor at groundY (smoothed) */
  liftToFloor(groundY: number, dt: number) {
    const lf = this.bones.LeftFoot, rf = this.bones.RightFoot; if (!lf || !rf) return;
    this.root.updateMatrixWorld(true);
    const footRel = Math.min(lf.getWorldPosition(_p).y, rf.getWorldPosition(_c).y) - this.root.position.y;
    this.lift += (.085 - footRel - this.lift) * Math.min(1, dt * 14);
    this.root.position.y = groundY + this.lift;
    this.root.updateMatrixWorld(true);
  }
  /** the character's own axes in the world (model forward is +z, his left is +x) */
  axes() { const y = this.root.rotation.y; const fwd = new THREE.Vector3(Math.sin(y), 0, Math.cos(y)); return {fwd, left: new THREE.Vector3(0, 1, 0).cross(fwd), up: new THREE.Vector3(0, 1, 0)}; }
  /** whole-body action (kicks, knees, shots, slips, ground game) */
  play(key: string, fade = .12) {
    const next = this.actions.get(key); if (!next) return;
    if (!this.split && this.currentKey === key && next.isRunning()) return;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    if (this.split) { this.lower?.fadeOut(fade); this.upperCur?.fadeOut(fade); next.fadeIn(fade); this.split = false; this.upperCur = null; this.upperKey = ''; }
    else if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false); else next.fadeIn(fade);
    next.play(); this.current = next; this.currentKey = key;
  }
  /** back to layered mode: legs on the stance loop, upper body on 'key' */
  private toSplit(fade: number) {
    if (this.split && this.upperCur) return;
    this.current?.fadeOut(fade); this.current = null; this.currentKey = '';
    if (this.lower) { this.lower.reset(); this.lower.enabled = true; this.lower.setEffectiveWeight(1); this.lower.fadeIn(fade); this.lower.play(); }
    this.split = true; this.upperCur = null; this.upperKey = '';
    this.playUpper('u:idle', fade);
  }
  playUpper(key: string, fade = .1) {
    const k = key.startsWith('u:') ? key : 'u:' + key;
    const next = this.actions.get(k); if (!next) return;
    if (!this.split) { this.toSplit(fade); }
    if (this.upperKey === k && next.isRunning() && k === 'u:idle') return;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    if (this.upperCur && this.upperCur !== next) next.crossFadeFrom(this.upperCur, fade, false); else next.fadeIn(fade);
    next.play(); this.upperCur = next; this.upperKey = k;
  }
  private settle(fade: number) { if (this.split) this.playUpper('u:idle', fade); else this.toSplit(fade); }
  /** swap the legs loop (stance <-> stepping) with a short blend so the feet never pop */
  private setLower(key: string, fade = .14) {
    const next = this.lowers.get(key); if (!next || key === this.lowerKey) return;
    this.lowerKey = key;
    if (!this.split) { this.lower = next; return; }
    next.reset(); next.enabled = true; next.setEffectiveWeight(1); next.play();
    if (this.lower && this.lower !== next) next.crossFadeFrom(this.lower, fade, false); else next.fadeIn(fade);
    this.lower = next;
  }
  sync(f: Fighter, opp: Fighter, dt: number) {
    const st = f.state;
    if (st === 'attack' && (this.lastState !== 'attack' || this.lastMove !== f.move || f.t < .02)) {
      const pick = pickMove(f.move!, distance(f, opp), f.combo, f.target);
      this.lastPick = pick;
      const key = pick.anim;
      if (this.actions.has(key)) { if (key.startsWith('u:')) this.playUpper(key, .05); else this.play(key, .06); }
      else this.play(MOVE_ANIMS[f.move!].find(p => this.actions.has(p.anim))?.anim ?? 'jab', .06);
    } else if (st !== 'attack' && st !== this.lastState) {
      const full: Partial<Record<string, [string, number]>> = {
        win: ['victory', .3], down: ['knocked', .25], ko: ['knocked', .2], bottom: ['ground_back', .3],
        top: ['ground_top', .3], shoot: ['shoot', .1], sprawl: ['sprawl', .12], sprawled: ['shoot', .2],
      };
      const hit = full[st];
      if (hit) this.play(this.actions.has(hit[0]) ? hit[0] : 'idle', hit[1]);
      else if (st === 'block') this.playUpper('block_high', .08);
      else if (st === 'stun') { /* the reaction was already chosen from the landed strike */ }
      else this.settle(st === 'getup' ? .45 : .18);
    }
    // a finished one-shot (strike, slip, reaction) settles back into the stance
    if (st === 'idle' || st === 'walk') {
      const done = (a: THREE.AnimationAction | null) => !!a && a.getClip().duration - a.time < .02;
      if ((!this.split && done(this.current)) || (this.split && this.upperKey !== 'u:idle' && done(this.upperCur))) this.settle(.15);
    }
    // footwork: pick the step loop from which way we're actually moving, and match its rate to the speed
    const dx = this.prevX === null ? 0 : f.x - this.prevX, dz = this.prevZ === null ? 0 : f.z - this.prevZ; this.prevX = f.x; this.prevZ = f.z;
    const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    if (st === 'walk' && speed > .15) {
      // stepping in (or circling) leads with the front foot; backing off leads with the rear foot
      this.setLower(dx * f.hx + dz * f.hz >= -.3 * Math.hypot(dx, dz) ? 'step_fwd' : 'step_back');
      this.stepRate += (THREE.MathUtils.clamp(speed / 1.4, .75, 1.7) - this.stepRate) * Math.min(1, dt * 8);
      this.lower!.timeScale = this.stepRate;
    } else if (st !== 'walk' || speed < .05) {
      this.setLower('idle', .2); if (this.lower) this.lower.timeScale = 1;
    }
    this.lastState = st; this.lastMove = f.move;
    this.mixer.timeScale = st === 'top' ? 1.6 : 1;
    this.mixer.update(dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    // the damage shows: skin reddens and bruises as his ceiling drops; a hit flashes
    const worn = THREE.MathUtils.clamp((100 - f.cap) / 75, 0, 1);
    for (const m of this.skinMats) { m.emissive?.setRGB(this.flash * .5, this.flash * .05, this.flash * .05); m.color.setRGB(1, 1 - worn * .2, 1 - worn * .24); }
    // rocked: the legs go and he sways
    this.wobble += ((f.rocked > 0 && !['down', 'ko', 'top', 'bottom'].includes(st) ? Math.min(1, f.rocked / 1.5) : 0) - this.wobble) * Math.min(1, dt * 6);
  }
}

export class FightView {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(40, 1, .05, 200);
  composer: EffectComposer; bloom: UnrealBloomPass;
  rigs: [FighterRig, FighterRig]; sparks: {mesh: THREE.Mesh; life: number; v: THREE.Vector3}[] = [];
  shake = 0; time = 0; camX = 0; camZ = 0; camDist = 3.6; camDir = new THREE.Vector2(0, 1); private disposed = false;
  /** the player's screen axes on the floor (world xz): WASD moves along these */
  axes = {rx: 1, rz: 0, fx: 0, fz: -1};
  cage: {mesh: THREE.Object3D; x: number; z: number}[] = [];
  /** the walkout (locker room -> tunnel -> cage), run before the first bell; null once it's over */
  director: WalkoutDirector | null = null;
  assets: Assets;
  stadium: Stadium; private introAmt = 1;
  /** the referee: moves like a fighter (same rig and step loops) but is driven here, not by the engine */
  ref: FighterRig | null = null;
  private refF = {state: 'idle', move: null, t: 0, x: 0, z: 0, hx: 0, hz: 1, cap: 100, rocked: 0, combo: 0, target: 'head'} as unknown as Fighter;
  debugCam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('fightcam') : null;

  constructor(canvas: HTMLCanvasElement, g: LiveFight, assets: Assets) {
    this.assets = assets;
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .82;
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; this.scene.environmentIntensity = .35;
    this.scene.background = new THREE.Color('#060a16');
    this.scene.fog = new THREE.FogExp2('#081227', .014);   // light haze: the far stands stay visible

    const arena = assets.arena.clone(true);
    arena.updateMatrixWorld(true);
    arena.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.receiveShadow = true;
      const name = `${m.name} ${m.parent?.name ?? ''}`.toLowerCase();
      if (/post|rail|skirt|fence|txt/.test(name)) {
        m.geometry.computeBoundingBox(); const c = new THREE.Vector3(); m.geometry.boundingBox!.getCenter(c); m.localToWorld(c);
        if (c.y > PLAT - .2 && Math.hypot(c.x, c.z) > 2.5) this.cage.push({mesh: m, x: c.x, z: c.z}); // hidden on the camera's side each frame
      }
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && /fence/.test(mat.name)) { mat.alphaTest = .5; mat.transparent = false; mat.side = THREE.DoubleSide; }
      if (mat && /crowd/.test(mat.name)) { mat.color.multiplyScalar(.16); mat.roughness = 1; }
      if (mat && /canvas/.test(mat.name)) mat.color.multiplyScalar(.86);
      if (mat && /seat|floor|apron/.test(mat.name)) mat.color.multiplyScalar(.6);
    });
    this.scene.add(arena);
    this.buildLights();
    const lowSpec = typeof navigator !== 'undefined' && ((navigator.hardwareConcurrency ?? 8) <= 4 || /Mobi|Android/i.test(navigator.userAgent));
    this.stadium = new Stadium(this.scene, arena, assets.crowd, [g.f[0].name, g.f[1].name], lowSpec);

    this.rigs = [new FighterRig(assets.red, assets.looks?.[0], assets.dress?.[0]), new FighterRig(assets.blue, assets.looks?.[1], assets.dress?.[1])];
    this.rigs.forEach(r => this.scene.add(r.root));
    if (assets.ref) {
      try { this.ref = new FighterRig(assets.ref, assets.refLook, assets.refDress); this.scene.add(this.ref.root); this.ref.root.position.set(0, PLAT, 0); }
      catch { this.ref = null; }
    }
    const sparkGeo = new THREE.SphereGeometry(.025, 6, 4);
    for (let i = 0; i < 48; i++) { const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({color: '#fff3c4', transparent: true, depthWrite: false})); mesh.visible = false; this.scene.add(mesh); this.sparks.push({mesh, life: 0, v: new THREE.Vector3()}); }

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .45, .4, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.render(g, 0);
  }

  private buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#9fb4ff', '#0d1018', .22));
    const target = new THREE.Object3D(); target.position.set(0, PLAT, 0); s.add(target);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const sp = new THREE.SpotLight('#fff4e8', 42, 24, .42, .55, 2);
      sp.position.set(Math.cos(a) * 4.2, PLAT + 8, Math.sin(a) * 4.2); sp.target = target;
      if (i < 2) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -.0004; sp.shadow.normalBias = .02; }
      s.add(sp);
      const len = sp.position.distanceTo(target.position);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, len, 32, 1, true), new THREE.MeshBasicMaterial({color: '#b9c9ff', transparent: true, opacity: .012, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide}));
      cone.position.copy(sp.position).add(target.position).multiplyScalar(.5);
      cone.lookAt(target.position); cone.rotateX(Math.PI / 2); s.add(cone);
    }
    const front = new THREE.DirectionalLight('#dfe6ff', .55); front.position.set(0, PLAT + 3, 8); s.add(front);
    const rimR = new THREE.PointLight('#ff3a55', 14, 18, 2); rimR.position.set(6, PLAT + 2.5, -4); s.add(rimR);
    const rimB = new THREE.PointLight('#2f6bff', 14, 18, 2); rimB.position.set(-6, PLAT + 2.5, -4); s.add(rimB);
    // house lights: red on one half of the bowl, blue on the other, like a big fight night
    for (const [c, x] of [['#ff2a3c', 1], ['#2a5cff', -1]] as const) { const l = new THREE.PointLight(c, 260, 60, 1.9); l.position.set(x * 24, 14, 0); s.add(l); }
    s.add(new THREE.AmbientLight('#20263a', .12));
  }

  /** Referee positioning (what real refs do): stay off the fighters' line on the far side from the camera,
   *  close enough to step in, never in the way; follow them to the ground; rush in on a knockdown or a stoppage. */
  updateRef(g: LiveFight, dt: number) {
    const ref = this.ref; if (!ref) return;
    const [a, b] = g.f;
    const ax = a.x * X_SCALE, az = a.z * X_SCALE, bx = b.x * X_SCALE, bz = b.z * X_SCALE;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let lx = bx - ax, lz = bz - az; const ll = Math.hypot(lx, lz) || 1; lx /= ll; lz /= ll;
    // the side of the fight line away from the camera (camDir points from the action toward the camera)
    let px = -lz, pz = lx; if (px * this.camDir.x + pz * this.camDir.y > 0) { px = -px; pz = -pz; }
    const grounded = a.state === 'top' || a.state === 'bottom';
    const down = g.f.find(f => f.state === 'down' || f.state === 'ko');
    let tx: number, tz: number, speed = 1.7;
    if (g.phase === 'intro' && g.round === 1 && g.phaseT < 2.6) { tx = 0; tz = 0; }           // centre of the cage for the instructions
    else if (down) {                                                                           // knockdown / stoppage: get in there
      const dx = down.x * X_SCALE, dz = down.z * X_SCALE, w = down === a ? b : a;
      const ux = w.x * X_SCALE - dx, uz = w.z * X_SCALE - dz, ul = Math.hypot(ux, uz) || 1;
      tx = dx + ux / ul * .55 + px * .35; tz = dz + uz / ul * .55 + pz * .35; speed = 3.2;
    } else if (g.phase === 'over') { tx = mx + px * .9; tz = mz + pz * .9; }
    else { const off = grounded ? 1.35 : 2.25; tx = mx + px * off + lx * .35; tz = mz + pz * off + lz * .35; }
    // stay inside the cage and out of the fighters' way
    const r = Math.hypot(tx, tz), lim = 4.2 * X_SCALE - .35; if (r > lim) { tx *= lim / r; tz *= lim / r; }
    const p = ref.root.position;
    for (const f of [a, b]) { const fx = f.x * X_SCALE, fz = f.z * X_SCALE, d = Math.hypot(tx - fx, tz - fz); if (d < .75 && !down) { tx = fx + (tx - fx) / (d || 1) * .75; tz = fz + (tz - fz) / (d || 1) * .75; } }
    const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
    const stepLen = Math.min(dist, speed * dt);
    const moving = dist > .12;
    if (moving) { p.x += dx / dist * stepLen; p.z += dz / dist * stepLen; }
    p.y = PLAT;
    // always watching the action
    const fx = (down ? down.x * X_SCALE : mx) - p.x, fz = (down ? down.z * X_SCALE : mz) - p.z, fl = Math.hypot(fx, fz) || 1;
    const rf = this.refF;
    rf.x = p.x / X_SCALE; rf.z = p.z / X_SCALE; rf.hx = fx / fl; rf.hz = fz / fl;
    const st = moving ? 'walk' : 'idle';
    if (rf.state !== st) { rf.state = st as Fighter['state']; rf.t = 0; } else rf.t += dt;
    let dy = Math.atan2(rf.hx, rf.hz) - ref.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    ref.root.rotation.y += dy * (1 - Math.exp(-8 * dt));
    ref.sync(rf, a, dt);
    if (!this.ceremonyOn) {
      // an official, not a fighter: hands low and loose in front, ready to step in (no guard)
      const {fwd, left, up} = ref.axes(), urgent = down ? .55 : 0;
      for (const [s, sg] of [['Left', 1], ['Right', -1]] as const) {
        ref.poseArm(s, up.clone().multiplyScalar(-.92).addScaledVector(fwd, .3 + urgent).addScaledVector(left, .16 * sg), up.clone().multiplyScalar(-.35 + urgent).addScaledVector(fwd, .9).addScaledVector(left, -.12 * sg));
      }
    }
  }
  /** set while the decision is read (change of camera and the hand raise) */
  ceremonyOn = false;

  makeRig(src: Src, look?: Look, dress?: LookAssets) { return new FighterRig(src, look, dress); }
  /** play the walkouts (sides in walking order); the fight loop waits until director.done */
  startWalkout(order: (0 | 1)[]) { if (!this.director) this.director = new WalkoutDirector(this, order); return this.director; }

  resize(w: number, h: number) { this.renderer.setSize(w, h, false); this.composer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  degrade() { this.stadium.degrade(); this.renderer.setPixelRatio(1); this.renderer.shadowMap.enabled = false; this.bloom.enabled = false; const c = this.renderer.domElement; this.resize(c.clientWidth, c.clientHeight); }

  events(evts: FightEvent[]) {
    for (const e of evts) {
      if (e.type === 'whiff' && Math.random() < .55) { this.rigs[e.side === 0 ? 1 : 0].dodge(); continue; }
      this.stadium.excite(e.type === 'ko' || e.type === 'tap' ? 1.6 : e.type === 'kd' ? 1 : e.type === 'hurt' ? .8 : e.type === 'td' ? .45 : e.type === 'sub' ? .5 : e.type === 'hit' ? Math.min(.35, e.power * .4) : 0);
      if (e.type === 'hurt') { const d = this.rigs[e.side === 0 ? 1 : 0]; d.flash = 1; d.play('stagger', .05); this.shake = Math.max(this.shake, .14); continue; }
      if (!['hit', 'block', 'ko', 'kd', 'td'].includes(e.type)) continue;
      const n = e.type === 'block' ? 5 : Math.min(16, 5 + Math.round(e.power * 7));
      this.burst(e.x * X_SCALE, e.z * X_SCALE, PLAT + (e.type === 'td' ? .3 : 1.5), n, e.type === 'block' ? '#9fc4ff' : e.type === 'ko' || e.type === 'kd' ? '#ffd27a' : '#fff3c4');
      this.shake = Math.max(this.shake, e.type === 'ko' ? .3 : e.type === 'kd' ? .18 : e.type === 'block' ? .02 : Math.min(.1, e.power * .07));
      const attacker = this.rigs[e.side], defender = this.rigs[e.side === 0 ? 1 : 0];
      if (e.type === 'hit') { defender.flash = Math.min(1, .5 + e.power * .5); defender.hit(e.power, attacker.lastPick, e.target); }
      else if (e.type === 'kd' || e.type === 'ko') defender.flash = 1;
      else if (e.type === 'block') this.rigs[e.side].blocked(this.rigs[e.side === 0 ? 1 : 0].lastPick);
    }
  }
  private burst(x: number, z: number, y: number, n: number, color: string) {
    let used = 0;
    for (const s of this.sparks) {
      if (s.life > 0) continue;
      s.life = .3; s.mesh.visible = true; s.mesh.position.set(x, y + (Math.random() - .5) * .15, z + (Math.random() - .5) * .2);
      (s.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      s.v.set((Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 3);
      if (++used >= n) break;
    }
  }

  render(g: LiveFight, dt: number) {
    if (this.disposed) return;
    this.time += dt;
    if (this.director && !this.director.done) { this.director.update(g, dt); this.stadium.update(dt, g, this.renderer, {intro: 0}); this.composer.render(dt); return; }
    if (this.director) { this.director.dispose(); this.director = null; this.time = 0; }
    g.f.forEach((f, i) => {
      const r = this.rigs[i];
      // on the ground the top fighter sits in close, hips between the bottom fighter's legs, chest over his chest
      const o = g.f[i === 0 ? 1 : 0];
      const ground = f.state === 'top' && o.state === 'bottom';
      const tx = ground ? (o.x - f.hx * .37) * X_SCALE : f.x * X_SCALE, tz = ground ? (o.z - f.hz * .37) * X_SCALE : f.z * X_SCALE;
      const k = 1 - Math.exp(-25 * dt);
      r.root.position.x += (tx - r.root.position.x) * k; r.root.position.z += (tz - r.root.position.z) * k; r.root.position.y = PLAT;
      // model forward is +z: yaw toward the fighter's heading (shortest way round)
      const yaw = Math.atan2(f.hx, f.hz);
      let dy = yaw - r.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.root.rotation.y += dy * (1 - Math.exp(-12 * dt));
      r.sync(f, o, dt);
      r.root.rotation.z = Math.sin(this.time * 5.3 + i) * .055 * r.wobble; r.root.rotation.x = Math.sin(this.time * 3.1 + i) * .03 * r.wobble;
      // walkout gear (chain, bandana) comes off before the first bell
      const walk = g.round === 1 && g.phase === 'intro';
      for (const w of r.walkout) w.visible = walk;
    });
    this.updateRef(g, dt);
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt; s.v.y -= 9 * dt; s.mesh.position.addScaledVector(s.v, dt);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / .3); s.mesh.scale.setScalar(.6 + s.life * 4);
      if (s.life <= 0) s.mesh.visible = false;
    }
    // broadcast camera: side-on to the fight line wherever they are in the octagon, low, inside the cage.
    // It keeps the side it's on (no jarring flips) and swings round smoothly as the fighters circle.
    const ax = g.f[0].x * X_SCALE, az = g.f[0].z * X_SCALE, bx = g.f[1].x * X_SCALE, bz = g.f[1].z * X_SCALE;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, gap = Math.hypot(bx - ax, bz - az);
    let lx = bx - ax, lz = bz - az; const ll = Math.hypot(lx, lz) || 1; lx /= ll; lz /= ll;
    let px = -lz, pz = lx; if (px * this.camDir.x + pz * this.camDir.y < 0) { px = -px; pz = -pz; }
    const kc = 1 - Math.exp(-2.2 * dt);
    this.camDir.x += (px - this.camDir.x) * kc; this.camDir.y += (pz - this.camDir.y) * kc; this.camDir.normalize();
    const narrow = this.camera.aspect < 1;
    this.camX += (mx - this.camX) * (1 - Math.exp(-3 * dt)); this.camZ += (mz - this.camZ) * (1 - Math.exp(-3 * dt));
    this.camDist += ((narrow ? 5.2 : 3.3) + gap * (narrow ? .9 : .55) - this.camDist) * (1 - Math.exp(-2.5 * dt));
    this.shake = Math.max(0, this.shake - dt * 1.2);
    const sx = (Math.random() - .5) * this.shake, sy = (Math.random() - .5) * this.shake;
    const cx = this.camX + this.camDir.x * this.camDist - this.camDir.y * .35, cz = this.camZ + this.camDir.y * this.camDist + this.camDir.x * .35;
    // screen axes for the controls: right = across the screen, forward = into the screen
    const fx = -this.camDir.x, fz = -this.camDir.y;
    this.axes = {rx: -fz, rz: fx, fx, fz};
    // open the cage on the camera's side
    const cl = Math.hypot(cx, cz) || 1;
    for (const p of this.cage) { const pl = Math.hypot(p.x, p.z); p.mesh.visible = (p.x * cx + p.z * cz) / (pl * cl) < .45 || cl < 2.2; }
    if (this.debugCam === 'board') { this.camera.position.set(3, PLAT + 6, 13); this.camera.lookAt(0, 17.5, 0); }
    else if (this.debugCam === 'board2') { this.camera.position.set(13, PLAT + 6, 3); this.camera.lookAt(0, 17.5, 0); }
    else if (this.debugCam === 'ribbon') { this.camera.position.set(0, PLAT + 3, 6); this.camera.lookAt(0, 10, -26); }
    else if (this.debugCam) { const h = this.debugCam === 'hand' ? this.rigs[0].bones.LeftHand : this.rigs[0].bones.Head; if (h) { const p = new THREE.Vector3(); h.getWorldPosition(p); const k = this.debugCam === 'hand' ? .55 : 1; this.camera.position.set(p.x + .5 * k, p.y + .05, p.z + .55 * k); this.camera.lookAt(p); } }
    else {
      this.camera.position.set(cx + sx, PLAT + 1.42 + sy, cz); this.camera.lookAt(this.camX, PLAT + 1.05, this.camZ);
      // opening shot before round 1: a crane move from high over the stands, round past the board, down into the cage
      const INTRO = 3.6, u = g.round === 1 ? this.time / INTRO : 1;
      if (u < 1) {
        const ease = (x: number) => x * x * (3 - 2 * x);
        const a = Math.atan2(this.camDir.y, this.camDir.x) - 2.2 * (1 - ease(u));
        const r = 19 - 14 * ease(u), h = 10.5 - 8 * ease(u);
        const crane = new THREE.Vector3(Math.cos(a) * r, PLAT + h, Math.sin(a) * r * .86);
        const k = ease(Math.max(0, (u - .55) / .45));
        this.camera.position.lerp(crane, 1 - k);
        const look = new THREE.Vector3(this.camX, PLAT + 1.05, this.camZ).lerp(new THREE.Vector3(0, PLAT + 4 * (1 - u), 0), 1 - k);
        this.camera.lookAt(look);
      }
      this.introAmt = Math.max(0, 1 - u);
    }
    this.stadium.update(dt, g, this.renderer, {intro: this.introAmt});
    this.composer.render(dt);
  }

  dispose() {
    this.disposed = true;
    for (const r of this.rigs) r.mixer.stopAllAction();
    this.ref?.mixer.stopAllAction();
    this.stadium.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose?.(); const mt = m.material; (Array.isArray(mt) ? mt : [mt]).forEach(x => x?.dispose?.()); } });
    this.composer.dispose(); this.renderer.dispose();
  }
}
