// Fighter walkouts, played in the real 3D arena before the first bell, staged like a UFC broadcast:
//   the locker-room door opens and the fighter walks out with his crew (two cornermen in team shirts),
//   down the back corridor, out through the tunnel arch under a follow-spot, down the walkway between the
//   barriers to the cage. At the steps the cutman greases his face and the walkout shirt comes off, then he
//   climbs into the octagon and walks to his corner. The challenger walks first, the champion last.
// Camera: a handheld operator walking backwards in front of him, then a cage-side angle, then inside the cage.
// Fighters walk with a procedural gait (FighterRig.walkPose) since the motion library only has fight footwork.
import * as THREE from 'three';
import type {LiveFight, Fighter} from '../../lib/fight3d/engine';
import type {Look} from '../../lib/cosmetics';
import type {FightView, FighterRig} from './fight-view';

const PLAT = .9, X_SCALE = .82;
const TEAM = {red: '#8f1a26', blue: '#1d3f96'} as const;
const LED = {red: '#ff3347', blue: '#3a7bff'} as const;

type Seg = {a: THREE.Vector3; b: THREE.Vector3; len: number; s0: number};
type Path = {segs: Seg[]; len: number; at: (s: number) => {p: THREE.Vector3; dir: THREE.Vector3}; sAt: (i: number) => number};
function makePath(pts: THREE.Vector3[]): Path {
  const segs: Seg[] = []; let s = 0;
  for (let i = 0; i < pts.length - 1; i++) { const len = pts[i].distanceTo(pts[i + 1]); segs.push({a: pts[i], b: pts[i + 1], len, s0: s}); s += len; }
  const at = (q: number) => {
    const x = Math.max(0, Math.min(s, q));
    const g = segs.find(sg => x <= sg.s0 + sg.len) ?? segs[segs.length - 1];
    const u = g.len ? (x - g.s0) / g.len : 0;
    const dir = g.b.clone().sub(g.a); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
    return {p: g.a.clone().lerp(g.b, u), dir};
  };
  return {segs, len: s, at, sAt: i => i >= segs.length ? s : segs[i].s0};
}

type Person = {rig: FighterRig; pf: Fighter; phase: number; prev: THREE.Vector3 | null};
type Walker = {side: 0 | 1; corner: 'red' | 'blue'; cx: number; me: Person; crew: Person[]; path: Path; plan: {t: number; s: number}[]; total: number;
  mat?: THREE.MeshStandardMaterial; fightTex?: THREE.Texture | null; shirtTex?: THREE.Texture};

const pseudo = (): Fighter => ({state: 'idle', move: null, t: 0, x: 0, z: 0, hx: 0, hz: -1, cap: 100, rocked: 0, combo: 0, target: 'head'} as unknown as Fighter);
const DOOR_Z = 17, TUNNEL_Z = 12.9, STEPS_Z = 5.3, APRON_Z = 4.15, GATE_Z = 3.3;
const WALK = 1.6, CLIMB = .8, PAUSE = 2.4;   // m/s on the flat, m/s up the steps, seconds at the cage-side checks

export class WalkoutDirector {
  done = false; t = 0; who = 0;
  private group = new THREE.Group(); private spot: THREE.SpotLight; private spotTarget = new THREE.Object3D(); private rim: THREE.PointLight;
  private walkers: Walker[] = []; private ledMats: THREE.MeshStandardMaterial[] = []; private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3();
  private shot = ''; private houseLights: {l: THREE.Light; i: number}[] = [];

