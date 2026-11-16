// VERSUS live fights: Three.js scene. Octagon cage + chunky stylized fighters
// built from primitives and animated with blended joint poses.
import * as THREE from 'three';
import {moveTiming, type Fighter, type FightEvent, type LiveFight} from '../../lib/fight3d/engine';

const JOINTS = ['spineX', 'spineY', 'headX', 'shLx', 'shLz', 'elL', 'shRx', 'shRz', 'elR', 'hipLx', 'knL', 'hipRx', 'knR', 'bodyY', 'bodyRx', 'bodyZ'] as const;
type Joint = typeof JOINTS[number];
type Pose = Record<Joint, number>;
const BASE: Pose = {spineX: .12, spineY: -.35, headX: -.08, shLx: -1.15, shLz: .25, elL: -1.75, shRx: -1.0, shRz: -.25, elR: -1.9, hipLx: -.32, knL: .38, hipRx: .34, knR: .42, bodyY: 0, bodyRx: 0, bodyZ: 0};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const SKINS = ['#f3cfae', '#e0aa84', '#c08a63', '#9a6a4c', '#ecc0a0', '#86583d'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function mat(color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({color, roughness: .45, clearcoat: .55, clearcoatRoughness: .25, ...opts});
}
function capsule(r: number, len: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m);
  mesh.castShadow = true;
  return mesh;
}

class FighterModel {
  root = new THREE.Group(); body = new THREE.Group(); spine = new THREE.Group(); head = new THREE.Group();
  shL = new THREE.Group(); elL = new THREE.Group(); shR = new THREE.Group(); elR = new THREE.Group();
  hipL = new THREE.Group(); knL = new THREE.Group(); hipR = new THREE.Group(); knR = new THREE.Group();
  pose: Pose = {...BASE};
  flash = 0;
  skinMat: THREE.MeshPhysicalMaterial;
  constructor(f: Fighter) {
    const h = hash(f.name);
    const skin = this.skinMat = mat(SKINS[h % SKINS.length], {clearcoat: .2, roughness: .6});
    const corner = mat(f.color, {clearcoat: .9});
    const dark = mat('#1b1838', {roughness: .7, clearcoat: 0});
    const white = mat('#f6f4ff', {clearcoat: .3});
    this.root.add(this.body);
    this.body.position.y = .98;
    // hips + shorts
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(.27, .3, .3, 18), corner); shorts.castShadow = true; this.body.add(shorts);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.275, .035, 8, 24), white); band.rotation.x = Math.PI / 2; band.position.y = .15; this.body.add(band);
    // spine + chest
    this.body.add(this.spine); this.spine.position.y = .14;
    const chest = capsule(.27, .3, skin); chest.position.y = .3; chest.scale.set(1.08, 1, .82); this.spine.add(chest);
    // head
    this.spine.add(this.head); this.head.position.y = .78;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.24, 24, 18), skin); skull.castShadow = true; this.head.add(skull);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.248, 24, 12, 0, Math.PI * 2, 0, Math.PI * (h % 3 === 0 ? .32 : .5)), dark); hair.rotation.x = -.25; this.head.add(hair);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.032, 10, 8), dark); eye.position.set(s * .085, .02, .215); this.head.add(eye); }
    const gum = new THREE.Mesh(new THREE.BoxGeometry(.12, .035, .04), corner); gum.position.set(0, -.1, .22); this.head.add(gum);
    // arms
    for (const [sh, el, side] of [[this.shL, this.elL, 1], [this.shR, this.elR, -1]] as const) {
      this.spine.add(sh); sh.position.set(side * .33, .54, 0);
      const upper = capsule(.085, .2, skin); upper.position.y = -.16; sh.add(upper);
      sh.add(el); el.position.y = -.32;
      const fore = capsule(.08, .16, skin); fore.position.y = -.13; el.add(fore);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(.14, 18, 14), corner); glove.scale.set(.92, 1.1, 1.05); glove.position.y = -.32; glove.castShadow = true; el.add(glove);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.085, .09, .07, 12), white); cuff.position.y = -.2; el.add(cuff);
    }
    // legs
    for (const [hp, kn, side] of [[this.hipL, this.knL, 1], [this.hipR, this.knR, -1]] as const) {
      this.body.add(hp); hp.position.set(side * .15, -.12, 0);
      const thigh = capsule(.12, .26, skin); thigh.position.y = -.22; hp.add(thigh);
      hp.add(kn); kn.position.y = -.44;
      const shin = capsule(.1, .24, skin); shin.position.y = -.2; kn.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(.15, .08, .26), skin); foot.position.set(0, -.42, .06); foot.castShadow = true; kn.add(foot);
    }
    this.root.scale.setScalar(1.12);
  }
  apply(p: Pose) {
    this.spine.rotation.set(p.spineX, p.spineY, 0); this.head.rotation.x = p.headX;
    this.shL.rotation.set(p.shLx, 0, p.shLz); this.elL.rotation.x = p.elL;
    this.shR.rotation.set(p.shRx, 0, p.shRz); this.elR.rotation.x = p.elR;
    this.hipL.rotation.x = p.hipLx; this.knL.rotation.x = p.knL; this.hipR.rotation.x = p.hipRx; this.knR.rotation.x = p.knR;
    this.body.position.y = .98 + p.bodyY; this.body.rotation.x = p.bodyRx; this.body.position.z = p.bodyZ;
  }
}

