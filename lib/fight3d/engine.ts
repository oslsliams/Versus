// VERSUS live fights: real-time 3D fight simulation (fixed 60 Hz step).
// Fighters move freely on the octagon floor (x, z in metres) and always turn to face each other
// while free; a committed strike keeps its heading, so stepping off the line makes it miss.
// Stats (0-100) from career mode shape speed, damage, stamina, takedowns and submissions.
//
// Damage model (built from fight data and knockout biomechanics, see DAMAGE below):
//  - three pools: HEAD (the knockout meter), BODY and LEGS, each 0-100.
//  - head health recovers between exchanges, but only up to a ceiling (cap) that every clean shot,
//    every wobble and every knockdown lowers for the rest of the fight. Hurt a man and he stays hurtable.
//  - head at 0 = knockdown. How bad depends on how far past zero the last shot went, how often he's
//    been down, power vs chin. Most knockdowns end the fight (UFC: one knockdown lifts a KO from ~15%
//    to ~63%), the rest leave him wobbled.
//  - flash knockouts: rotational shots (hooks, uppercuts, elbows, head kicks) can switch the lights off
//    at any health. Walking into a shot (a counter) and a cracked chin multiply it.
//  - body damage drains stamina and slows its recovery; a body pool at 0 folds him (liver shot).
//  - leg damage slows his feet, saps punching power and weakens his shots; legs at 0 drop him.
import type {Stats, Style} from '../career/engine';

export type MoveId = 'jab' | 'cross' | 'kick' | 'upper';
export type Target = 'head' | 'body' | 'legs';
export type FState = 'idle' | 'walk' | 'attack' | 'block' | 'stun' | 'down' | 'getup' | 'shoot' | 'sprawl' | 'sprawled' | 'top' | 'bottom' | 'ko' | 'win';
/** mx/mz: world-space movement wish (-1..1). left/right/up/down: the player's raw keys (screen space, mapped by the view).
 *  up/down held as a strike starts pick the target: up + kick = head kick, down + kick = leg kick, down + punch = body shot. */
export type Input = {mx: number; mz: number; left: boolean; right: boolean; up: boolean; down: boolean; block: boolean; jab: boolean; cross: boolean; kick: boolean; upper: boolean; shoot: boolean};
export const NO_INPUT: Input = {mx: 0, mz: 0, left: false, right: false, up: false, down: false, block: false, jab: false, cross: false, kick: false, upper: false, shoot: false};
export const DT = 1 / 60;

const MOVES: Record<MoveId, {start: number; active: number; rec: number; range: number; cost: number; push: number; heavy: boolean}> = {
  jab: {start: .15, active: .06, rec: .2, range: 1.18, cost: 3, push: .15, heavy: false},
  cross: {start: .18, active: .07, rec: .28, range: 1.28, cost: 6, push: .3, heavy: true},
  kick: {start: .3, active: .09, rec: .38, range: 1.55, cost: 9, push: .45, heavy: true},
  upper: {start: .17, active: .07, rec: .3, range: 1.08, cost: 8, push: .35, heavy: true},
};
/** DAMAGE: points off each pool for a clean shot from an average-power fighter (power 50, fresh).
 *  rot = how much rotational head acceleration the strike makes: hooks/uppercuts/elbows and head kicks
 *  spin the head (the main driver of knockouts); a jab barely does. */
const DMG: Record<MoveId, Record<Target, number> & {rot: number}> = {
  jab: {head: 3.2, body: 2, legs: 0, rot: .12},
  cross: {head: 7.2, body: 4.2, legs: 0, rot: .55},
  upper: {head: 8.5, body: 5, legs: 0, rot: 1},
  kick: {head: 12.5, body: 6.5, legs: 8, rot: 1.25},
};
let FLASH = .0055;
export const __tune = (k: {flash?: number}) => { if (k.flash != null) FLASH = k.flash; };
/** what each strike can aim at */
export const targetFor = (m: MoveId, up: boolean, down: boolean): Target => m === 'kick' ? (up ? 'head' : down ? 'legs' : 'body') : down ? 'body' : 'head';
// hold-to-combo strings, by the button held (classic MMA combinations; 'upper' plays hooks/uppercuts/elbows)
const COMBOS: Record<MoveId, MoveId[]> = {jab: ['jab', 'jab', 'cross', 'upper'], cross: ['cross', 'upper', 'cross', 'kick'], kick: ['kick', 'jab', 'cross', 'kick'], upper: ['upper', 'cross', 'upper']};
const SHOOT = {start: .26, active: .16, rec: .45, range: 1.4, cost: 12};
export const ROUND_SECONDS = 90;
export const CAGE_R = 4.2;          // usable floor radius (engine metres)
const MIN_GAP = 1.0;                // bodies never overlap
const ALIGN = .8;                   // a strike lands only if the target is within ~37 deg of where it was thrown

