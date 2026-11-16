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
const MOVE_ANIMS: Record<MoveId, string[]> = {jab: ['jab'], cross: ['cross', 'hook'], kick: ['kick_high', 'kick_lead', 'kick_feint'], upper: ['elbow']};

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
  bones: Record<string, THREE.Bone | undefined> = {};
  stunT = 0; flash = 0; hitSide = 1; stagger = 0; skinMats: THREE.MeshStandardMaterial[] = [];
  hit(power: number) { this.stunT = Math.min(1, .55 + power * .5); this.hitSide = Math.random() < .5 ? -1 : 1; this.stagger = Math.min(1, power); }
  lastState = ''; lastMove: MoveId | null = null;
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
    for (const pose of ['ground_back', 'knocked', 'shoot', 'sprawl']) {
      const c = byName.get(pose); if (!c) continue;
      const a = this.mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; this.actions.set(pose, a);
    }
    this.play('idle', 0);
    this.mixer.update(Math.random() * 2);
  }
  play(key: string, fade = .12) {
    const next = this.actions.get(key); if (!next || (this.currentKey === key && next.isRunning())) return;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false); else next.fadeIn(fade);
    next.play(); this.current = next; this.currentKey = key;
  }
  sync(f: Fighter, dt: number) {
    const st = f.state;
    if (st === 'attack' && (this.lastState !== 'attack' || this.lastMove !== f.move)) {
      const opts = MOVE_ANIMS[f.move!]; this.play(opts[Math.floor(Math.random() * opts.length)], .06);
    } else if (st !== 'attack' && st !== this.lastState) {
      // every state maps to a real animation or an authored full-body pose (no procedural limb twisting)
      const map: Partial<Record<string, [string, number]>> = {
        block: ['idle_box', .1], win: ['idle_box', .3], down: ['knocked', .28], ko: ['knocked', .22], bottom: ['ground_back', .3],
        top: ['ground_top', .3], shoot: ['shoot', .14], sprawl: ['sprawl', .14], getup: ['idle', .45], stun: ['idle', .1],
      };
      const [key, fade] = map[st] ?? ['idle', st === 'idle' || st === 'walk' ? .2 : .12];
      this.play(this.actions.has(key) ? key : 'idle', fade);
    }
    this.lastState = st; this.lastMove = f.move;
    this.mixer.timeScale = st === 'walk' ? 1.35 : st === 'top' ? 1.6 : 1;
    this.mixer.update(dt);
    this.stunT = Math.max(0, this.stunT - dt * 3.2);
    const head = this.bones.Head, spine = this.bones.Spine2, neck = this.bones.Neck;
    // hit reaction: sharp snap that eases out, plus a sideways twist that varies per hit
    const snap = this.stunT * this.stunT;
    if (head && snap > 0) { head.rotateX(-.75 * snap); head.rotateY(this.hitSide * .5 * snap); head.rotateZ(this.hitSide * .25 * snap); }
    if (neck && snap > 0) neck.rotateX(-.3 * snap);
    if (spine && snap > 0) { spine.rotateX(-.35 * snap); spine.rotateY(this.hitSide * .2 * snap); }
    this.body.position.x = -this.stagger * .12;
    this.stagger = Math.max(0, this.stagger - dt * 3);
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
      if (!['hit', 'block', 'ko', 'kd', 'td'].includes(e.type)) continue;
      const n = e.type === 'block' ? 5 : Math.min(16, 5 + Math.round(e.power * 7));
      this.burst(e.x * X_SCALE, PLAT + (e.type === 'td' ? .3 : 1.5), n, e.type === 'block' ? '#9fc4ff' : e.type === 'ko' || e.type === 'kd' ? '#ffd27a' : '#fff3c4');
      this.shake = Math.max(this.shake, e.type === 'ko' ? .3 : e.type === 'kd' ? .18 : e.type === 'block' ? .02 : Math.min(.1, e.power * .07));
      if (e.type !== 'block' && e.type !== 'td') { const v = this.rigs[e.side === 0 ? 1 : 0]; v.flash = 1; v.hit(e.power); }
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
      r.sync(f, dt);
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