function targetPose(f: Fighter, time: number): {pose: Pose; rate: number} {
  const p: Pose = {...BASE};
  const bob = Math.sin(time * 6 + f.side * 2) * .03;
  p.bodyY = bob; p.spineX += bob * .5;
  let rate = 14;
  const ext = (t: number, start: number, active: number) => t < start ? t / start : t < start + active ? 1 : Math.max(0, 1 - (t - start - active) / .18);
  switch (f.state) {
    case 'walk': { const s = Math.sin(time * 11); p.hipLx += s * .35; p.hipRx -= s * .35; p.knL += Math.max(0, s) * .4; p.knR += Math.max(0, -s) * .4; break; }
    case 'attack': {
      rate = 32;
      const tm = moveTiming(f, f.move!); const e = ext(f.t, tm.start, tm.active);
      if (f.move === 'jab') { p.shLx = lerp(-1.15, -1.62, e); p.elL = lerp(-1.75, -.08, e); p.spineY = lerp(-.35, -.55, e); }
      if (f.move === 'cross') { p.shRx = lerp(-1.0, -1.62, e); p.elR = lerp(-1.9, -.06, e); p.shRz = lerp(-.25, .15, e); p.spineY = lerp(-.35, .45, e); p.hipRx += e * .15; }
      if (f.move === 'kick') { p.hipRx = lerp(.34, -1.5, e); p.knR = lerp(.42, .15, e); p.spineX = lerp(.12, -.35, e); p.spineY = lerp(-.35, .3, e); p.hipLx = lerp(-.32, .1, e); }
      if (f.move === 'upper') { p.shRx = lerp(-1.0, -2.3, e); p.elR = lerp(-1.9, -1.1, e); p.spineX = lerp(.12, -.15, e); p.bodyY -= e * .08; p.knL += e * .25; p.knR += e * .25; }
      break;
    }
    case 'block': p.shLx = -1.5; p.elL = -2.35; p.shRx = -1.5; p.elR = -2.35; p.shLz = .05; p.shRz = -.05; p.spineX = .3; p.headX = .25; break;
    case 'stun': p.spineX = -.4; p.headX = -.5; p.shLx = -.6; p.shRx = -.4; p.elL = -.9; p.elR = -.8; rate = 22; break;
    case 'shoot': { const k = Math.min(1, f.t / .2); p.spineX = lerp(.12, 1.15, k); p.bodyY -= k * .38; p.knL += k * .9; p.knR += k * 1.1; p.hipLx -= k * .4; p.shLx = -1.4; p.shRx = -1.4; p.elL = -.4; p.elR = -.4; rate = 26; break; }
    case 'sprawl': p.spineX = 1.0; p.bodyY = -.35; p.hipLx = .9; p.hipRx = 1.1; p.knL = .2; p.knR = .2; p.shLx = -1.2; p.shRx = -1.2; p.elL = -.3; p.elR = -.3; rate = 22; break;
    case 'down': case 'ko': p.bodyRx = -1.45; p.bodyY = -.7; p.bodyZ = -.4; p.shLx = -2.6; p.shRx = -2.8; p.elL = -.3; p.elR = -.5; p.hipLx = -.3; p.hipRx = .1; p.knL = .6; p.knR = .2; p.headX = .2; rate = f.state === 'ko' ? 6 : 10; break;
    case 'getup': p.spineX = .5; p.bodyY = -.3; p.knL = 1; p.knR = 1; break;
    case 'top': { const punch = Math.max(0, Math.sin(time * 14)); p.spineX = .95; p.bodyY = -.5; p.hipLx = -1.3; p.hipRx = -1.2; p.knL = 2.2; p.knR = 2.1; p.shRx = lerp(-.6, -2.0, punch * (f.sub > 0 ? 0 : 1)); p.elR = -.5; p.shLx = -1.2; p.elL = -.6; if (f.sub > 0) { p.shLx = -1.9; p.shRx = -1.9; p.elL = -1.2; p.elR = -1.2; p.spineX = 1.2; } rate = 18; break; }
    case 'bottom': p.bodyRx = -1.5; p.bodyY = -.72; p.bodyZ = -.3; p.hipLx = -1.4; p.hipRx = -1.1; p.knL = 1.4; p.knR = 1.5; p.shLx = -2.2; p.shRx = -2.1; p.elL = -1.6; p.elR = -1.5; rate = 14; break;
    case 'win': { const w = Math.sin(time * 5) * .15; p.shLx = -2.9 + w; p.shRx = -2.9 - w; p.elL = -.2; p.elR = -.2; p.shLz = .5; p.shRz = -.5; p.spineX = -.1; rate = 8; break; }
  }
  return {pose: p, rate};
}