export type Fighter = {
  name: string; color: string; style: Style; stats: Stats; side: 0 | 1;
  x: number; z: number; hx: number; hz: number; state: FState; t: number; move: MoveId | null; hitDone: boolean;
  /** hp = head health (the knockout meter); cap = the most it can recover to this fight */
  hp: number; cap: number; body: number; legs: number; rocked: number; sinceHit: number; target: Target; legDowns: number;
  stamina: number; kdRound: number; invuln: number; queued: MoveId | null; combo: number;
  escape: number; sub: number; subClock: number; gnpCd: number; mashCd: number;
  landed: number; points: number; takedowns: number; knockdowns: number;
  /** hold-to-combo: the button that started the current flurry; fight stats for the post-fight screen */
  comboKey: MoveId | null; thrown: number; tdAttempts: number; ctrl: number;
  headLanded: number; bodyLanded: number; legLanded: number; absorbed: number;
};
export type FightEvent = {type: 'hit' | 'block' | 'whiff' | 'kd' | 'ko' | 'td' | 'sprawl' | 'sub' | 'escape' | 'tap' | 'bell' | 'tired' | 'hurt'; side: 0 | 1; x: number; z: number; power: number; text?: string; target?: Target};
export type Phase = 'intro' | 'fight' | 'break' | 'over';
export type LiveFight = {
  f: [Fighter, Fighter]; round: number; rounds: number; clock: number; phase: Phase; phaseT: number;
  slowmo: number; hitstop: number; events: FightEvent[]; cards: [number, number][]; seed: number;
  result: null | {winner: 0 | 1 | -1; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; how?: string; time?: number};
  /** how the pending stoppage happened (set when a knockdown is waved off, read when he hits the floor) */
  how?: string;
};

let seedState = 1;
const rand = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; };

export function createFight(a: {name: string; color: string; style: Style; stats: Stats}, b: {name: string; color: string; style: Style; stats: Stats}, rounds: number, seed = Date.now()): LiveFight {
  seedState = seed >>> 0 || 1;
  const mk = (p: typeof a, side: 0 | 1, x: number): Fighter => ({...p, side, x, z: 0, hx: side === 0 ? 1 : -1, hz: 0, state: 'idle', t: 0, move: null, hitDone: false,
    hp: 100, cap: 100, body: 100, legs: 100, rocked: 0, sinceHit: 9, target: 'head', legDowns: 0,
    stamina: 100, kdRound: 0, invuln: 0, queued: null, combo: 0, escape: 0, sub: 0, subClock: 0, gnpCd: 0, mashCd: 0, landed: 0, points: 0, takedowns: 0, knockdowns: 0,
    comboKey: null, thrown: 0, tdAttempts: 0, ctrl: 0, headLanded: 0, bodyLanded: 0, legLanded: 0, absorbed: 0});
  return {f: [mk(a, 0, -1.6), mk(b, 1, 1.6)], round: 1, rounds, clock: ROUND_SECONDS, phase: 'intro', phaseT: 0, slowmo: 0, hitstop: 0, events: [], cards: [[0, 0], [0, 0], [0, 0]], seed, result: null};
}

/** unit vector and distance from f to o */
export const rel = (f: {x: number; z: number}, o: {x: number; z: number}) => {
  const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz) || 1e-6;
  return {ux: dx / d, uz: dz / d, d};
};
export const distance = (a: Fighter, b: Fighter) => rel(a, b).d;
/** speed factor: base speed, gas tank, damaged legs, and a wobble all slow a fighter down */
const spd = (f: Fighter) => (.78 + f.stats.speed / 220) * (.75 + .25 * f.stamina / 100) * (.64 + .36 * f.legs / 100) * (f.rocked > 0 ? .62 : 1);
const setState = (f: Fighter, s: FState) => { f.state = s; f.t = 0; };
const busy = (f: Fighter) => !['idle', 'walk', 'block'].includes(f.state);
const ev = (g: LiveFight, e: Omit<FightEvent, 'z'> & {z?: number}) => g.events.push({z: 0, ...e});
export const moveTiming = (f: Fighter, m: MoveId) => { const k = 1 / spd(f); const d = MOVES[m]; return {start: d.start * k, active: d.active, rec: d.rec * k, range: d.range}; };
const push = (o: Fighter, ux: number, uz: number, amt: number) => { o.x += ux * amt; o.z += uz * amt; };
/** 0-100: how much damage he carries out of the fight (career: health, medical suspensions) */
export const damageTaken = (f: Fighter) => Math.round(Math.min(100, (100 - f.cap) * 1.5 + (100 - f.body) * .12 + (100 - f.legs) * .12 + (f.hp <= 0 ? 15 : 0)));

/* ------------------------------------------------------------------ step */
export function step(g: LiveFight, inputs: [Input, Input], pressed: [Input, Input]) {
  g.events = [];
  if (g.hitstop > 0) { g.hitstop -= DT; return; }
  const dt = g.slowmo > 0 ? DT * .3 : DT;
  if (g.slowmo > 0) g.slowmo -= DT;
  g.phaseT += DT;
  if (g.phase === 'intro') { if (g.phaseT > (g.round === 1 ? 3.6 : 1.4)) {   // round 1 waits for the opening crane shot
 g.phase = 'fight'; g.phaseT = 0; ev(g, {type: 'bell', side: 0, x: 0, power: 1, text: `Round ${g.round}`}); } return; }
  if (g.phase === 'break') { if (g.phaseT > 2.6) nextRound(g); return; }
  if (g.phase === 'over') { for (const f of g.f) f.t += dt; return; }

  g.clock -= dt;
  const [a, b] = g.f;
  for (const f of g.f) {
    f.t += dt; f.invuln = Math.max(0, f.invuln - dt); f.gnpCd -= dt; f.mashCd -= dt; f.sinceHit += dt;
    if (f.rocked > 0) f.rocked = Math.max(0, f.rocked - dt);
    // recovery between exchanges: the head clears (up to its ceiling), the body slowly, the legs barely
    if (f.sinceHit > 1 && f.state !== 'down' && f.state !== 'ko') {
      f.hp = Math.min(f.cap, f.hp + dt * (1.6 + f.stats.cardio / 35) * (f.state === 'bottom' ? .3 : 1));
      f.body = Math.min(100, f.body + dt * .7); f.legs = Math.min(100, f.legs + dt * .12);
    }
  }
  // stamina regen (half while blocking, none while throwing or stuck under a sprawl); a beaten body and a wobble slow it
  for (const f of g.f) if (!['attack', 'shoot', 'sprawled'].includes(f.state)) f.stamina = Math.min(100, f.stamina + dt * (4 + f.stats.cardio / 9) * (f.state === 'block' ? .5 : 1) * (.45 + .55 * f.body / 100) * (f.rocked > 0 ? .5 : 1));

  if (a.state === 'top' || a.state === 'bottom') ground(g, inputs, pressed, dt);
  else {
    // alternate who resolves first each frame so neither corner wins every simultaneous exchange
    const order = Math.round(g.clock * 60) % 2 ? [a, b] : [b, a];
    for (const f of order) standUp(g, f, f.side === 0 ? b : a, inputs[f.side], pressed[f.side], dt);
  }

  if (a.state !== 'top' && a.state !== 'bottom') {
    // keep apart, then turn free fighters to face each other
    const r = rel(a, b);
    if (r.d < MIN_GAP) { const p = (MIN_GAP - r.d) / 2; push(a, -r.ux, -r.uz, p); push(b, r.ux, r.uz, p); }
    for (const [f, o] of [[a, b], [b, a]] as const) if (!busy(f) || f.state === 'stun') { const q = rel(f, o); f.hx = q.ux; f.hz = q.uz; }
  }
  for (const f of g.f) { const d = Math.hypot(f.x, f.z); if (d > CAGE_R) { f.x *= CAGE_R / d; f.z *= CAGE_R / d; } }

  if (g.clock <= 0 && g.phase === 'fight') endRound(g);
}

