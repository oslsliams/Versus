// Grappling in 3D: every clinch, takedown, ground position and submission is posed live on top of the fighters'
// motion-capture clips (the ground clips are a fighter on his back and a fighter posted over him). Each frame the
// bodies are placed relative to each other, then the spine, arms and legs are aimed at real points on the other
// man (his neck, his hips, his knees), so the two bodies fit together whatever their size.
import * as THREE from 'three';
import type {LiveFight} from '../../lib/fight3d/engine';
import type {FighterRig} from './fight-view';

const PLAT = .9, X_SCALE = .82;
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** a direction built from weighted world axes */
const mix = (...parts: [THREE.Vector3, number][]) => parts.reduce((a, [v, w]) => a.addScaledVector(v, w), v3()).normalize();

export type Place = {x: number; z: number; fx: number; fz: number};
/** where each body goes for the current position (u points from the man underneath toward the man on top, v is his left) */
export function grapplePlace(g: LiveFight, side: 0 | 1): Place | null {
  const G = g.grap; if (!G || G.pos === 'clinch' || G.pos === 'drive') return null;
  const T = g.f[G.top], B = g.f[G.top ? 0 : 1];
  const bx = B.x * X_SCALE, bz = B.z * X_SCALE;
  let ux = T.x * X_SCALE - bx, uz = T.z * X_SCALE - bz; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
  const vx = -uz, vz = ux, isTop = side === G.top;
  const at = (a: number, b: number, fx: number, fz: number): Place => ({x: bx + ux * a + vx * b, z: bz + uz * a + vz * b, fx, fz});
  const sub = G.sub?.name;
  if (!isTop) {
    if (sub === 'Armbar' && G.sub!.by === G.top) return at(0, 0, ux, uz);
    return at(0, 0, ux, uz);
  }
  switch (G.pos) {
    case 'guard': return sub === 'Triangle' ? at(.42, 0, -ux, -uz) : at(.38, 0, -ux, -uz);
    case 'half': return at(.2, .14, -ux * .94 - vx * .34, -uz * .94 - vz * .34);
    case 'side': return sub === 'Arm-triangle' ? at(-.42, .38, -vx, -vz) : at(-.3, .4, -vx, -vz);
    case 'mount': return sub === 'Armbar' ? at(-.33, .36, vx, vz) : sub === 'Arm-triangle' ? at(-.12, .1, -ux, -uz) : at(.04, 0, -ux, -uz);
    case 'back': return at(-.27, 0, ux, uz);
  }
  return null;
}

/** the poses, applied after the animation mixer has run for both rigs */
export class GrapplePoser {
  private blend = 0; private key = ''; private time = 0;
  apply(g: LiveFight, rigs: [FighterRig, FighterRig], dt: number) {
    this.time += dt;
    const G = g.grap;
    const key = G ? `${G.pos}:${G.top}:${G.sub?.name ?? ''}` : '';
    if (key !== this.key) { this.key = key; this.blend = 0; }
    if (!G) return;
    this.blend = Math.min(1, this.blend + dt / .3);
    const a = this.blend * this.blend * (3 - 2 * this.blend);
    const top = rigs[G.top], bot = rigs[G.top ? 0 : 1];
    const struggle = G.move || G.sub ? Math.sin(this.time * 17) * .04 : 0;
    // u: underneath man toward the man on top; v: his left
    const u = v3(top.root.position.x - bot.root.position.x, 0, top.root.position.z - bot.root.position.z); if (u.lengthSq() < 1e-6) u.set(0, 0, 1); u.normalize();
    const v = v3(-u.z, 0, u.x);
    if (G.pos === 'clinch' || G.pos === 'drive') { this.standing(G.pos, G.top, rigs, a, G.sub?.name); return; }
    // the base clips: the man underneath on his back; the man on top posted over him (or on his back too, behind him / for an armbar)
    bot.hold('ground_back');
    top.hold(G.pos === 'back' || (G.sub?.name === 'Armbar' && G.sub.by === G.top) ? 'ground_back' : 'ground_top');
    // the man underneath
    this.bottom(G.pos, bot, top, u, v, a, G.sub, struggle);
    // the man on top
    this.top(G.pos, top, bot, u, v, a, G.sub, struggle, dt);
  }

