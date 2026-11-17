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
import type {Fighter, FightEvent, LiveFight, MoveId} from '../../lib/fight3d/engine';

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
};
// Move library: each engine move picks from several real animations by range and combo position.
// 'u:' = upper-body only (legs keep their stance and footwork underneath); others are full-body.
type Pick = {anim: string; range: 'close' | 'mid' | 'long' | 'any'; weight: number; body?: boolean; leg?: boolean};
const MOVE_ANIMS: Record<MoveId, Pick[]> = {
  jab: [{anim: 'u:jab_head', range: 'any', weight: 4}, {anim: 'jab', range: 'mid', weight: 2}, {anim: 'jab_body', range: 'any', weight: 1.5, body: true}],
  cross: [{anim: 'u:cross_head', range: 'any', weight: 3}, {anim: 'cross', range: 'mid', weight: 2}, {anim: 'cross_body', range: 'close', weight: 1.5, body: true},
          {anim: 'u:rear_hook', range: 'close', weight: 2}, {anim: 'u:lead_hook', range: 'close', weight: 2}, {anim: 'hook', range: 'close', weight: 1.5},
          {anim: 'overhand', range: 'mid', weight: 1}, {anim: 'superman', range: 'long', weight: .6}],
  upper: [{anim: 'u:rear_uppercut', range: 'close', weight: 2}, {anim: 'u:lead_uppercut', range: 'close', weight: 2}, {anim: 'lead_body_hook', range: 'close', weight: 1.5, body: true},
          {anim: 'u:lead_elbow', range: 'close', weight: 1.2}, {anim: 'elbow', range: 'close', weight: 1}],
  kick: [{anim: 'rear_low_kick', range: 'any', weight: 2.5, leg: true}, {anim: 'calf_kick', range: 'any', weight: 2, leg: true}, {anim: 'body_kick', range: 'mid', weight: 2, body: true},
         {anim: 'teep', range: 'long', weight: 2, body: true}, {anim: 'kick_high', range: 'mid', weight: 1.4}, {anim: 'kick_lead', range: 'mid', weight: 1.2},
         {anim: 'kick_feint', range: 'mid', weight: .8}, {anim: 'rear_knee', range: 'close', weight: 2.5, body: true}],
};
const ONE_SHOT = ['jab_head', 'jab_body', 'cross_head', 'cross_body', 'lead_hook', 'lead_body_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut', 'overhand', 'lead_elbow', 'superman',
  'rear_low_kick', 'calf_kick', 'body_kick', 'teep', 'rear_knee', 'slip_out', 'slip_in', 'roll', 'block_high', 'block_body', 'check',
  'hit_head', 'hit_head_l', 'hit_head_r', 'hit_body', 'hit_leg', 'stagger', 'victory', 'ground_back', 'knocked', 'shoot', 'sprawl'];
const UPPER_ONLY = ['jab_head', 'cross_head', 'lead_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut', 'lead_elbow', 'block_high', 'hit_head', 'hit_head_l', 'hit_head_r', 'idle'];
const isUpperTrack = (t: THREE.KeyframeTrack) => /(Spine|Neck|Head|Shoulder|Arm|Hand)/.test(t.name.split('.')[0]);
function pickMove(m: MoveId, dist: number, combo: number): Pick {
  const range = dist < 1.12 ? 'close' : dist > 1.4 ? 'long' : 'mid';
  const opts = MOVE_ANIMS[m].map(p => ({p, w: p.weight * (p.range === 'any' || p.range === range ? 1 : .15) * (combo > 0 && /hook|body|upper/.test(p.anim) ? 1.6 : 1)}));
  let r = Math.random() * opts.reduce((a, o) => a + o.w, 0);
  for (const o of opts) { r -= o.w; if (r <= 0) return o.p; }
  return opts[0].p;
}

type Src = {scene: THREE.Group; clips: THREE.AnimationClip[]};
type Assets = {arena: THREE.Group; red: Src; blue: Src};
// original MakeHuman fighter bodies built by scripts/art/build_fighter_mh.py
export const FIGHTER_MODELS = ['okafor', 'volkov', 'takeda', 'ashford', 'kalani', 'bianchi', 'mwangi', 'delacroix'] as const;
export type FighterModel = typeof FIGHTER_MODELS[number];
/** Pick a body for any fighter name: roster fighters get their own, everyone else a stable pick. */
export function modelFor(name: string): FighterModel {
  const last = name.trim().split(/\s+/).pop()!.toLowerCase();
  const hit = FIGHTER_MODELS.find(m => m === last);
  if (hit) return hit;
  let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FIGHTER_MODELS[h % FIGHTER_MODELS.length];
}
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
export function loadFightAssets(red: FighterModel, blue: FighterModel, onProgress?: (p: number) => void): Promise<Assets> {
  const urls = ['/models/arena.glb', `/models/fighter-${red}.glb`, `/models/fighter-${blue}.glb`];
  const done = [0, 0, 0];
  const report = () => onProgress?.(done.reduce((a, b) => a + b, 0) / 3);
  return Promise.all(urls.map((u, i) => loadGlb(u, p => { done[i] = p; report(); })))
    .then(([a, r, b]) => ({arena: a.scene, red: {scene: r.scene, clips: r.animations}, blue: {scene: b.scene, clips: b.animations}}));
}

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