function standUp(g: LiveFight, f: Fighter, o: Fighter, inp: Input, prs: Input, dt: number) {
  const k = spd(f);
  switch (f.state) {
    case 'idle': case 'walk': case 'block': {
      if (prs.shoot) {
        // never silently ignored: a gassed shot still goes, it's just slow and easy to stuff
        if (f.stamina < 8) ev(g, {type: 'tired', side: f.side, x: f.x, z: f.z, power: .3, text: 'Gassed! Weak shot'});
        setState(f, 'shoot'); f.hitDone = false; f.stamina = Math.max(0, f.stamina - SHOOT.cost); return;
      }
      const m: MoveId | null = prs.jab ? 'jab' : prs.cross ? 'cross' : prs.kick ? 'kick' : prs.upper ? 'upper' : null;
      if (m && f.stamina > 4) { setState(f, 'attack'); f.move = m; f.target = targetFor(m, inp.up, inp.down); f.hitDone = false; f.stamina -= MOVES[m].cost; f.comboKey = m; f.combo = 0; f.thrown += 1; return; }
      if (m) ev(g, {type: 'tired', side: f.side, x: f.x, z: f.z, power: .3, text: 'Out of gas!'});
      if (inp.block) { if (f.state !== 'block') setState(f, 'block'); return; }
      let mx = inp.mx, mz = inp.mz; const ml = Math.hypot(mx, mz);
      if (ml > .05) {
        if (ml > 1) { mx /= ml; mz /= ml; }
        // backing straight up is slower than stepping in or circling
        const r = rel(f, o), along = mx * r.ux + mz * r.uz;
        const v = dt * 2.3 * k * (along < -.5 ? .85 : 1);
        f.x += mx * v; f.z += mz * v;
        if (f.state !== 'walk') setState(f, 'walk');
      } else if (f.state !== 'idle') setState(f, 'idle');
      return;
    }
    case 'attack': {
      const tm = moveTiming(f, f.move!);
      const q: MoveId | null = prs.jab ? 'jab' : prs.cross ? 'cross' : prs.kick ? 'kick' : prs.upper ? 'upper' : null;
      if (q && f.t > tm.start * .5) f.queued = q;
      // hold the button: the fighter flows into that button's combo (jab -> 1-2-hook, kick -> kick-1-2-kick...)
      const seq = f.comboKey ? COMBOS[f.comboKey] : null;
      if (!f.queued && seq && f.hitDone && inp[f.comboKey!] && f.combo + 1 < seq.length) f.queued = seq[f.combo + 1];
      // a little tracking during the wind-up, then the strike is committed to its line
      if (f.t < tm.start * .5) { const r = rel(f, o); f.hx += (r.ux - f.hx) * .2; f.hz += (r.uz - f.hz) * .2; const l = Math.hypot(f.hx, f.hz) || 1; f.hx /= l; f.hz /= l; }
      if (!f.hitDone && f.t >= tm.start) { f.hitDone = true; resolveHit(g, f, o, f.move!); }
      // combo: a strike pressed during this one chains in early, before full recovery
      if (f.queued && f.hitDone && f.t >= tm.start + tm.active + tm.rec * .35 && f.stamina > MOVES[f.queued].cost && f.state === 'attack') {
        const m = f.queued; f.queued = null; f.combo = Math.min(4, f.combo + 1);
        const r = rel(f, o); f.hx = r.ux; f.hz = r.uz;
        setState(f, 'attack'); f.move = m; f.target = targetFor(m, inp.up, inp.down); f.hitDone = false; f.stamina -= MOVES[m].cost; f.thrown += 1; return;
      }
      if (f.state === 'attack' && f.t >= tm.start + tm.active + tm.rec) { setState(f, 'idle'); f.move = null; f.combo = 0; f.queued = null; f.comboKey = null; }
      return;
    }
    case 'shoot': {
      const gassed = f.stamina < 10;
      const s = SHOOT.start / k * (gassed ? 1.4 : 1);
      if (f.t < s) { f.x += f.hx * dt * 2.6; f.z += f.hz * dt * 2.6; }
      if (!f.hitDone && f.t >= s) {
        f.hitDone = true; f.tdAttempts += 1;
        const r = rel(f, o), aligned = f.hx * r.ux + f.hz * r.uz > .7;
        if (r.d <= SHOOT.range && aligned && !['down', 'ko', 'getup', 'sprawled'].includes(o.state)) {
          // a SPRAWL is a block thrown as the shot comes in; a guard held up the whole time barely helps
          // the window is tight: the guard has to come down into the sprawl in the last quarter second (the shot itself takes ~0.3 s)
          const perfect = o.state === 'block' && o.t < .12, early = o.state === 'block' && !perfect && o.t < .25;
          const timedSprawl = perfect || early || o.state === 'sprawl';
          // dead legs can't drive through a shot, and can't sprawl either; a wobbled man is easy to take down
          const chance = .5 + (f.stats.wrestling - o.stats.wrestling) / 120 + (100 - o.stamina) / 450 + (o.state === 'attack' ? .22 : 0) + (o.rocked > 0 ? .2 : 0)
            - (100 - f.legs) / 400 + (100 - o.legs) / 500
            - (timedSprawl ? (perfect ? .22 : .09) * (.55 + .45 * o.stamina / 100) + (o.stats.wrestling - 60) / 300 : 0) - (gassed ? .2 : 0);   // a tired sprawl is a weak sprawl
          if (rand() < chance) { takedown(g, f, o); return; }
          // stuffed: the shooter is stuck on his knees under the sprawl, gassed and open
          setState(o, 'sprawl'); setState(f, 'sprawled');
          f.stamina = Math.max(0, f.stamina - 10); o.points += 3;
          ev(g, {type: 'sprawl', side: o.side, x: o.x, z: o.z, power: .5, text: perfect ? 'PERFECT SPRAWL!' : timedSprawl ? 'Sprawl! Shot stuffed' : 'Takedown stuffed'});
          return;
        }
        ev(g, {type: 'whiff', side: f.side, x: f.x, z: f.z, power: .2, text: 'Shot missed'});
      }
      if (f.t >= s + SHOOT.active + SHOOT.rec / k) { setState(f, 'idle'); f.hitDone = false; }
      return;
    }
    case 'sprawl': if (f.t > .3) setState(f, 'idle'); return;
    case 'sprawled': if (f.t > .8) { setState(f, 'idle'); f.hitDone = false; } return;
    case 'stun': if (f.t > (f.rocked > 0 ? .7 : .34)) setState(f, 'idle'); return;
    case 'down': if (f.t > 1.7) { if (f.hp <= 0) return finish(g, o, 'KO/TKO', g.how); setState(f, 'getup'); } return;
    case 'getup': if (f.t > .5) { setState(f, 'idle'); f.invuln = .5; } return;
    default: return;
  }
}