  constructor(private view: FightView, order: (0 | 1)[]) {
    this.buildSet();
    const S = view.scene;
    this.spot = new THREE.SpotLight('#fff1dd', 150, 45, .17, .55, 2); this.spot.position.set(0, 13, 9); this.spot.target = this.spotTarget;
    this.rim = new THREE.PointLight('#ffffff', 2, 5, 2);
    S.add(this.group, this.spot, this.spotTarget, this.rim);
    // house lights down for the walkouts
    S.traverse(o => { const l = o as THREE.Light; if (l.isLight && !(l as THREE.AmbientLight).isAmbientLight && !this.group.children.includes(l) && l !== this.spot && l !== this.rim) { this.houseLights.push({l, i: l.intensity}); l.intensity *= .45; } });
    const a = view.assets;
    for (const side of order) {
      const corner = side === 0 ? 'red' : 'blue', cx = (side === 0 ? -1.6 : 1.6) * X_SCALE;
      const pts = [new THREE.Vector3(0, 0, 18.6), new THREE.Vector3(0, 0, DOOR_Z - .2), new THREE.Vector3(0, 0, TUNNEL_Z), new THREE.Vector3(0, 0, STEPS_Z),
        new THREE.Vector3(0, PLAT, APRON_Z), new THREE.Vector3(0, PLAT, GATE_Z), new THREE.Vector3(cx * .55, PLAT, 1.5), new THREE.Vector3(cx, PLAT, .05)];
      const path = makePath(pts);
      // timeline: walk to the steps, stop for the checks, climb, walk to the corner, settle
      const plan: {t: number; s: number}[] = [{t: 0, s: 0}];
      const push = (dt: number, s: number) => plan.push({t: plan[plan.length - 1].t + dt, s});
      push(path.sAt(3) / WALK, path.sAt(3)); push(PAUSE, path.sAt(3));
      push((path.sAt(5) - path.sAt(3)) / CLIMB, path.sAt(5)); push((path.len - path.sAt(5)) / (WALK * .85), path.len); push(1.1, path.len);
      const crewLook = (model: string): Look => ({model: model as Look['model'], shorts: '#111216', trim: '#111216', gloves: '#202124', tattoos: [], gear: [],
        paint: [{id: 'ref_pants', color: '#17181d'}, {id: 'ref_shirt', color: TEAM[corner]}, {id: 'ref_shoes', color: '#0b0b0d'}]});
      const crew: Person[] = [];
      for (const src of [a.crew ?? a.ref, a.ref ?? a.crew]) {
        if (!src || !a.refDress) continue;
        try { const r = view.makeRig(src, crewLook('crew'), a.refDress); r.root.visible = false; S.add(r.root); crew.push({rig: r, pf: pseudo(), phase: Math.random() * 6, prev: null}); } catch { /* no crew then */ }
      }
      const rig = view.rigs[side];
      rig.showBelts(view.beltPlan.held[side]);   // the champion walks to the cage with his belt over his shoulder
      const w: Walker = {side, corner, cx, me: {rig, pf: pseudo(), phase: 0, prev: null}, crew, path, plan, total: plan[plan.length - 1].t};
      this.dressShirt(w);
      rig.root.visible = false;
      this.walkers.push(w);
    }
    this.camPos.set(0, 1.6, 15.2); this.camLook.set(0, 1.3, 18);
  }

