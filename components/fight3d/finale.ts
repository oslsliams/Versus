// The end of a fight, staged like a broadcast:
//  1. KO replay: every rendered frame of both fighters and the referee is recorded (root transform + every bone),
//     and a knockout is replayed in slow motion from orbiting low angles (the way EA's cinematic KO replays work:
//     the camera knows the action in advance and picks dramatic angles).
//  2. The decision: both fighters stand either side of the referee facing the hard camera; the ref holds their
//     wrists while the result is read, then raises the winner's arm (both arms for a draw). Confetti for the winner.
import * as THREE from 'three';
import type {FightView, FighterRig} from './fight-view';
import type {Fighter} from '../../lib/fight3d/engine';

const PLAT = .9;
type Snap = {p: [number, number, number]; r: [number, number, number]; q: Float32Array; hips: [number, number, number]};
type Frame = {t: number; s: (Snap | null)[]};

const bonesOf = (r: FighterRig) => Object.values(r.bones).filter(Boolean) as THREE.Bone[];
function snap(r: FighterRig): Snap {
  const bs = bonesOf(r), q = new Float32Array(bs.length * 4);
  bs.forEach((b, i) => { q[i * 4] = b.quaternion.x; q[i * 4 + 1] = b.quaternion.y; q[i * 4 + 2] = b.quaternion.z; q[i * 4 + 3] = b.quaternion.w; });
  const h = r.bones.Hips?.position;
  return {p: [r.root.position.x, r.root.position.y, r.root.position.z], r: [r.root.rotation.x, r.root.rotation.y, r.root.rotation.z], q, hips: h ? [h.x, h.y, h.z] : [0, 0, 0]};
}
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function apply(r: FighterRig, a: Snap, b: Snap, u: number) {
  r.root.position.set(a.p[0] + (b.p[0] - a.p[0]) * u, a.p[1] + (b.p[1] - a.p[1]) * u, a.p[2] + (b.p[2] - a.p[2]) * u);
  let dy = b.r[1] - a.r[1]; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  r.root.rotation.set(a.r[0] + (b.r[0] - a.r[0]) * u, a.r[1] + dy * u, a.r[2] + (b.r[2] - a.r[2]) * u);
  bonesOf(r).forEach((bn, i) => { _qa.fromArray(a.q, i * 4); _qb.fromArray(b.q, i * 4); bn.quaternion.copy(_qa).slerp(_qb, u); });
  const h = r.bones.Hips; if (h) h.position.set(a.hips[0] + (b.hips[0] - a.hips[0]) * u, a.hips[1] + (b.hips[1] - a.hips[1]) * u, a.hips[2] + (b.hips[2] - a.hips[2]) * u);
}

export class Finale {
  mode: 'live' | 'replay' | 'ceremony' = 'live';
  private frames: Frame[] = []; private tKO = -1;
  private rt = 0; private r0 = 0; private r1 = 0; private replayFocus = new THREE.Vector3(); private orbit0 = 0;
  replayDone = false;
  private ct = 0; private winner: 0 | 1 | -1 = -1; private confetti: THREE.InstancedMesh | null = null; private cv: {p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3}[] = [];
  private pseudo: Fighter[] = [0, 1, 2].map(() => ({state: 'idle', move: null, t: 0, x: 0, z: 0, hx: 0, hz: 1, cap: 100, rocked: 0, combo: 0, target: 'head'} as unknown as Fighter));

  constructor(private view: FightView) {}
  private rigs() { return [this.view.rigs[0], this.view.rigs[1], this.view.ref] as (FighterRig | null)[]; }

  /** every live frame: keep the last 6 seconds */
  record(t: number) {
    this.frames.push({t, s: this.rigs().map(r => r ? snap(r) : null)});
    while (this.frames.length && t - this.frames[0].t > 6) this.frames.shift();
  }
  markKO(t: number) { if (this.tKO < 0) this.tKO = t; }
  get hasKO() { return this.tKO >= 0; }