export class FightView {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  models: [FighterModel, FighterModel]; sparks: {mesh: THREE.Mesh; life: number; v: THREE.Vector3}[] = [];
  shake = 0; time = 0; camX = 0; camZ = 9;
  private disposed = false;
  constructor(canvas: HTMLCanvasElement, g: LiveFight) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color('#07060f');
    this.scene.fog = new THREE.Fog('#07060f', 12, 26);
    this.buildArena();
    this.models = [new FighterModel(g.f[0]), new FighterModel(g.f[1])];
    for (const m of this.models) this.scene.add(m.root);
    const sparkGeo = new THREE.SphereGeometry(.05, 8, 6);
    for (let i = 0; i < 40; i++) { const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({color: '#fff5c2', transparent: true})); mesh.visible = false; this.scene.add(mesh); this.sparks.push({mesh, life: 0, v: new THREE.Vector3()}); }
  }

  private buildArena() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#c4bdf5', '#2a2350', 1.7));
    const front = new THREE.DirectionalLight('#ffffff', 1.3); front.position.set(0, 3, 10); s.add(front);
    const key = new THREE.DirectionalLight('#fff1e0', 2.8); key.position.set(2, 9, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left: -6, right: 6, top: 6, bottom: -6}); s.add(key);
    const rimL = new THREE.PointLight('#e58fb6', 18, 14); rimL.position.set(-5, 3.5, -3); s.add(rimL);
    const rimR = new THREE.PointLight('#86c4dc', 18, 14); rimR.position.set(5, 3.5, -3); s.add(rimR);
    // floor with painted canvas
    const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d')!;
    x.fillStyle = '#231e45'; x.fillRect(0, 0, 1024, 1024);
    x.strokeStyle = '#bfe36b'; x.lineWidth = 10; x.beginPath(); x.arc(512, 512, 170, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = '#ffffff22'; x.lineWidth = 4; x.beginPath(); x.arc(512, 512, 420, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#bfe36b'; x.font = '900 120px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('VERSUS', 512, 512);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6.2, 8), new THREE.MeshStandardMaterial({map: tex, roughness: .55}));
    floor.rotation.x = -Math.PI / 2; floor.rotation.z = Math.PI / 8; floor.receiveShadow = true; s.add(floor);
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.9, .5, 8), new THREE.MeshStandardMaterial({color: '#151230', roughness: .7}));
    apron.position.y = -.26; apron.rotation.y = Math.PI / 8; s.add(apron);
    // fence: posts, pads, rails, net (back half only so the camera sees in)
    const postMat = mat('#f6f4ff'); const padMat = mat('#e58fb6', {clearcoat: .8});
    const netMat = new THREE.LineBasicMaterial({color: '#6f6aa8', transparent: true, opacity: .45});
    const R = 6.2, H = 2.3;
    const pts = Array.from({length: 8}, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R); });
    pts.forEach(p => {
      if (p.z > 1) return; // no posts between the camera and the fighters
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, H, 12), postMat); post.position.set(p.x, H / 2, p.z); s.add(post);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), padMat); pad.position.set(p.x, H + .05, p.z); s.add(pad);
    });
    for (let i = 0; i < 8; i++) {
      const a = pts[i], b = pts[(i + 1) % 8];
      const mid = a.clone().add(b).multiplyScalar(.5);
      if (mid.z > 1) continue; // keep the camera side open
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, a.distanceTo(b), 10), padMat);
      rail.position.set(mid.x, H, mid.z); rail.lookAt(b.x, H, b.z); rail.rotateX(Math.PI / 2); s.add(rail);
      const verts: number[] = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12; const p = a.clone().lerp(b, t); verts.push(p.x, 0, p.z, p.x, H, p.z); }
      for (let k = 0; k <= 8; k++) { const y = (k / 8) * H; verts.push(a.x, y, a.z, b.x, y, b.z); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      s.add(new THREE.LineSegments(geo, netMat));
    }
    // crowd glow dots
    const crowd = new THREE.BufferGeometry(); const cv: number[] = [];
    for (let i = 0; i < 500; i++) { const a = Math.PI * (1 + Math.random()); const r = 9 + Math.random() * 6; cv.push(Math.cos(a) * r * 1.3, .5 + Math.random() * 4, Math.sin(a) * r - 2); }
    crowd.setAttribute('position', new THREE.Float32BufferAttribute(cv, 3));
    s.add(new THREE.Points(crowd, new THREE.PointsMaterial({color: '#968fd6', size: .06, transparent: true, opacity: .55})));
  }

  /** Lower the cost of each frame on slow devices: 1x pixel ratio, no shadows. */
  degrade() {
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = false;
    this.scene.traverse(o => { (o as THREE.Mesh).castShadow = false; });
    const c = this.renderer.domElement; this.resize(c.clientWidth, c.clientHeight);
  }

  resize(w: number, h: number) { this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  events(evts: FightEvent[]) {
    for (const e of evts) {
      if (e.type === 'hit' || e.type === 'block' || e.type === 'ko' || e.type === 'kd' || e.type === 'td') {
        const n = e.type === 'block' ? 4 : Math.min(14, 4 + Math.round(e.power * 6));
        const color = e.type === 'block' ? '#86c4dc' : e.type === 'ko' || e.type === 'kd' ? '#e9c873' : '#fff5c2';
        this.burst(e.x, e.type === 'td' ? .4 : 1.55, n, color);
        this.shake = Math.max(this.shake, e.type === 'ko' ? .35 : e.type === 'kd' ? .22 : e.type === 'block' ? .03 : Math.min(.12, e.power * .08));
        if (e.type === 'hit' || e.type === 'kd' || e.type === 'ko') { const victim = this.models[e.side === 0 ? 1 : 0]; victim.flash = 1; }
      }
    }
  }
  private burst(x: number, y: number, n: number, color: string) {
    let used = 0;
    for (const s of this.sparks) {
      if (s.life > 0) continue;
      s.life = .32; s.mesh.visible = true; s.mesh.position.set(x, y + (Math.random() - .5) * .2, .2);
      (s.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      s.v.set((Math.random() - .5) * 5, Math.random() * 4, (Math.random() - .2) * 3);
      if (++used >= n) break;
    }
  }

  render(g: LiveFight, dt: number) {
    if (this.disposed) return;
    this.time += dt;
    g.f.forEach((f, i) => {
      const m = this.models[i];
      const {pose, rate} = targetPose(f, this.time);
      const k = 1 - Math.exp(-rate * dt);
      for (const j of JOINTS) m.pose[j] = lerp(m.pose[j], pose[j], k);
      m.apply(m.pose);
      m.root.position.x = lerp(m.root.position.x, f.x, 1 - Math.exp(-30 * dt));
      const face = f.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
      m.root.rotation.y = lerp(m.root.rotation.y, face, 1 - Math.exp(-12 * dt));
      m.flash = Math.max(0, m.flash - dt * 5);
      m.skinMat.emissive.setRGB(m.flash * .6, m.flash * .1, m.flash * .1);
    });
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt; s.v.y -= 12 * dt; s.mesh.position.addScaledVector(s.v, dt);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / .32);
      s.mesh.scale.setScalar(.6 + s.life * 3);
      if (s.life <= 0) s.mesh.visible = false;
    }
    const mid = (g.f[0].x + g.f[1].x) / 2, gap = Math.abs(g.f[0].x - g.f[1].x);
    const narrow = this.camera.aspect < 1;
    this.camX = lerp(this.camX, mid, 1 - Math.exp(-4 * dt));
    this.camZ = lerp(this.camZ, (narrow ? 10.5 : 6.4) + gap * (narrow ? 1.3 : .7), 1 - Math.exp(-3 * dt));
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const sx = (Math.random() - .5) * this.shake, sy = (Math.random() - .5) * this.shake;
    this.camera.position.set(this.camX + sx, 1.85 + sy, this.camZ);
    this.camera.lookAt(this.camX, 1.1, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach(x => x.dispose()); else mt?.dispose?.(); });
    this.renderer.dispose();
  }
}