class FighterRig {
  root = new THREE.Group(); body: THREE.Object3D; mixer: THREE.AnimationMixer;
  actions = new Map<string, THREE.AnimationAction>(); current: THREE.AnimationAction | null = null; currentKey = '';
  // layered playback: legs run 'idle' underneath while the upper body plays strikes/blocks/reactions
  lower: THREE.AnimationAction | null = null; upperCur: THREE.AnimationAction | null = null; upperKey = ''; split = true;
  // legs layer: the stance loop, or in-place step loops while the fighter moves (lead foot first forward, rear foot first back)
  lowers = new Map<string, THREE.AnimationAction>(); lowerKey = 'idle'; prevX: number | null = null; stepRate = 1;
  bones: Record<string, THREE.Bone | undefined> = {};
  flash = 0; skinMats: THREE.MeshStandardMaterial[] = [];
  lastPick: Pick | null = null; lastState = ''; lastMove: MoveId | null = null;
  /** react to a landed strike, choosing the reaction from what hit us */
  hit(power: number, by: Pick | null) {
    if (['down', 'ko', 'bottom', 'top'].includes(this.lastState)) return;
    if (power > 1.1) this.play('stagger', .05);
    else if (by?.leg) this.play('hit_leg', .05);
    else if (by?.body) this.play('hit_body', .05);
    else this.playUpper(['hit_head', 'hit_head_l', 'hit_head_r'][Math.floor(Math.random() * 3)], .04);
  }
  dodge() { if (['idle', 'walk'].includes(this.lastState)) this.play(['slip_out', 'slip_in', 'roll'][Math.floor(Math.random() * 3)], .06); }
  blocked(by: Pick | null) { if (by?.leg) this.play('check', .05); else if (by?.body) this.play('block_body', .05); else this.playUpper('block_high', .05); }
  constructor(src: Src) {
    this.body = cloneSkinned(src.scene);
    this.body.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
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
      const pick = pickMove(f.move!, Math.abs(opp.x - f.x), f.combo);
      this.lastPick = pick;
      const key = pick.anim;
      if (this.actions.has(key)) { if (key.startsWith('u:')) this.playUpper(key, .05); else this.play(key, .06); }
      else this.play(MOVE_ANIMS[f.move!].find(p => this.actions.has(p.anim))?.anim ?? 'jab', .06);
    } else if (st !== 'attack' && st !== this.lastState) {
      const full: Partial<Record<string, [string, number]>> = {
        win: ['victory', .3], down: ['knocked', .25], ko: ['knocked', .2], bottom: ['ground_back', .3],
        top: ['ground_top', .3], shoot: ['shoot', .1], sprawl: ['sprawl', .12],
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
    const dx = this.prevX === null ? 0 : f.x - this.prevX; this.prevX = f.x;
    const speed = dt > 0 ? Math.abs(dx) / dt : 0;
    if (st === 'walk' && speed > .15) {
      this.setLower(dx * f.facing > 0 ? 'step_fwd' : 'step_back');
      this.stepRate += (THREE.MathUtils.clamp(speed / 1.4, .75, 1.7) - this.stepRate) * Math.min(1, dt * 8);
      this.lower!.timeScale = this.stepRate;
    } else if (st !== 'walk' || speed < .05) {
      this.setLower('idle', .2); if (this.lower) this.lower.timeScale = 1;
    }
    this.lastState = st; this.lastMove = f.move;
    this.mixer.timeScale = st === 'top' ? 1.6 : 1;
    this.mixer.update(dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    for (const m of this.skinMats) m.emissive?.setRGB(this.flash * .5, this.flash * .05, this.flash * .05);
  }
}

export class FightView {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(40, 1, .05, 200);
  composer: EffectComposer; bloom: UnrealBloomPass;
  rigs: [FighterRig, FighterRig]; sparks: {mesh: THREE.Mesh; life: number; v: THREE.Vector3}[] = [];
  shake = 0; time = 0; camX = 0; camDist = 3.6; private disposed = false;
  debugCam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('fightcam') : null;

  constructor(canvas: HTMLCanvasElement, g: LiveFight, assets: Assets) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .82;
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; this.scene.environmentIntensity = .35;
    this.scene.background = new THREE.Color('#060a16');
    this.scene.fog = new THREE.FogExp2('#081227', .05);

    const arena = assets.arena.clone(true);
    arena.updateMatrixWorld(true);
    arena.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.receiveShadow = true;
      const name = `${m.name} ${m.parent?.name ?? ''}`.toLowerCase();
      if (/post|rail|skirt|fence|txt/.test(name)) {
        m.geometry.computeBoundingBox(); const c = new THREE.Vector3(); m.geometry.boundingBox!.getCenter(c); m.localToWorld(c);
        if (c.z > 1.2 && c.y > PLAT - .2) m.visible = false; // open the camera side of the cage
      }
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && /fence/.test(mat.name)) { mat.alphaTest = .5; mat.transparent = false; mat.side = THREE.DoubleSide; }
      if (mat && /crowd/.test(mat.name)) { mat.color.multiplyScalar(.16); mat.roughness = 1; }
      if (mat && /canvas/.test(mat.name)) mat.color.multiplyScalar(.86);
      if (mat && /seat|floor|apron/.test(mat.name)) mat.color.multiplyScalar(.6);
    });
    this.scene.add(arena);
    this.buildLights();

    this.rigs = [new FighterRig(assets.red), new FighterRig(assets.blue)];
    this.rigs.forEach(r => this.scene.add(r.root));
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
  }

  resize(w: number, h: number) { this.renderer.setSize(w, h, false); this.composer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  degrade() { this.renderer.setPixelRatio(1); this.renderer.shadowMap.enabled = false; this.bloom.enabled = false; const c = this.renderer.domElement; this.resize(c.clientWidth, c.clientHeight); }

  events(evts: FightEvent[]) {
    for (const e of evts) {
      if (e.type === 'whiff' && Math.random() < .55) { this.rigs[e.side === 0 ? 1 : 0].dodge(); continue; }
      if (!['hit', 'block', 'ko', 'kd', 'td'].includes(e.type)) continue;
      const n = e.type === 'block' ? 5 : Math.min(16, 5 + Math.round(e.power * 7));
      this.burst(e.x * X_SCALE, PLAT + (e.type === 'td' ? .3 : 1.5), n, e.type === 'block' ? '#9fc4ff' : e.type === 'ko' || e.type === 'kd' ? '#ffd27a' : '#fff3c4');
      this.shake = Math.max(this.shake, e.type === 'ko' ? .3 : e.type === 'kd' ? .18 : e.type === 'block' ? .02 : Math.min(.1, e.power * .07));
      const attacker = this.rigs[e.side], defender = this.rigs[e.side === 0 ? 1 : 0];
      if (e.type === 'hit') { defender.flash = 1; defender.hit(e.power, attacker.lastPick); }
      else if (e.type === 'kd' || e.type === 'ko') defender.flash = 1;
      else if (e.type === 'block') this.rigs[e.side].blocked(this.rigs[e.side === 0 ? 1 : 0].lastPick);
    }
  }
  private burst(x: number, y: number, n: number, color: string) {
    let used = 0;
    for (const s of this.sparks) {
      if (s.life > 0) continue;
      s.life = .3; s.mesh.visible = true; s.mesh.position.set(x, y + (Math.random() - .5) * .15, (Math.random() - .5) * .2);
      (s.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      s.v.set((Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 3);
      if (++used >= n) break;
    }
  }

  render(g: LiveFight, dt: number) {
    if (this.disposed) return;
    this.time += dt;
    g.f.forEach((f, i) => {
      const r = this.rigs[i];
      r.root.position.x += (f.x * X_SCALE - r.root.position.x) * (1 - Math.exp(-25 * dt));
      r.root.position.y = PLAT; r.root.position.z = i === 0 ? .08 : -.08;
      const face = f.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
      r.root.rotation.y += (face - r.root.rotation.y) * (1 - Math.exp(-10 * dt));
      r.sync(f, g.f[i === 0 ? 1 : 0], dt);
    });
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt; s.v.y -= 9 * dt; s.mesh.position.addScaledVector(s.v, dt);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / .3); s.mesh.scale.setScalar(.6 + s.life * 4);
      if (s.life <= 0) s.mesh.visible = false;
    }
    // broadcast camera: inside the cage, low, slightly off-axis, following the action
    const a = g.f[0].x * X_SCALE, b = g.f[1].x * X_SCALE, mid = (a + b) / 2, gap = Math.abs(a - b);
    const narrow = this.camera.aspect < 1;
    this.camX += (mid - this.camX) * (1 - Math.exp(-3 * dt));
    this.camDist += ((narrow ? 5.2 : 3.3) + gap * (narrow ? .9 : .55) - this.camDist) * (1 - Math.exp(-2.5 * dt));
    this.shake = Math.max(0, this.shake - dt * 1.2);
    const sx = (Math.random() - .5) * this.shake, sy = (Math.random() - .5) * this.shake;
    if (this.debugCam) { const h = this.debugCam === 'hand' ? this.rigs[0].bones.LeftHand : this.rigs[0].bones.Head; if (h) { const p = new THREE.Vector3(); h.getWorldPosition(p); const k = this.debugCam === 'hand' ? .55 : 1; this.camera.position.set(p.x + .5 * k, p.y + .05, p.z + .55 * k); this.camera.lookAt(p); } }
    else { this.camera.position.set(this.camX + .35 + sx, PLAT + 1.42 + sy, this.camDist); this.camera.lookAt(this.camX, PLAT + 1.05, 0); }
    this.composer.render(dt);
  }

  dispose() {
    this.disposed = true;
    for (const r of this.rigs) r.mixer.stopAllAction();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose?.(); const mt = m.material; (Array.isArray(mt) ? mt : [mt]).forEach(x => x?.dispose?.()); } });
    this.composer.dispose(); this.renderer.dispose();
  }
}