  /** clinch, the takedown drive and a standing guillotine */
  private standing(pos: 'clinch' | 'drive', presser: 0 | 1, rigs: [FighterRig, FighterRig], a: number, sub?: string) {
    for (const s of [0, 1] as const) {
      const me = rigs[s], him = rigs[s ? 0 : 1];
      const hisNeck = him.pos('Neck'), hisHips = him.pos('Hips');
      const toHim = hisNeck.clone().sub(me.pos('Neck')); toHim.y = 0; toHim.normalize();
      const left = v3(-toHim.z, 0, toHim.x);
      if (pos === 'drive') {
        if (s === presser) {   // the shooter: level changed, head on his chest, arms round his legs
          me.hold('shoot', .1);
          for (const [side, sg] of [['Left', 1], ['Right', -1]] as const) {
            const tgt = hisHips.clone().addScaledVector(UP, -.35).addScaledVector(left, sg * .2).addScaledVector(toHim, .15);
            const d = tgt.sub(me.pos(side + 'Arm')).normalize(); me.poseArm(side, d, mix([d, 1], [left, -sg * .9]), a);
          }
        } else {               // the defender: hips back, hands on his shoulders and head
          me.aimSpine(mix([UP, .7], [toHim, .7]), a * .7);
          for (const [side, sg] of [['Left', 1], ['Right', -1]] as const) {
            const tgt = him.pos('Spine2').addScaledVector(left, sg * .12);
            me.poseArm(side, tgt.clone().sub(me.pos(side + 'Arm')).normalize(), mix([UP, -1], [toHim, .4]), a);
          }
        }
        continue;
      }
      if (sub === 'Guillotine') {
        if (s === presser) {   // arm wrapped under his chin, other hand locking it
          me.aimSpine(mix([UP, 1], [toHim, -.15]), a * .6);
          const neck = him.pos('Neck');
          me.poseArm('Right', neck.clone().sub(me.pos('RightArm')).normalize(), mix([left, 1], [UP, .3]), a);
          me.poseArm('Left', neck.clone().addScaledVector(left, .1).sub(me.pos('LeftArm')).normalize(), mix([left, -.6], [toHim, .5], [UP, .4]), a);
        } else {               // folded over, head trapped under the armpit, hands fighting the choke
          me.aimSpine(mix([toHim, 1], [UP, -.55]), a);
          for (const [side] of [['Left'], ['Right']] as const) { const tgt = him.pos('RightForeArm'); me.poseArm(side, tgt.clone().sub(me.pos(side + 'Arm')).normalize(), mix([UP, .6], [toHim, .4]), a); }
        }
        continue;
      }
      // the clinch: foreheads together, a collar tie and an underhook each
      me.aimSpine(mix([UP, 1], [toHim, .32]), a);
      const sh = me.pos('RightArm'), neck = him.pos('Neck').addScaledVector(UP, .04);
      me.poseArm('Right', neck.clone().sub(sh).normalize(), mix([toHim, .2], [UP, -.6], [left, .55]), a);
      const pit = him.pos('Spine1').addScaledVector(left, -.17);
      me.poseArm('Left', pit.clone().sub(me.pos('LeftArm')).normalize(), mix([toHim, .5], [UP, .7], [left, -.4]), a);
    }
  }