function resolveHit(g: LiveFight, f: Fighter, o: Fighter, m: MoveId) {
  const d = MOVES[m], tgt = f.target;
  const r = rel(f, o), aligned = f.hx * r.ux + f.hz * r.uz > ALIGN;
  const wx = f.x + f.hx * .8, wz = f.z + f.hz * .8;
  if (!aligned || r.d > d.range || ['down', 'ko', 'getup'].includes(o.state) || o.invuln > 0) { ev(g, {type: 'whiff', side: f.side, x: wx, z: wz, power: .2}); return; }
  // a level change ducks straight punches to the head (uppercuts, knees and kicks still catch a shot)
  if (o.state === 'shoot' && tgt === 'head' && (m === 'jab' || m === 'cross')) { ev(g, {type: 'whiff', side: f.side, x: wx, z: wz, power: .2, text: o.side === 0 || f.side === 0 ? 'Ducked under!' : undefined}); return; }
  // power: the stat, sturdy legs under the shot, and what's left in the tank
  const P = (.55 + f.stats.power / 110) * (.85 + .15 * f.legs / 100);
  const tired = .62 + .38 * f.stamina / 100;
  const base = DMG[m][tgt] * P * tired * (.85 + rand() * .3);
  const hx = (f.x + o.x) / 2, hz = (f.z + o.z) / 2;
  o.sinceHit = 0;
  // blocking only works facing the attacker
  const facingIt = o.hx * -r.ux + o.hz * -r.uz > .3;
  if (o.state === 'block' && facingIt) {
    if (tgt === 'legs') {   // a checked leg kick: shin on shin, the kicker pays too
      o.legs = Math.max(1, o.legs - base * (o.rocked > 0 ? .5 : .22)); f.legs = Math.max(1, f.legs - base * .35);
      ev(g, {type: 'block', side: o.side, x: hx, z: hz, power: base / 12, text: f.side === 0 || o.side === 0 ? 'Checked!' : undefined, target: tgt}); g.hitstop = .04;
      return;
    }
    // a high guard covers the head well, the body badly; a wobbled guard leaks
    const leak = tgt === 'body' ? .5 : o.rocked > 0 ? .45 : .12;
    o.stamina = Math.max(0, o.stamina - base * .85);
    push(o, r.ux, r.uz, d.push * .2); g.hitstop = .03;
    ev(g, {type: 'block', side: o.side, x: hx, z: hz, power: base / 12, target: tgt});
    if (tgt === 'head') { o.hp -= base * leak; o.cap = Math.max(20, o.cap - base * leak * .08); if (o.hp <= 0) knockdown(g, f, o, 'Punches through the guard', 0); }
    else hurtBody(g, f, o, m, base * leak, 1);
    if (o.stamina <= 0 && o.state === 'block') { setState(o, 'stun'); ev(g, {type: 'tired', side: o.side, x: o.x, z: o.z, power: .4, text: 'Guard broken, gassed!'}); }
    return;
  }
  const open = o.state === 'sprawled';          // caught under a stuffed shot
  // walking into a shot doubles up the force: counters are where the big knockouts come from
  const counter = o.state === 'attack' ? 1.3 : open ? 1.2 : 1;
  let dmg = base * counter * (1 + f.combo * .06) * (o.rocked > 0 ? 1.2 : 1);
  f.landed += 1; o.absorbed += dmg;
  push(o, r.ux, r.uz, d.push * (.25 + Math.min(.6, dmg / 30)) * (open ? .3 : 1));   // a snap back, not a shove across the cage
  g.hitstop = dmg > 12 ? .1 : d.heavy ? .075 : .045;
  if (tgt === 'head') {
    f.headLanded += 1; f.points += dmg * .3;
    const chin = 1.3 - o.stats.chin / 170;     // chin 50 = x1.0, chin 90 = x0.77, chin 30 = x1.12
    dmg *= chin;
    const before = o.hp;
    o.hp -= dmg; o.cap = Math.max(20, o.cap - dmg * .1);
    ev(g, {type: 'hit', side: f.side, x: hx, z: hz, power: dmg / 12, text: counter > 1.25 && dmg > 9 ? 'Counter!' : undefined, target: tgt});
    // flash knockout: the chance scales with the spin on the shot, power and chin (squared: force -> acceleration),
    // the counter, and how much damage he's already carrying
    const flash = DMG[m].rot * FLASH * P * P * chin * chin * counter * counter * (1 + (100 - before) / 70) * Math.min(1.6, dmg / 11);
    const how = m === 'kick' ? 'Head kick' : m === 'upper' ? (rand() < .5 ? 'Elbow' : 'Hook') : m === 'cross' ? 'Right hand' : 'Punches';
    if (o.hp <= 0 || rand() < flash) knockdown(g, f, o, counter > 1.25 ? 'Counter ' + how.toLowerCase() : how, Math.max(0, dmg - before) + (o.hp > 0 ? 4 : 0));
    else if (o.rocked <= 0 && ((dmg >= 9 && o.hp < 52) || o.hp < 24)) {
      o.rocked = 1.3 + dmg / 12; o.cap = Math.max(20, o.cap - 4); setState(o, 'stun'); o.move = null;
      ev(g, {type: 'hurt', side: f.side, x: o.x, z: o.z, power: 1, text: 'ROCKED!'});
    } else if (!open) setState(o, 'stun');
  } else if (tgt === 'body') {
    f.bodyLanded += 1; f.points += dmg * .25;
    ev(g, {type: 'hit', side: f.side, x: hx, z: hz, power: dmg / 14, target: tgt});
    hurtBody(g, f, o, m, dmg, counter);
    if (o.state !== 'down' && !open) setState(o, 'stun');
  } else {
    f.legLanded += 1; f.points += dmg * .2;
    o.legs -= dmg;
    ev(g, {type: 'hit', side: f.side, x: hx, z: hz, power: dmg / 16, target: tgt});
    if (o.legs <= 0) {
      o.legDowns += 1; o.kdRound += 1; f.knockdowns += 1; f.points += 8; setState(o, 'down'); o.move = null;
      if (o.legDowns >= 2) { o.hp = 0; g.how = 'Leg kicks'; g.slowmo = 1; ev(g, {type: 'ko', side: f.side, x: o.x, z: o.z, power: 1.6, text: 'HE CAN\'T STAND! TKO!'}); }
      else { o.legs = 24; ev(g, {type: 'kd', side: f.side, x: o.x, z: o.z, power: 1, text: 'The leg gives out!'}); }
    } else if (!open && dmg > 9) setState(o, 'stun');
  }
}