  /** slow-motion replay of the finishing blow, 2 s before it to 1.4 s after, at ~0.35x */
  startReplay(loser: 0 | 1) {
    if (this.tKO < 0 || this.frames.length < 10) { this.replayDone = true; return; }
    this.mode = 'replay'; this.rt = 0;
    this.r0 = Math.max(this.frames[0].t, this.tKO - 2); this.r1 = Math.min(this.frames[this.frames.length - 1].t, this.tKO + 1.4);
    const lr = this.view.rigs[loser].root.position, wr = this.view.rigs[loser ? 0 : 1].root.position;
    this.replayFocus.set((lr.x * 2 + wr.x) / 3, PLAT + 1.05, (lr.z * 2 + wr.z) / 3);
    // start on the side away from the referee (he rushes in on a stoppage and would fill the lens)
    const ref = this.view.ref?.root.position;
    const lx = lr.x - wr.x, lz = lr.z - wr.z; this.orbit0 = Math.atan2(lz, lx) + Math.PI / 2;
    if (ref) { const away = Math.atan2(this.replayFocus.z - ref.z, this.replayFocus.x - ref.x); this.orbit0 = away - .75; }
    for (const r of this.rigs()) r?.mixer.stopAllAction();
  }
  private replay(dt: number) {
    this.rt += dt;
    const SPEED = .35, t = this.r0 + this.rt * SPEED;
    if (t >= this.r1) { this.replayDone = true; return; }
    const fs = this.frames; let i = fs.findIndex(f => f.t >= t); if (i <= 0) i = 1;
    const a = fs[i - 1], b = fs[i], u = Math.min(1, Math.max(0, (t - a.t) / Math.max(1e-4, b.t - a.t)));
    this.rigs().forEach((r, k) => { const sa = a.s[k], sb = b.s[k]; if (r && sa && sb) apply(r, sa, sb, u); });
    // the camera: low, close, sweeping round the impact; a slow push in
    const p = this.rt / ((this.r1 - this.r0) / SPEED);
    const cam = this.view.camera, narrow = cam.aspect < 1 ? 1.5 : 1;
    const ang = this.orbit0 + p * 1.5, rad = (2.6 - p * .8) * narrow, h = PLAT + .75 + p * .45;
    let x = this.replayFocus.x + Math.cos(ang) * rad, z = this.replayFocus.z + Math.sin(ang) * rad * .9;
    const r = Math.hypot(x, z), lim = 3.25; if (r > lim) { x *= lim / r; z *= lim / r; }      // stay inside the cage
    cam.position.set(x, h, z);
    cam.lookAt(this.replayFocus);
    cam.fov = 34; cam.updateProjectionMatrix();
    this.view.fadeCage(cam.position.x, cam.position.z, dt);
  }