  /** the walkout shirt: a team-coloured tee painted over the skin (comes off at the cage) */
  private dressShirt(w: Walker) {
    const d = this.view.assets.refDress, r = d?.manifest?.tattoos['ref_shirt'], m = d?.masks.get('ref_shirt');
    const mat = w.me.rig.skinMats.find(x => x.name === 'Human.body') ?? w.me.rig.skinMats[0];
    if (!mat?.map || !d?.manifest || !r || !m) return;
    const S = d.manifest.size, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d')!; ctx.drawImage(mat.map.image as CanvasImageSource, 0, 0, S, S);
    const t = document.createElement('canvas'); t.width = r.w; t.height = r.h; const tc = t.getContext('2d')!;
    tc.drawImage(m, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = TEAM[w.corner]; tc.fillRect(0, 0, r.w, r.h);
    ctx.drawImage(t, r.x, r.y);
    const tex = new THREE.CanvasTexture(cv); const old = mat.map;
    tex.flipY = old.flipY; tex.colorSpace = old.colorSpace; tex.wrapS = old.wrapS; tex.wrapT = old.wrapT;
    w.mat = mat; w.fightTex = old; w.shirtTex = tex; mat.map = tex; mat.needsUpdate = true;
  }
  private shirtOff(w: Walker) {
    if (w.mat && w.fightTex && w.mat.map !== w.fightTex) { w.mat.map = w.fightTex; w.mat.needsUpdate = true; }
    for (const o of w.me.rig.walkout) o.visible = false;
    w.me.rig.showBelts(0);   // he hands it to his team at the cage
  }

  /** the backstage set behind the arena's tunnel arch: locker room, door, corridor; plus barriers and cage steps */
  private buildSet() {
    const G = this.group;
    const mat = (c: string, rough = .85, emit?: string, ei = 0) => new THREE.MeshStandardMaterial({color: c, roughness: rough, emissive: emit ?? '#000', emissiveIntensity: ei});
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; G.add(b); return b; };
    const at = (l: THREE.PointLight, x: number, y: number, z: number) => { l.position.set(x, y, z); return l; };
    const wall = mat('#33353d'), floor = mat('#121317', .6), ceil = mat('#1b1c21'), lockerM = mat('#283247', .5), trim = mat('#0c0d10');
    // corridor from the tunnel arch to the locker room door
    const CZ0 = 12.4, CZ1 = DOOR_Z, CW = 1.65, CH = 3.0, mid = (CZ0 + CZ1) / 2, len = CZ1 - CZ0;
    box(.12, CH, len, -CW, CH / 2, mid, wall); box(.12, CH, len, CW, CH / 2, mid, wall); box(CW * 2, .1, len, 0, CH, mid, ceil); box(CW * 2, .02, len, 0, .01, mid, floor);
    for (let z = CZ0 + .7; z < CZ1; z += 1.35) box(.5, .03, .9, 0, CH - .06, z, mat('#ffffff', .4, '#fff6e6', 2.2));
    for (const x of [-CW + .08, CW - .08]) { const m = mat('#000', .4, LED.blue, 3); this.ledMats.push(m); box(.04, .04, len, x, .06, mid, m); }
    G.add(at(new THREE.PointLight('#fff2e0', 2.5, 7, 2), 0, 2.6, 14.2));
    G.add(at(new THREE.PointLight('#fff2e0', 2.5, 7, 2), 0, 2.6, 16.2));
    // signage
    const sign = (text: string, sub: string, w: number, h: number, x: number, y: number, z: number, ry: number) => {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * h / w); const c = cv.getContext('2d')!;
      c.fillStyle = '#0b0c10'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#c5f74f'; c.fillRect(0, cv.height - 14, cv.width, 14);
      c.fillStyle = '#fff'; c.font = `900 ${Math.round(cv.height * .42)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, cv.height * .42);
      c.fillStyle = '#9aa3b5'; c.font = `700 ${Math.round(cv.height * .16)}px system-ui, sans-serif`; c.fillText(sub, cv.width / 2, cv.height * .78);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: .7, roughness: .6}));
      m.position.set(x, y, z); m.rotation.y = ry; G.add(m);
    };
    sign('VERSUS', 'FIGHT NIGHT', 2.6, .9, -CW + .07, 1.9, 14.6, Math.PI / 2);
    sign('WALKOUT', 'STAY BEHIND THE LINE', 2.2, .75, CW - .07, 1.9, 15.4, -Math.PI / 2);
    sign('LOCKER ROOM', 'FIGHTERS & TEAMS ONLY', 1.7, .5, 0, 2.62, DOOR_Z - .07, Math.PI);
    // locker room: wall with a doorway, lockers, a bench, bright overhead light
    const RZ1 = DOOR_Z + 5, RW = 2.8, rmid = (DOOR_Z + RZ1) / 2;
    box(RW - .8, CH, .14, -(RW + .8) / 2, CH / 2, DOOR_Z, wall); box(RW - .8, CH, .14, (RW + .8) / 2, CH / 2, DOOR_Z, wall); box(1.6, CH - 2.35, .14, 0, 2.35 + (CH - 2.35) / 2, DOOR_Z, wall);
    box(.1, 2.35, .18, -.8, 1.175, DOOR_Z, trim); box(.1, 2.35, .18, .8, 1.175, DOOR_Z, trim);
    box(.12, CH, 5, -RW, CH / 2, rmid, wall); box(.12, CH, 5, RW, CH / 2, rmid, wall); box(RW * 2, CH, .12, 0, CH / 2, RZ1, wall);
    box(RW * 2, .1, 5, 0, CH, rmid, ceil); box(RW * 2, .02, 5, 0, .01, rmid, floor);
    for (let i = 0; i < 9; i++) { const x = -RW + .4 + i * .62; box(.56, 2.0, .5, x, 1.0, RZ1 - .32, lockerM); box(.06, .2, .02, x + .18, 1.2, RZ1 - .58, mat('#9aa3b5', .3)); }
    box(2.6, .45, .45, 0, .225, rmid + .6, mat('#3a2a1e', .7));
    box(1.4, .03, .9, 0, CH - .06, rmid, mat('#ffffff', .4, '#fff6e6', 2.5));
    G.add(at(new THREE.PointLight('#fff4e4', 3.5, 9, 2), 0, 2.6, rmid));
    // walkway barriers (black, LED-lit tops) and the steps up to the cage
    const bz0 = 5.8, bz1 = TUNNEL_Z - .3;
    for (const x of [-1.35, 1.35]) { box(.08, 1.0, bz1 - bz0, x, .5, (bz0 + bz1) / 2, mat('#0e0f13', .7)); const m = mat('#000', .4, LED.blue, 2.5); this.ledMats.push(m); box(.1, .05, bz1 - bz0, x, 1.02, (bz0 + bz1) / 2, m); }
    const stepM = mat('#1b1c22', .6);
    for (let k = 0; k < 3; k++) box(1.3, (k + 1) * PLAT / 3, .36, 0, (k + 1) * PLAT / 6, STEPS_Z - .25 - k * .34, stepM);
    G.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = false; });
  }

  skip() {
    for (const w of this.walkers) { this.shirtOff(w); this.place(w.me, new THREE.Vector3(w.cx, PLAT, .05), new THREE.Vector3(-Math.sign(w.cx), 0, 0)); w.me.rig.root.visible = true; for (const c of w.crew) c.rig.root.visible = false; }
    this.done = true;
  }

  private place(p: Person, pos: THREE.Vector3, dir: THREE.Vector3) {
    p.rig.root.position.copy(pos); p.rig.root.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
    p.pf.x = pos.x / X_SCALE; p.pf.z = pos.z / X_SCALE; p.pf.hx = dir.x; p.pf.hz = dir.z;
  }
  /** move a person along the floor, facing dir, walking with a gait that matches the speed */
  private drive(p: Person, pos: THREE.Vector3, face: THREE.Vector3, dt: number, ground: number, other: Fighter) {
    const v = p.prev ? Math.hypot(pos.x - p.prev.x, pos.z - p.prev.z) / Math.max(dt, 1e-4) : 0;
    p.prev = pos.clone();
    const r = p.rig;
    r.root.position.x = pos.x; r.root.position.z = pos.z;
    let dy = Math.atan2(face.x, face.z) - r.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.root.rotation.y += dy * Math.min(1, dt * 7);
    r.root.rotation.x = 0; r.root.rotation.z = 0;
    p.pf.state = 'idle'; p.pf.x = pos.x / X_SCALE; p.pf.z = pos.z / X_SCALE; p.pf.hx = face.x; p.pf.hz = face.z;
    r.sync(p.pf, other, dt);
    const mv = Math.min(1, v / 1.2);
    p.phase += dt * v / 1.45 * Math.PI * 2;
    r.walkPose(p.phase, mv);
    r.liftToFloor(ground, dt);
  }

  update(g: LiveFight, dt: number) {
    if (this.done) return;
    this.t += dt;
    // who's walking: run the walkers one after the other
    let t = this.t, i = 0;
    while (i < this.walkers.length && t > this.walkers[i].total) { t -= this.walkers[i].total; i++; }
    if (i >= this.walkers.length) { this.skip(); return; }
    if (i !== this.who) { this.walkers[this.who]?.crew.forEach(c => { c.rig.root.visible = false; }); }
    this.who = i;
    const w = this.walkers[i];
    for (const m of this.ledMats) m.emissive.set(LED[w.corner]);
    // fighters who already walked: in their corner, bouncing on their toes
    for (let k = 0; k < i; k++) { const o = this.walkers[k]; o.me.rig.root.visible = true; o.me.pf.state = 'idle'; o.me.rig.root.position.set(o.cx, PLAT, .05); o.me.rig.root.rotation.set(0, Math.atan2(-Math.sign(o.cx), 0), 0); o.me.pf.x = o.cx / X_SCALE; o.me.pf.z = .05 / X_SCALE; o.me.pf.hx = -Math.sign(o.cx); o.me.pf.hz = 0; o.me.rig.sync(o.me.pf, w.me.pf, dt); }
    // where on the path he is now
    const pl = w.plan; let s = pl[pl.length - 1].s;
    for (let k = 1; k < pl.length; k++) if (t <= pl[k].t) { const u = (t - pl[k - 1].t) / Math.max(1e-4, pl[k].t - pl[k - 1].t); s = pl[k - 1].s + (pl[k].s - pl[k - 1].s) * (u * u * (3 - 2 * u) * .25 + u * .75); break; }
    const {p, dir} = w.path.at(s);
    const sSteps = w.path.sAt(3), sGate = w.path.sAt(5);
    const atChecks = t >= pl[1].t && t < pl[2].t;
    const ground = p.y;
    const me = w.me; me.rig.root.visible = true;
    const settled = t > pl[pl.length - 2].t;
    const face = settled ? new THREE.Vector3(-Math.sign(w.cx), 0, 0) : dir;
    this.drive(me, p, face, dt, ground, me.pf);
    // the walkout shirt (and chain / bandana) come off at the cage side
    if (atChecks && t - pl[1].t > 1.3) this.shirtOff(w);
    // the crew: coach and cutman a step behind, fanning out at the bottom of the steps
    w.crew.forEach((c, k) => {
      c.rig.root.visible = true;
      const sideOff = k === 0 ? -.62 : .62;
      let target: THREE.Vector3, face2: THREE.Vector3;
      const cutman = k === 1 && atChecks;
      if (cutman) { target = new THREE.Vector3(.18, 0, STEPS_Z - .62); face2 = new THREE.Vector3(0, 0, 1); }
      else {
        const cs = Math.min(s - 1.15 - k * .25, sSteps - .35);
        const q = w.path.at(Math.max(0, cs)); if (cs < 0) q.p.addScaledVector(q.dir, cs);   // still in the locker room behind him
        const perp = new THREE.Vector3(-q.dir.z, 0, q.dir.x);
        target = q.p.clone().addScaledVector(perp, sideOff); target.y = 0;
        if (s > sSteps - .2) { target.x = sideOff * 1.4; target.z = STEPS_Z + .45; }
        face2 = s > sSteps - .2 ? new THREE.Vector3(0, 0, -1) : q.dir;
      }
      if (!c.prev) { c.rig.root.position.copy(target); }
      const cur = c.rig.root.position, step = target.clone().sub(cur); step.y = 0; const dl = step.length();
      const np = dl > .02 ? cur.clone().addScaledVector(step, Math.min(1, dt * 2.2 / Math.max(dl, .4) * 1.6)) : cur.clone();
      this.drive(c, np, face2, dt, 0, me.pf);
      if (cutman) {   // greasing his brows and cheekbones
        const head = me.rig.bones.Head?.getWorldPosition(new THREE.Vector3());
        const hand = c.rig.bones.RightArm?.getWorldPosition(new THREE.Vector3());
        if (head && hand) { const d = head.clone().sub(hand).normalize(); c.rig.poseArm('Right', d, d.clone().add(new THREE.Vector3(0, .15 + Math.sin(this.t * 9) * .12, 0))); }
      }
    });
    // follow-spot and a rim light in his corner colour
    this.spotTarget.position.set(p.x, p.y + 1, p.z); this.spot.position.set(p.x * .3, 12.5, p.z + 4.5);
    this.spot.intensity = p.z > DOOR_Z - .5 ? 0 : 150; this.rim.color.set(LED[w.corner]); this.rim.position.set(p.x - dir.x * 1.2, p.y + 2, p.z - dir.z * 1.2);
    // the gate is open while he goes through it
    const gateOpen = s > sSteps - .5 && s < sGate + .6;
    // camera: handheld in front of him, then cage-side for the checks and the climb, then inside the cage
    let cam: THREE.Vector3, look: THREE.Vector3, shot: string;
    const shake = new THREE.Vector3(Math.sin(this.t * 1.7) * .04 + Math.sin(this.t * 4.3) * .015, Math.sin(this.t * 2.3) * .03, 0);
    if (s < sSteps - 1.6 && !atChecks) {
      const corridor = p.z > TUNNEL_Z - 1;
      cam = p.clone().addScaledVector(dir, corridor ? 2.6 : 3.3).add(new THREE.Vector3(Math.sin(this.t * .6) * (corridor ? .2 : .5), corridor ? 1.55 : 1.9, 0)).add(shake);
      look = p.clone().add(new THREE.Vector3(0, 1.3, 0)); shot = 'track';
    } else if (s < sGate + .4) { cam = new THREE.Vector3(3.1, 2.55, STEPS_Z + 2.3).add(shake.multiplyScalar(.5)); look = new THREE.Vector3(0, 1.15 + p.y * .8, (p.z + STEPS_Z - .4) / 2); shot = 'steps'; }
    else { cam = new THREE.Vector3(-w.cx * .9, PLAT + 1.55, -2.8); look = p.clone().add(new THREE.Vector3(0, 1.2, 0)); shot = 'cage'; }
    if (shot !== this.shot) { this.camPos.copy(cam); this.camLook.copy(look); this.shot = shot; }
    else { const k = 1 - Math.exp(-5 * dt); this.camPos.lerp(cam, k); this.camLook.lerp(look, k); }
    const camera = this.view.camera; camera.position.copy(this.camPos); camera.lookAt(this.camLook);
    // cage panels between the camera and the action get hidden (and the gate opens)
    this.view.fadeCage(this.camPos.x, this.camPos.z, dt, c => gateOpen && c.z > 2.4 && Math.abs(c.x) < 1.7);
    // the referee waits in the middle of the cage
    this.view.updateRef(g, dt);
    this.view.stadium.excite(.06);
  }

  dispose() {
    for (const w of this.walkers) for (const c of w.crew) { this.view.scene.remove(c.rig.root); c.rig.mixer.stopAllAction(); }
    for (const w of this.walkers) { this.shirtOff(w); w.shirtTex?.dispose(); for (const o of w.me.rig.walkout) o.visible = false; w.me.rig.walkout = []; w.me.rig.root.visible = true; }
    for (const h of this.houseLights) h.l.intensity = h.i;
    this.view.scene.remove(this.group, this.spot, this.spotTarget, this.rim);
    this.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    for (const c of this.view.cage) { c.o = 1; c.mesh.visible = true; }
  }
}