/** body shots: they take the wind (stamina) and fold a man when the pool runs out; liver shots can do it early */
function hurtBody(g: LiveFight, f: Fighter, o: Fighter, m: MoveId, dmg: number, counter: number) {
  o.body -= dmg; o.stamina = Math.max(0, o.stamina - dmg * .9);
  const liver = (m === 'kick' || m === 'upper') && rand() < .002 * counter * (dmg / 7);
  if (o.body > 0 && !liver) return;
  o.kdRound += 1; f.knockdowns += 1; f.points += 12; setState(o, 'down'); o.move = null;
  if (rand() < .3 + (o.kdRound - 1) * .3 + (o.body < -10 ? .2 : 0)) { o.hp = 0; g.how = 'Body shot'; g.slowmo = 1.1; ev(g, {type: 'ko', side: f.side, x: o.x, z: o.z, power: 2, text: 'TO THE BODY! HE FOLDS!'}); }
  else { o.body = 28; o.stamina = Math.min(o.stamina, 18); o.rocked = 2.5; ev(g, {type: 'kd', side: f.side, x: o.x, z: o.z, power: 1.3, text: 'Body shot! He folds!'}); }
}

/** head health gone (or a flash knockdown): down he goes; most of these end the fight */
function knockdown(g: LiveFight, f: Fighter, o: Fighter, how: string, severity: number) {
  o.kdRound += 1; f.knockdowns += 1; f.points += 14; o.cap = Math.max(20, o.cap - 12);
  setState(o, 'down'); o.move = null;
  const p = .3 + severity / 30 + (f.stats.power - o.stats.chin) / 220 + (o.kdRound - 1) * .35 + (o.cap < 45 ? .18 : 0);
  if (severity > 10 || o.kdRound >= 3 || rand() < p) {
    o.hp = 0; g.how = how; g.slowmo = 1.1;
    ev(g, {type: 'ko', side: f.side, x: o.x, z: o.z, power: 2, text: severity > 10 ? 'LIGHTS OUT!' : 'KNOCKOUT!'});
  } else {
    o.hp = Math.max(o.cap * .45, 18); o.rocked = 3.5;
    ev(g, {type: 'kd', side: f.side, x: o.x, z: o.z, power: 1.4, text: 'Knockdown!'});
  }
}