  private bottom(pos: string, me: FighterRig, him: FighterRig, u: THREE.Vector3, v: THREE.Vector3, a: number, sub: LiveFight['grap'] extends infer G ? G extends {sub: infer S} ? S : never : never, struggle: number) {
    // the ground clip doesn't drive his spine, so start every frame from a straight back (sitting up is posed below)
    if (pos !== 'back') me.straighten();
    const hips = him.pos('Hips'), back = u.clone();
    const legs = (thighL: THREE.Vector3, shinL: THREE.Vector3, thighR: THREE.Vector3, shinR: THREE.Vector3) => { me.aimLeg('Left', thighL, shinL, a); me.aimLeg('Right', thighR, shinR, a); };
    switch (pos) {
      case 'guard': {
        if (sub?.name === 'Triangle') {   // legs locked round his head and one arm
          const head = him.pos('Head');
          for (const [side, sg] of [['Left', 1], ['Right', -1]] as const) { const d = head.clone().addScaledVector(v, sg * .2).sub(me.pos(side + 'UpLeg')).normalize(); me.aimLeg(side, d, mix([v, -sg], [back, .5], [UP, -.2]), a); }
          break;
        }
        // closed guard: thighs up his sides, ankles crossed behind his back
        for (const [side, sg] of [['Left', 1], ['Right', -1]] as const) {
          const d = hips.clone().addScaledVector(v, sg * .2).addScaledVector(UP, .12).sub(me.pos(side + 'UpLeg')).normalize();
          me.aimLeg(side, d, mix([back, .75], [v, -sg * .65], [UP, -.1]), a);
        }
        break;
      }
      case 'half': legs(mix([back, .7], [UP, .5], [v, .25]), mix([back, .5], [v, -.7], [UP, -.4]), mix([back, 1], [UP, .1]), mix([back, 1], [UP, -.25])); break;
      case 'side': legs(mix([back, .7], [UP, .55], [v, -.2]), mix([back, .4], [UP, -.8]), mix([back, .8], [UP, .35]), mix([back, .5], [UP, -.7])); break;
      case 'mount': legs(mix([back, 1], [UP, .05], [v, .15]), mix([back, 1], [UP, -.05]), mix([back, 1], [UP, .05], [v, -.15]), mix([back, 1], [UP, -.05])); break;
      case 'back': {   // sitting up between his legs, his hooks in
        me.aimSpine(mix([UP, 1], [back, .3]), a);
        legs(mix([back, 1], [v, .25], [UP, -.1]), mix([back, .9], [UP, -.35]), mix([back, 1], [v, -.25], [UP, -.1]), mix([back, .9], [UP, -.35]));
        break;
      }
    }
    // arms: framing on his neck and hips, or fighting the hands on a choke
    if (pos === 'back' || sub) {
      const tgt = him.pos(pos === 'back' ? 'RightForeArm' : 'RightHand');
      for (const side of ['Left', 'Right'] as const) me.poseArm(side, tgt.clone().sub(me.pos(side + 'Arm')).normalize(), mix([UP, .3], [back, .3]), a * (.8 + struggle * 4));
    } else if (pos === 'side' || pos === 'mount') {
      const neck = him.pos('Neck'), hp = him.pos('Hips');
      me.poseArm('Left', neck.clone().sub(me.pos('LeftArm')).normalize(), mix([UP, .7], [back, .3]), a);
      me.poseArm('Right', hp.clone().sub(me.pos('RightArm')).normalize(), mix([UP, .5], [back, .4]), a);
    }
    if (sub?.name === 'Armbar' || sub?.name === 'Kimura') {   // the trapped arm
      const att = him.pos('Spine2');
      if (sub.name === 'Armbar') { const d = att.clone().addScaledVector(UP, .1).sub(me.pos('RightArm')).normalize(); me.poseArm('Right', d, d, a); }
      else me.poseArm('Right', mix([v, -1], [UP, -.2]), mix([UP, 1], [back, -.3]), a);
    }
  }