  /** the hand raise. winner: 0 red, 1 blue, -1 draw */
  startCeremony(winner: 0 | 1 | -1) {
    this.mode = 'ceremony'; this.ct = 0; this.winner = winner; this.view.ceremonyOn = true;
    const [red, blue] = this.view.rigs, ref = this.view.ref;
    for (const r of [red, blue, ref]) if (r) { r.mixer.stopAllAction(); r.wobble = 0; (r as any).current = null; (r as any).upperCur = null; (r as any).split = false; r.play('idle', 0); }
    const place = (r: FighterRig | null, x: number, z: number) => { if (!r) return; r.root.position.set(x, PLAT, z); r.root.rotation.set(0, 0, 0); };
    place(red, -.92, .2); place(blue, .92, .2); place(ref, 0, .05);
    this.view.camera.fov = 36; this.view.camera.updateProjectionMatrix();
    // confetti in the winner's colour (gold + white for a draw)
    const n = 260, geo = new THREE.PlaneGeometry(.045, .03), mat = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
    const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.visible = false;
    const cols = winner === 0 ? ['#ff3347', '#ffd166', '#ffffff'] : winner === 1 ? ['#3a7bff', '#ffd166', '#ffffff'] : ['#ffd166', '#ffffff', '#c5f74f'];
    for (let k = 0; k < n; k++) {
      im.setColorAt(k, new THREE.Color(cols[k % cols.length]));
      this.cv.push({p: new THREE.Vector3((Math.random() - .5) * 5, PLAT + 4 + Math.random() * 3, (Math.random() - .5) * 4), v: new THREE.Vector3((Math.random() - .5) * .4, -(.6 + Math.random() * .7), (Math.random() - .5) * .4), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 3)});
    }
    this.view.scene.add(im); this.confetti = im;
  }
  get raised() { return this.mode === 'ceremony' && this.ct > 2.3; }
  private ceremony(dt: number) {
    this.ct += dt;
    const [red, blue] = this.view.rigs, ref = this.view.ref, t = this.ct;
    const up = new THREE.Vector3(0, 1, 0), down = new THREE.Vector3(0, -1, 0);
    const people: [FighterRig | null, number][] = [[red, 0], [blue, 1], [ref, 2]];
    for (const [r, k] of people) {
      if (!r) continue;
      const pf = this.pseudo[k]; pf.x = r.root.position.x / .82; pf.z = r.root.position.z / .82; pf.hx = 0; pf.hz = 1;
      r.mixer.update(dt);
      r.walkPose(0, 0);
      r.liftToFloor(PLAT, dt);
    }
    // the raise: 2.3 s of the announcer, then up it goes
    const u = Math.min(1, Math.max(0, (t - 2.3) / .55)), ease = u * u * (3 - 2 * u);
    const raise = (r: FighterRig | null, side: 'Left' | 'Right', towardX: number) => {
      if (!r) return;
      const reach = down.clone().multiplyScalar(.85).add(new THREE.Vector3(towardX * .45, 0, .12));      // wrist held low by the ref
      const high = up.clone().multiplyScalar(.97).add(new THREE.Vector3(towardX * .22, 0, .05));         // straight up
      const d = reach.clone().lerp(high, ease).normalize();
      r.poseArm(side, d, d);
    };
    const redWins = this.winner === 0 || this.winner === -1, blueWins = this.winner === 1 || this.winner === -1;
    // red stands on the left (his left side faces the ref), blue on the right (his right side)
    if (redWins) raise(red, 'Left', 1); else red?.poseArm('Left', down.clone().add(new THREE.Vector3(.45, 0, .12)), down.clone().add(new THREE.Vector3(.35, 0, .25)));
    if (blueWins) raise(blue, 'Right', -1); else blue?.poseArm('Right', down.clone().add(new THREE.Vector3(-.45, 0, .12)), down.clone().add(new THREE.Vector3(-.35, 0, .25)));
    // the ref's hands follow the fighters' wrists (his right hand to red, left hand to blue)
    if (ref) {
      for (const [side, fr] of [['Right', red], ['Left', blue]] as const) {
        const hand = fr?.bones[side === 'Right' ? 'LeftHand' : 'RightHand']?.getWorldPosition(new THREE.Vector3());
        const sh = ref.bones[side + 'Arm']?.getWorldPosition(new THREE.Vector3());
        if (!hand || !sh) continue;
        const d = hand.sub(sh).normalize();
        ref.poseArm(side, d, d);
      }
    }
    // camera: the hard camera straight on, a slow push in
    // far enough back that all three fit across the frame on any screen shape (phones are tall and narrow)
    const cam = this.view.camera, hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect);
    const fit = Math.max(4.4, 1.75 / Math.tan(hfov / 2) + .3), z = fit - Math.min(1, t / 6) * fit * .15;
    cam.position.set(Math.sin(t * .25) * .25, PLAT + 1.45, z); cam.lookAt(0, PLAT + 1.25, 0);
    this.view.fadeCage(cam.position.x, cam.position.z, dt);
    // confetti once the hand goes up
    if (this.confetti && t > 2.4) {
      this.confetti.visible = true;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
      this.cv.forEach((c, k) => {
        c.p.addScaledVector(c.v, dt); c.p.x += Math.sin(t * 2 + k) * dt * .3;
        if (c.p.y < PLAT) c.p.y = PLAT + 5 + Math.random() * 2;
        c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; q.setFromEuler(c.r);
        this.confetti!.setMatrixAt(k, m.compose(c.p, q, s));
      });
      this.confetti.instanceMatrix.needsUpdate = true;
    }
  }

  /** returns true when it handled the frame */
  update(dt: number) {
    if (this.mode === 'replay') { this.replay(dt); return true; }
    if (this.mode === 'ceremony') { this.ceremony(dt); return true; }
    return false;
  }
  dispose() { if (this.confetti) { this.view.scene.remove(this.confetti); this.confetti.geometry.dispose(); (this.confetti.material as THREE.Material).dispose(); } }
}