function takedown(g: LiveFight, f: Fighter, o: Fighter) {
  f.takedowns += 1; f.points += 6;   // judges reward the takedown itself
  setState(f, 'top'); setState(o, 'bottom'); f.move = null; o.move = null;
  o.x = f.x + f.hx * .55; o.z = f.z + f.hz * .55; o.hx = -f.hx; o.hz = -f.hz; o.escape = 0; f.sub = 0;
  ev(g, {type: 'td', side: f.side, x: o.x, z: o.z, power: 1, text: 'Takedown!'});
}

// Ground game: two plain mashing contests the player can read off the HUD meters.
//  - Bottom fighter mashes to fill ESCAPE (top control and ground-and-pound push it back).
//  - Top fighter starts a SUBMISSION (kick key), then mashes to crank it; the bottom fighter mashes to defend.
//    Defending also builds escape, and a failed attempt gives the bottom fighter a big escape bonus.
// Mash rates: a human hammering a key ~6-8/s; AI rates scale with difficulty (see aiInput).
function ground(g: LiveFight, inputs: [Input, Input], pressed: [Input, Input], dt: number) {
  const top = g.f[0].state === 'top' ? g.f[0] : g.f[1], bot = top.side === 0 ? g.f[1] : g.f[0];
  const tp = pressed[top.side], bp = pressed[bot.side];
  const mash = bp.jab || bp.cross || bp.kick || bp.upper || bp.shoot || bp.block;
  const grapEdge = (top.stats.grappling - bot.stats.grappling) / 400;
  if (top.sub > 0) {
    // submission battle
    const crank = tp.jab || tp.cross || tp.upper || tp.kick;
    top.sub += dt * Math.max(.05, .16 + grapEdge) * (.75 + .25 * (1 - bot.stamina / 100));
    if (crank) top.sub += .04 + top.stats.grappling / 4000;
    if (mash) { top.sub -= .045 + bot.stats.grappling / 4000; bot.escape += .015; bot.stamina = Math.max(0, bot.stamina - .6); }
    if (top.sub >= 1) { ev(g, {type: 'tap', side: top.side, x: bot.x, z: bot.z, power: 2, text: 'TAP OUT!'}); return finish(g, top, 'SUB', g.how); }
    top.subClock += dt;
    if (top.sub <= 0 || top.subClock > 6) {
      top.sub = 0; top.mashCd = 3; bot.escape += .3;
      ev(g, {type: 'escape', side: bot.side, x: bot.x, z: bot.z, power: .6, text: 'Submission defended!'});
    }
  } else {
    if (mash) bot.escape += .028 + bot.stats.wrestling / 3500 + bot.stats.grappling / 6000;
    bot.escape += dt * .05;
    bot.escape -= dt * (.04 + top.stats.wrestling / 2000);
    if ((tp.jab || tp.cross || tp.upper) && top.gnpCd <= 0) {
      top.gnpCd = .42 / spd(top);
      // ground and pound: short shots from top, partly covered up, but they add up and the head barely recovers down there
      const dmg = 2.5 * (.55 + top.stats.power / 110) * (1.3 - bot.stats.chin / 170) * (.8 + rand() * .4) * (.62 + .38 * top.stamina / 100);
      bot.hp -= dmg; bot.cap = Math.max(20, bot.cap - dmg * .08); bot.sinceHit = 0; bot.absorbed += dmg;
      top.points += dmg * .3; top.landed += 1; top.thrown += 1; top.headLanded += 1; top.stamina -= 2.5; bot.escape -= .04;
      ev(g, {type: 'hit', side: top.side, x: bot.x, z: bot.z, power: dmg / 8, target: 'head'});
      if (bot.hp <= 0) { g.slowmo = 1; ev(g, {type: 'ko', side: top.side, x: bot.x, z: bot.z, power: 2, text: 'TKO! Ref stops it'}); return finish(g, top, 'KO/TKO', 'Ground and pound'); }
    }
    if (tp.kick && top.stamina > 20 && top.mashCd <= 0) {
      top.sub = .2; top.subClock = 0; top.stamina -= 12;
      const name = ['Rear-naked choke', 'Armbar', 'Guillotine', 'Kimura', 'Arm-triangle'][Math.floor(rand() * 5)];
      g.how = name;
      ev(g, {type: 'sub', side: top.side, x: bot.x, z: bot.z, power: 1, text: name + '!'});
    }
  }
  bot.escape = Math.max(0, bot.escape);
  top.points += dt * 1.4; top.ctrl += dt;   // control on top
  if (bot.escape >= 1) {
    setState(top, 'idle'); setState(bot, 'getup'); top.sub = 0; bot.escape = 0;
    const r = rel(top, bot); bot.x = top.x + r.ux * 1.05; bot.z = top.z + r.uz * 1.05;
    ev(g, {type: 'escape', side: bot.side, x: bot.x, z: bot.z, power: .6, text: 'Back to the feet'});
  }
}
function finish(g: LiveFight, winner: Fighter, method: 'KO/TKO' | 'SUB', how?: string) {
  const loser = winner.side === 0 ? g.f[1] : g.f[0];
  setState(loser, 'ko'); setState(winner, 'win');
  g.phase = 'over'; g.phaseT = 0;
  g.result = {winner: winner.side, method, round: g.round, how, time: Math.max(0, ROUND_SECONDS - g.clock)};
}