  private top(pos: string, me: FighterRig, him: FighterRig, u: THREE.Vector3, v: THREE.Vector3, a: number, sub: {name: string; by: 0 | 1} | null, struggle: number, dt: number) {
    const fwd = u.clone().negate();            // toward his head
    const kneel = (spread: number, lean: THREE.Vector3, sit = .45) => {   // sit: how far he sits back toward his heels
      for (const [side, sg] of [['Left', 1], ['Right', -1]] as const) {
        const {left} = me.axes();
        me.aimLeg(side, mix([UP, -.85 + sit * .4], [left, sg * spread], [me.axes().fwd, sit]), mix([me.axes().fwd, -1], [UP, -.12]), a);
      }
      me.aimSpine(lean, a);
      me.liftToFloor(PLAT, dt);
    };
    const neck = him.pos('Neck'), chest = him.pos('Spine2');
    const reach = (side: 'Left' | 'Right', tgt: THREE.Vector3, fore: THREE.Vector3, amt = a) => me.poseArm(side, tgt.clone().sub(me.pos(side + 'Arm')).normalize(), fore, amt);
    switch (pos) {
      case 'guard': kneel(.3, mix([UP, .7], [me.axes().fwd, .8]), .6); break;
      case 'half': kneel(.34, mix([UP, .6], [me.axes().fwd, .9]), .55); break;
      case 'side': {   // chest to chest across him: crossface under his neck to the far shoulder, underhook on the far arm
        kneel(.4, mix([UP, .22], [me.axes().fwd, 1]), .55);
        const f2 = me.axes().fwd, farNeck = neck.clone().addScaledVector(f2, .14), farPit = chest.clone().addScaledVector(f2, .17).addScaledVector(UP, -.04);
        const headSide: 'Left' | 'Right' = me.pos('LeftArm').distanceTo(neck) < me.pos('RightArm').distanceTo(neck) ? 'Left' : 'Right', hipSide = headSide === 'Left' ? 'Right' : 'Left';
        if (sub?.name !== 'Kimura') { reach(headSide, farNeck, mix([f2, 1], [UP, -.35]), a); reach(hipSide, farPit, mix([f2, .7], [UP, .5]), a); }
        break;
      }
      case 'mount': {
        if (sub?.name === 'Armbar') {   // fallen back across him, legs over his chest, his arm pulled straight
          const {fwd: f2, left} = me.axes();
          // hips tight to his shoulder, one leg across his face and one across his chest, knees pinched, heels down
          const towardHead = u.clone().negate(), legL = me.pos('LeftUpLeg').distanceTo(neck) < me.pos('RightUpLeg').distanceTo(neck);
          for (const side of ['Left', 'Right'] as const) { const overFace = (side === 'Left') === legL; me.aimLeg(side, mix([f2, 1], [UP, .18], [towardHead, overFace ? .35 : -.15]), mix([f2, .45], [UP, -.85]), a); }
          const arm = him.pos('RightHand');
          reach('Left', arm, mix([UP, .4], [f2, -.4]), a); reach('Right', arm, mix([UP, .4], [f2, -.4]), a);
          me.aimSpine(mix([UP, .15], [f2, -1]), a * (.9 + struggle * 2));
          break;
        }
        kneel(.7, mix([UP, 1], [me.axes().fwd, sub?.name === 'Arm-triangle' ? .9 : .15]), .75);
        if (sub?.name === 'Arm-triangle') { reach('Left', neck, mix([fwd, .2], [v, 1], [UP, -.5]), a); reach('Right', neck.clone().addScaledVector(v, -.1), mix([v, -1], [UP, -.4]), a); }
        break;
      }
      case 'back': {   // seated behind him, hooks in, chest on his back
        me.aimSpine(mix([UP, 1], [u, .45]), a);
        const {left} = me.axes();
        for (const [side, sg] of [['Left', 1], ['Right', -1]] as const) me.aimLeg(side, mix([u, 1], [left, sg * .6], [UP, .1]), mix([u, .45], [left, -sg * .9], [UP, -.15]), a);
        if (sub?.name === 'Rear-naked choke') {   // forearm across the throat, other hand behind his head, squeezing
          const throat = neck.clone().addScaledVector(u, .1);
          reach('Right', neck.clone().addScaledVector(left, -.12).addScaledVector(UP, .05), mix([left, 1], [u, .35]), a);
          reach('Left', throat.clone().addScaledVector(UP, .12), mix([UP, .7], [u, .3], [left, -.5]), a * (.95 + struggle * 2));
        } else {                                   // seatbelt grip: one arm over the shoulder, one under the armpit
          reach('Right', neck.clone().addScaledVector(left, -.15), mix([left, 1], [UP, -.6]), a);
          reach('Left', chest.clone().addScaledVector(left, .18).addScaledVector(UP, -.08), mix([left, -1], [UP, .4]), a);
        }
        break;
      }
    }
    if (sub?.name === 'Kimura') { const wrist = him.pos('RightHand'); reach('Left', wrist, mix([UP, .3], [v, -.5]), a); reach('Right', wrist.clone().addScaledVector(UP, .08), mix([UP, .5], [v, -.4]), a); }
    if (pos === 'side' && sub?.name === 'Arm-triangle') { reach('Right', neck.clone().addScaledVector(fwd, .1), mix([fwd, 1], [UP, -.5]), a); }
  }
}