function endRound(g: LiveFight) {
  const [a, b] = g.f;
  for (const card of g.cards) {
    const n = (rand() - .5) * 6;
    const aWin = a.points + n > b.points;
    const wide = Math.abs(a.points - b.points) > 40 || a.kdRound >= 2 || b.kdRound >= 2;
    card[0] += aWin ? 10 : wide ? 8 : 9; card[1] += aWin ? (wide ? 8 : 9) : 10;
  }
  ev(g, {type: 'bell', side: 0, x: 0, power: 1, text: `End of round ${g.round}`});
  if (g.round >= g.rounds) {
    const votes = g.cards.map(([x, y]) => Math.sign(x - y));
    const sum = votes.reduce((s, v) => s + v, 0);
    const winner = sum > 0 ? 0 : sum < 0 ? 1 : -1;
    const split = winner !== -1 && votes.some(v => v !== Math.sign(sum));
    g.phase = 'over'; g.phaseT = 0;
    g.result = {winner, method: winner === -1 ? 'DRAW' : split ? 'SPLIT DEC' : 'DEC', round: g.round};
    if (winner !== -1) { setState(g.f[winner], 'win'); setState(g.f[winner === 0 ? 1 : 0], 'idle'); }
    return;
  }
  g.phase = 'break'; g.phaseT = 0;
}

function nextRound(g: LiveFight) {
  g.round += 1; g.clock = ROUND_SECONDS; g.phase = 'intro'; g.phaseT = 0;
  // the minute in the corner: the head clears to its (lowered) ceiling, a little comes back to the body and legs
  g.f.forEach((f, i) => { f.points = 0; f.kdRound = 0; f.x = i === 0 ? -1.6 : 1.6; f.z = 0; f.hx = i === 0 ? 1 : -1; f.hz = 0; setState(f, 'idle');
    f.stamina = Math.min(100, f.stamina + 35 * f.stats.cardio / 100 + 20); f.cap = Math.min(100, f.cap + 4); f.hp = f.cap; f.body = Math.min(100, f.body + 25); f.legs = Math.min(100, f.legs + 14); f.rocked = 0; f.sub = 0; f.escape = 0; });
}

/* -------------------------------------------------------------------- AI */
type Move = 'toward' | 'away' | 'circleL' | 'circleR' | null;
export type AIBrain = {react: number; plan: number; want: Partial<Input> & {move?: Move}; level: number; chain: MoveId | null; jitter: number; circleDir: 1 | -1; shotCd: number};
export const makeBrain = (level: number): AIBrain => ({react: 0, plan: 0, want: {}, level, chain: null, jitter: 0, circleDir: Math.random() < .5 ? 1 : -1, shotCd: 2});

/** turn a movement intent into a world vector, steering off the fence */
function steer(me: Fighter, them: Fighter, move: Move): [number, number] {
  if (!move) return [0, 0];
  const r = rel(me, them);
  let mx = 0, mz = 0;
  if (move === 'toward') { mx = r.ux; mz = r.uz; }
  else if (move === 'away') { mx = -r.ux; mz = -r.uz; }
  else { const s = move === 'circleL' ? 1 : -1; mx = -r.uz * s + r.ux * .15; mz = r.ux * s + r.uz * .15; }
  // near the cage: slide along it toward the centre instead of backing into it
  const d = Math.hypot(me.x, me.z);
  if (d > CAGE_R - .9) { const out = (mx * me.x + mz * me.z) / d; if (out > 0) { mx -= me.x / d * out * 1.4; mz -= me.z / d * out * 1.4; mx += -me.z / d * .6 * Math.sign(-me.z * mx + me.x * mz || 1); } }
  const l = Math.hypot(mx, mz) || 1;
  return [mx / l, mz / l];
}

/** where the AI aims: real fight data puts ~64% of significant strikes at the head, ~21% body, ~17% legs */
function aim(held: Input, pressed: Input, me: Fighter, them: Fighter) {
  held.up = false; held.down = false;
  const r = rand();
  if (pressed.kick) { if (r < .4 - (them.legs < 40 ? -.15 : 0)) held.down = true; else if (r > .76 - (them.rocked > 0 ? .2 : 0)) held.up = true; }
  else if (pressed.cross || pressed.upper) { if (r < .2 + (them.body < 45 ? .15 : 0)) held.down = true; }
  void me;
}

export function aiInput(g: LiveFight, me: Fighter, them: Fighter, brain: AIBrain): {held: Input; pressed: Input} {
  const held = {...NO_INPUT}, pressed = {...NO_INPUT};
  if (g.phase !== 'fight') return {held, pressed};
  brain.react -= DT; brain.plan -= DT; brain.shotCd -= DT;
  const lvl = brain.level; // 0..1
  // ground mashing: a hard-mashing human is ~6-8 presses/s; Normal AI ~4/s, more when fighting off a submission
  // (an AI on its back escapes in ~10 s against good top pressure; a human mashing hard gets out in ~4-5 s)
  if (me.state === 'bottom') { if (rand() < (them.sub > 0 ? (.03 + lvl * .05) * 1.4 : .035 + lvl * .05)) pressed.jab = true; return {held, pressed}; }
  if (me.state === 'top') {
    // set it up first: a few seconds of top control and ground and pound before hunting the submission
    if (me.sub === 0 && brain.plan <= 0) { brain.plan = 1.2; if (me.t > 4 && me.stats.grappling > 55 && them.hp < 85 && rand() < .15 + lvl * .15) pressed.kick = true; }
    // ground and pound ~2/s; while a submission is on, crank it (Normal ~3 presses/s)
    if (rand() < (me.sub > 0 ? .026 + lvl * .065 : .12 + lvl * .1)) pressed.jab = true;
    return {held, pressed};
  }
  const dist = rel(me, them).d;
  const ideal = me.style === 'Striker' ? 1.1 : 1.04;   // inside its own jab range (1.18)
  const grappler = me.style === 'Wrestler' || me.style === 'Grappler';
  const out = (h: Input, p: Input) => { if (p.shoot) brain.shotCd = 4.2 - lvl * 1.6; const [mx, mz] = steer(me, them, brain.want.move ?? null); h.mx = mx; h.mz = mz; h.block = !!brain.want.block; aim(h, p, me, them); return {held: h, pressed: p}; };
  // a stuffed shooter stuck under a sprawl: free shots
  if (them.state === 'sprawled' && dist < 1.25 && me.state !== 'attack' && brain.react <= 0) {
    brain.react = .25; if (rand() < .3 + lvl * .5) { pressed[rand() < .5 ? 'cross' : 'upper'] = true; return out(held, pressed); }
  }
  // hurt: cover up and get out of there (better AIs survive smarter)
  if (me.rocked > 0 && brain.plan <= 0) { brain.plan = .3; brain.want = rand() < .45 + lvl * .25 ? {block: true} : {move: rand() < .6 ? 'away' : brain.circleDir === 1 ? 'circleL' : 'circleR'}; return out(held, pressed); }
  // he's hurt: swarm him
  if (them.rocked > 0 && dist < 1.3 && me.state !== 'attack' && brain.react <= 0 && me.stamina > 15) {
    brain.react = .18 - lvl * .08;
    if (rand() < .35 + lvl * .4) { pressed[rand() < .45 ? 'cross' : rand() < .6 ? 'upper' : 'kick'] = true; brain.chain = rand() < .6 ? 'upper' : 'cross'; return out(held, pressed); }
  }
  // punish: once their strike has gone (whiffed or landed) they're stuck recovering - better AIs counter right there
  if (them.state === 'attack' && them.hitDone && dist < 1.2 && brain.react <= 0 && me.state !== 'attack' && me.state !== 'stun') {
    brain.react = .4;
    if (rand() < .02 + lvl * .6) { pressed[rand() < .55 ? 'cross' : 'jab'] = true; brain.want = {}; return out(held, pressed); }
  }
  // wrestlers level-change under punches: shoot while the opponent is committed to a strike
  if (grappler && brain.shotCd <= 0 && them.state === 'attack' && !them.hitDone && dist < 1.3 && brain.react <= 0 && me.state !== 'attack' && me.stamina > 30) {
    brain.react = .5;
    if (rand() < .02 + lvl * .03) { pressed.shoot = true; return out(held, pressed); }
  }
  // defend: react to an incoming attack (human reaction time: ~0.1-0.2 s before the AI can respond)
  if (them.state === 'attack' || them.state === 'shoot') {
    if (brain.react <= 0 && them.t >= .21 - lvl * .14 + brain.jitter) {
      brain.react = .35 - lvl * .2; brain.jitter = rand() * .08;
      const defend = them.state === 'shoot' ? .15 + lvl * .4 + (me.style === 'Striker' ? .2 : 0) : .15 + lvl * .45;   // strikers drill takedown defence
      // block, or slip off the line (circle), or back out
      brain.want = rand() < defend ? {block: true} : rand() < .25 + lvl * .2 ? {move: rand() < .5 ? 'circleL' : 'circleR'} : rand() < .3 ? {move: 'away'} : {};
    }
  } else if (brain.plan <= 0) {
    brain.plan = .2 + (1 - lvl) * .22 + rand() * (.42 - lvl * .24);   // easier AIs think (and throw) less often
    brain.want = {};
    if (rand() < .04) brain.circleDir = brain.circleDir === 1 ? -1 : 1;
    const circle: Move = brain.circleDir === 1 ? 'circleL' : 'circleR';
    if (me.stamina < 25) brain.want = {move: rand() < .5 ? 'away' : circle, block: rand() < .5};
    else if (dist > ideal + .14) brain.want = {move: rand() < .8 ? 'toward' : circle};
    else if (dist < ideal - .5 && me.style === 'Striker' && rand() < .35) brain.want = {move: 'away'};
    else {
      const r = rand();
      if (grappler && brain.shotCd <= 0 && r < .08 + (them.stamina < 50 ? .05 : 0) && dist < 1.35 && g.clock < ROUND_SECONDS - 5) brain.want = {shoot: true};
      else if (them.state === 'block' && r < .55) brain.want = rand() < .55 ? {kick: true} : rand() < .5 && grappler && brain.shotCd <= 0 ? {shoot: true} : {cross: true};   // break a shell
      else if (r < .42) brain.want = {jab: true};
      else if (r < .6) brain.want = {cross: true};
      else if (r < .7) brain.want = {kick: true};
      else if (r < .76 && dist < 1.08) brain.want = {upper: true};
      else if (r < .84) brain.want = {move: circle};           // circle / angle off
      else if (r < .9) brain.want = {block: true};
      else brain.want = {move: 'away'};
    }
    // never throw from outside the strike's reach: close the distance instead
    for (const k of ['jab', 'cross', 'kick', 'upper'] as const) if (brain.want[k] && dist > MOVES[k].range * .97) brain.want = {move: 'toward'};
    for (const k of ['jab', 'cross', 'kick', 'upper', 'shoot'] as const) if (brain.want[k]) { pressed[k] = true; brain.want[k] = false; }
    if ((pressed.jab || pressed.cross) && rand() < .35 + lvl * .35) brain.chain = rand() < .5 ? 'cross' : rand() < .5 ? 'kick' : 'upper';
  }
  if (brain.chain && me.state === 'attack' && me.hitDone) { pressed[brain.chain] = true; brain.chain = null; }
  return out(held, pressed);
}
