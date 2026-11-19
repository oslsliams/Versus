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
export type FState = 'idle' | 'walk' | 'attack' | 'block' | 'stun' | 'down' | 'getup' | 'shoot' | 'sprawl' | 'sprawled' | 'top' | 'bottom' | 'clinch' | 'ko' | 'win';
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
/** knockout tuning: dmg scales every clean head shot, kdKo is the base chance a knockdown ends it, kdSev how far past zero is lights out */
// tuned on AI-vs-AI matchups with real skill gaps to UFC-like results: ~32% KO/TKO, ~20% submissions, ~48% decisions
export const KO = {dmg: .86, kdKo: .3, kdSev: 10, rec: 1.1, corner: 12};
export const __tune = (k: {flash?: number} & Partial<typeof KO>) => { if (k.flash != null) FLASH = k.flash; Object.assign(KO, {...k, flash: undefined}); delete (KO as any).flash; };
/** what each strike can aim at */
export const targetFor = (m: MoveId, up: boolean, down: boolean): Target => m === 'kick' ? (up ? 'head' : down ? 'legs' : 'body') : down ? 'body' : 'head';
// hold-to-combo strings, by the button held (classic MMA combinations; 'upper' plays hooks/uppercuts/elbows)
const COMBOS: Record<MoveId, MoveId[]> = {jab: ['jab', 'jab', 'cross', 'upper'], cross: ['cross', 'upper', 'cross', 'kick'], kick: ['kick', 'jab', 'cross', 'kick'], upper: ['upper', 'cross', 'upper']};
const SHOOT = {start: .26, active: .16, rec: .45, range: 1.4, cost: 12};
export const ROUND_SECONDS = 90;
/** player fight settings (set before a fight starts): stamina drain, health regeneration between exchanges,
 *  doctor stoppages, round length, and multipliers on damage and cuts (applied over the tuned defaults) */
export const FX = {stamina: 1, regen: true, doctor: true, roundSec: ROUND_SECONDS, damage: 1, cuts: 1};
const KO_BASE = {dmg: .86}, CUT_BASE = {base: .006, sharp: .026};
export function applyFX(k: Partial<typeof FX>) { Object.assign(FX, k); KO.dmg = KO_BASE.dmg * FX.damage; CUT.base = CUT_BASE.base * FX.cuts; CUT.sharp = CUT_BASE.sharp * FX.cuts; }
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
  /** 0-100: how bad the cut on his face is; the doctor looks at it when it passes cutAt */
  cut: number; cutAt: number;
  /** which way the last shot was driven (W double, A / D single leg) */
  shotDir?: GDir;
};
export type FightEvent = {type: 'hit' | 'block' | 'whiff' | 'kd' | 'ko' | 'td' | 'sprawl' | 'sub' | 'escape' | 'tap' | 'bell' | 'tired' | 'hurt' | 'trans' | 'deny' | 'cut' | 'doctor'; side: 0 | 1; x: number; z: number; power: number; text?: string; target?: Target};
export type Phase = 'intro' | 'fight' | 'break' | 'over' | 'doctor';
export type LiveFight = {
  f: [Fighter, Fighter]; round: number; rounds: number; clock: number; phase: Phase; phaseT: number;
  slowmo: number; hitstop: number; events: FightEvent[]; cards: [number, number][]; seed: number;
  result: null | {winner: 0 | 1 | -1; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; how?: string; time?: number};
  /** how the pending stoppage happened (set when a knockdown is waved off, read when he hits the floor) */
  how?: string;
  /** the grappling exchange in progress (clinch, takedown drive, or a ground position), null on the feet */
  grap: Grapple | null;
  /** a stuffed shot leaves his head hanging: the sprawler has a moment to grab a guillotine */
  fh: {by: 0 | 1; t: number} | null;
  /** seconds in a round for this fight */
  secs: number;
  /** a doctor check waiting for a break in the action, and the one in progress */
  docDue?: 0 | 1 | null; doc?: 0 | 1 | null;
};

let seedState = 1;
const rand = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; };

export function createFight(a: {name: string; color: string; style: Style; stats: Stats; cut?: number}, b: {name: string; color: string; style: Style; stats: Stats; cut?: number}, rounds: number, seed = Date.now()): LiveFight {
  seedState = seed >>> 0 || 1;
  const mk = (p: typeof a, side: 0 | 1, x: number): Fighter => ({...p, side, x, z: 0, hx: side === 0 ? 1 : -1, hz: 0, state: 'idle', t: 0, move: null, hitDone: false,
    hp: 100, cap: 100, body: 100, legs: 100, rocked: 0, sinceHit: 9, target: 'head', legDowns: 0,
    stamina: 100, kdRound: 0, invuln: 0, queued: null, combo: 0, escape: 0, sub: 0, subClock: 0, gnpCd: 0, mashCd: 0, landed: 0, points: 0, takedowns: 0, knockdowns: 0,
    comboKey: null, thrown: 0, tdAttempts: 0, ctrl: 0, headLanded: 0, bodyLanded: 0, legLanded: 0, absorbed: 0, cut: Math.max(0, Math.min(60, p.cut ?? 0)), cutAt: Math.max(62, (p.cut ?? 0) + 18)});
  return {f: [mk(a, 0, -1.6), mk(b, 1, 1.6)], round: 1, rounds, clock: FX.roundSec, secs: FX.roundSec, phase: 'intro', phaseT: 0, slowmo: 0, hitstop: 0, events: [], cards: [[0, 0], [0, 0], [0, 0]], seed, result: null, grap: null, fh: null};
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
  if (g.phase === 'doctor') { doctorLook(g); return; }
  if (g.phase === 'over') { for (const f of g.f) f.t += dt; return; }

  g.clock -= dt;
  const [a, b] = g.f;
  for (const f of g.f) {
    f.t += dt; f.invuln = Math.max(0, f.invuln - dt); f.gnpCd -= dt; f.mashCd -= dt; f.sinceHit += dt;
    if (f.rocked > 0) f.rocked = Math.max(0, f.rocked - dt);
    // recovery between exchanges: the head clears (up to its ceiling), the body slowly, the legs barely
    if (FX.regen && f.sinceHit > 1 && f.state !== 'down' && f.state !== 'ko') {
      f.hp = Math.min(f.cap, f.hp + dt * (1.6 + f.stats.cardio / 35) * KO.rec * (f.state === 'bottom' ? .3 : 1));
      f.body = Math.min(100, f.body + dt * .7); f.legs = Math.min(100, f.legs + dt * .12);
    }
  }
  // stamina regen (half while blocking, none while throwing or stuck under a sprawl); a beaten body and a wobble slow it
  for (const f of g.f) if (!['attack', 'shoot', 'sprawled'].includes(f.state)) f.stamina = Math.min(100, f.stamina + dt * (4 + f.stats.cardio / 9) * (f.state === 'block' ? .5 : 1) * (.45 + .55 * f.body / 100) * (f.rocked > 0 ? .5 : 1) / FX.stamina);

  // a stuffed shot: grab the neck before he gets his head out
  if (g.fh) {
    g.fh.t -= dt; const by = g.f[g.fh.by], o = g.f[g.fh.by ? 0 : 1];
    if (pressed[g.fh.by].kick && o.state === 'sprawled' && by.stamina > 12) { const s = g.fh.by; startGrapple(g, 'clinch', s); beginSub(g, s, 'Guillotine'); }
    else if (g.fh.t <= 0) g.fh = null;
  }
  if (g.grap) grapple(g, inputs, pressed, dt);
  else {
    // alternate who resolves first each frame so neither corner wins every simultaneous exchange
    const order = Math.round(g.clock * 60) % 2 ? [a, b] : [b, a];
    for (const f of order) standUp(g, f, f.side === 0 ? b : a, inputs[f.side], pressed[f.side], dt);
  }

  if (!g.grap) {
    // keep apart, then turn free fighters to face each other
    const r = rel(a, b);
    if (r.d < MIN_GAP) { const p = (MIN_GAP - r.d) / 2; push(a, -r.ux, -r.uz, p); push(b, r.ux, r.uz, p); }
    for (const [f, o] of [[a, b], [b, a]] as const) if (!busy(f) || f.state === 'stun') { const q = rel(f, o); f.hx = q.ux; f.hz = q.uz; }
  }
  for (const f of g.f) { const d = Math.hypot(f.x, f.z); if (d > CAGE_R) { f.x *= CAGE_R / d; f.z *= CAGE_R / d; } }

  if (g.docDue != null && !FX.doctor) g.docDue = null;
  if (g.docDue != null && g.phase === 'fight' && !g.f.some(f => f.state === 'down' || f.state === 'ko')) callDoctor(g);
  if (g.clock <= 0 && g.phase === 'fight') endRound(g);
}

function standUp(g: LiveFight, f: Fighter, o: Fighter, inp: Input, prs: Input, dt: number) {
  const k = spd(f);
  switch (f.state) {
    case 'idle': case 'walk': case 'block': {
      if (prs.shoot && o.state === 'down' && o.hp > 0 && distance(f, o) < 1.8) {
        // he's on the canvas: jump on him before he gets back up and finish it on the ground
        f.stamina = Math.max(0, f.stamina - 6); f.points += 4;
        startGrapple(g, rand() < .5 ? 'side' : 'half', f.side); o.rocked = Math.max(o.rocked, 1.5);
        ev(g, {type: 'td', side: f.side, x: o.x, z: o.z, power: .9, text: 'He jumps on him!'}); return;
      }
      if (prs.shoot && distance(f, o) < .98 && ['idle', 'walk', 'block', 'attack', 'stun'].includes(o.state)) {
        // in close: tie him up
        if (f.stamina < 6) { ev(g, {type: 'tired', side: f.side, x: f.x, z: f.z, power: .3, text: 'Too tired to clinch'}); return; }
        f.stamina -= 4; startGrapple(g, 'clinch', f.side); ev(g, {type: 'trans', side: f.side, x: f.x, z: f.z, power: .4, text: 'Clinch!'}); return;
      }
      if (prs.shoot) {
        f.shotDir = dirOf(inp) ?? 'W';
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
          if (!perfect) { startDrive(g, f, o, Math.min(.95, chance + (early ? -.12 : 0)), f.side === 0 ? (f.shotDir === 'A' || f.shotDir === 'D' ? f.shotDir : 'W') : (['W', 'A', 'D'] as GDir[])[Math.floor(rand() * 3)]); return; }
          // stuffed: the shooter is stuck on his knees under the sprawl, gassed and open
          setState(o, 'sprawl'); setState(f, 'sprawled');
          f.stamina = Math.max(0, f.stamina - 10); o.points += 3;
          ev(g, {type: 'sprawl', side: o.side, x: o.x, z: o.z, power: .5, text: 'PERFECT SPRAWL! Front headlock'}); g.fh = {by: o.side, t: .85};
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
    dmg *= chin * KO.dmg;
    const before = o.hp;
    o.hp -= dmg; o.cap = Math.max(20, o.cap - dmg * .1);
    cutCheck(g, f, o, m === 'upper' ? .5 : m === 'kick' ? .3 : 0, dmg);
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
  const p = KO.kdKo + severity / 30 + (f.stats.power - o.stats.chin) / 220 + (o.kdRound - 1) * .35 + (o.cap < 45 ? .18 : 0);
  if (severity > KO.kdSev || o.kdRound >= 3 || rand() < p) {
    o.hp = 0; g.how = how; g.slowmo = 1.1;
    ev(g, {type: 'ko', side: f.side, x: o.x, z: o.z, power: 2, text: severity > 10 ? 'LIGHTS OUT!' : 'KNOCKOUT!'});
  } else {
    o.hp = Math.max(o.cap * .45, 18); o.rocked = 3.5;
    ev(g, {type: 'kd', side: f.side, x: o.x, z: o.z, power: 1.4, text: f.side === 0 ? 'Knockdown! SPACE to jump on him' : 'Knockdown!'});
  }
}

/** cuts: elbows and head kicks slice, a cut that's open gets worse with every shot that lands on it */
function cutCheck(g: LiveFight, f: Fighter, o: Fighter, sharp: number, dmg: number) {
  if (o.hp <= 0 || dmg < 4.5) return;
  const before = o.cut;
  if (o.cut > 0) o.cut = Math.min(100, o.cut + dmg * (.12 + sharp * .22));
  const p = (CUT.base + sharp * CUT.sharp) * dmg / 9 * (o.cut > 0 ? 1.7 : 1);
  if (rand() < p) o.cut = Math.min(100, o.cut + 10 + sharp * 10 + dmg * .7 + (o.cut === 0 ? 5 : 0));
  if (o.cut === before) return;
  const step = Math.floor(o.cut / 25) > Math.floor(before / 25) || before === 0;
  if (step) ev(g, {type: 'cut', side: f.side, x: o.x, z: o.z, power: o.cut / 100, text: before === 0 ? 'Cut opened!' : o.cut >= 60 ? 'That cut is bad' : 'The cut is worse'});
  if (o.cut >= o.cutAt && g.docDue == null) { g.docDue = o.side; o.cutAt = o.cut + 15; }
}
export const CUT = {base: .006, sharp: .026, stop: 42};
export const __tuneCut = (k: Partial<typeof CUT>) => Object.assign(CUT, k);

/** the referee stops the action and the doctor looks at the cut */
function callDoctor(g: LiveFight) {
  const side = g.docDue!; g.docDue = null; g.doc = side; g.grap = null; g.fh = null;
  g.phase = 'doctor'; g.phaseT = 0;
  const o = g.f[side], f = g.f[side ? 0 : 1];
  for (const x of g.f) { setState(x, 'idle'); x.move = null; x.queued = null; x.sub = 0; x.escape = 0; }
  // he gets sent to the neutral side, the doctor works on the cut man where he stands
  const r = rel(o, f); if (r.d < 2.2) { f.x = o.x + r.ux * 2.2; f.z = o.z + r.uz * 2.2; }
  ev(g, {type: 'doctor', side, x: o.x, z: o.z, power: 0, text: 'Time! The doctor checks the cut'});
}
function doctorLook(g: LiveFight) {
  if (g.phaseT < 3) return;
  const side = g.doc!, o = g.f[side], f = g.f[side ? 0 : 1]; g.doc = null;
  const p = Math.max(.04, Math.min(.85, (o.cut - 50) / CUT.stop)) * (g.round === 1 ? 1.15 : 1);
  if (rand() < p) {
    g.slowmo = .6; ev(g, {type: 'doctor', side, x: o.x, z: o.z, power: 2, text: 'THE DOCTOR STOPS IT!'});
    finish(g, f, 'KO/TKO', 'Doctor stoppage'); return;
  }
  g.phase = 'fight'; g.phaseT = 0;
  ev(g, {type: 'doctor', side, x: o.x, z: o.z, power: 1, text: 'He can continue!'});
}

function finish(g: LiveFight, winner: Fighter, method: 'KO/TKO' | 'SUB', how?: string) {
  const loser = winner.side === 0 ? g.f[1] : g.f[0];
  setState(loser, 'ko'); setState(winner, 'win');
  g.phase = 'over'; g.phaseT = 0; g.grap = null; g.fh = null;
  g.result = {winner: winner.side, method, round: g.round, how, time: Math.max(0, g.secs - g.clock)};
}

function endRound(g: LiveFight) {
  const [a, b] = g.f;
  // knockdowns are what judges remember: one usually wins the round on its own, two (or one plus a beating) is a 10-8
  const kd = b.kdRound - a.kdRound;   // kdRound counts the times each man was dropped this round
  for (const card of g.cards) {
    const n = (rand() - .5) * 6;
    const score = a.points - b.points + kd * 30 + n;
    const aWin = score > 0, margin = Math.abs(score);
    // a 10-8 never goes to the man who got dropped
    const wide = (Math.abs(kd) >= 2 || (Math.abs(kd) >= 1 && margin > 45) || margin > 55) && (kd === 0 || Math.sign(kd) === Math.sign(score));
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
  g.grap = null; g.fh = null; g.docDue = null;
  g.round += 1; g.clock = g.secs; g.phase = 'intro'; g.phaseT = 0;
  // the minute in the corner: the head clears to its (lowered) ceiling, a little comes back to the body and legs
  g.f.forEach((f, i) => { f.points = 0; f.kdRound = 0; f.x = i === 0 ? -1.6 : 1.6; f.z = 0; f.hx = i === 0 ? 1 : -1; f.hz = 0; setState(f, 'idle');
    f.stamina = Math.min(100, f.stamina + 35 * f.stats.cardio / 100 + 20); f.cap = Math.min(100, f.cap + KO.corner); f.hp = f.cap; f.body = Math.min(100, f.body + 25); f.legs = Math.min(100, f.legs + 14); f.rocked = 0; f.sub = 0; f.escape = 0; if (f.cut > 0) f.cut = Math.max(8, f.cut - 7); });   // the cutman closes it a little
}

/* -------------------------------------------------------------------- AI */
type Move = 'toward' | 'away' | 'circleL' | 'circleR' | null;
export type AIBrain = {react: number; plan: number; want: Partial<Input> & {move?: Move}; level: number; chain: MoveId | null; jitter: number; circleDir: 1 | -1; shotCd: number; decided?: number; subDir?: number};
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
  if (g.grap) return aiGrapple(g, me, them, brain);
  // a stuffed shot right in front of him: grab the neck
  if (g.fh && g.fh.by === me.side && them.state === 'sprawled' && rand() < .02 + lvl * .04 * (me.stats.grappling / 70)) { pressed.kick = true; return {held, pressed}; }
  const dist = rel(me, them).d;
  const ideal = me.style === 'Striker' ? 1.1 : 1.04;   // inside its own jab range (1.18)
  const grappler = me.style === 'Wrestler' || me.style === 'Grappler';
  const out = (h: Input, p: Input) => { if (p.shoot) brain.shotCd = 7 - lvl * 2; const [mx, mz] = steer(me, them, brain.want.move ?? null); h.mx = mx; h.mz = mz; h.block = !!brain.want.block; aim(h, p, me, them); return {held: h, pressed: p}; };
  // a stuffed shooter stuck under a sprawl: free shots
  // he's been dropped: pounce on him (grapplers almost always do)
  if (them.state === 'down' && them.hp > 0 && dist < 1.8 && me.state !== 'attack' && rand() < .03 + lvl * .05 + (grappler ? .05 : 0)) { pressed.shoot = true; return out(held, pressed); }
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
    if (rand() < .012 + lvl * .02) { pressed.shoot = true; return out(held, pressed); }
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
      if (grappler && brain.shotCd <= 0 && r < .05 + (them.stamina < 50 ? .04 : 0) && dist < 1.35 && g.clock < g.secs - 5) brain.want = {shoot: true};
      else if (brain.shotCd <= 0 && dist < .98 && r < (grappler ? .06 : .02)) brain.want = {shoot: true};
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

/* ================================================================ grappling */
// Real MMA grappling is a fight for position, so this is too. Five ground positions in their real order
// (guard < half guard < side control < mount < back), plus the clinch and the takedown drive.
//  - Every position change is a READ: the attacker commits to a direction (W / A / D / S + the grapple button) and
//    the defender has one guess to match it before the window closes. A better grappler hides his intention longer
//    (the arrow shows up later for a human defender, and an AI defender reads it less often). A correct read
//    denies the move and builds that fighter's momentum (faster moves next); nobody can deny on an empty tank.
//  - Submissions are a BAR CHASE (the way EA's UFC games do it): the defender has a bar on a track, the attacker
//    has a bar that hunts it. Every moment the attacker's bar covers his fills the submission meter; every moment
//    he's free fills his escape meter. Damage, a lowered ceiling and an empty tank all make the defender's bar
//    BIGGER (easier to catch); grappling skill makes your own bar faster. Joint locks run on an arc with ends,
//    chokes run round a full circle (nowhere to hide) and drain his stamina while they're on. Strikes during a
//    submission widen your bar for a moment.
//    Which submission depends on the position: rear-naked choke from the back, armbar or arm-triangle from mount,
//    triangle or armbar from guard, kimura from half guard or side control, guillotine from a stuffed shot.
//  - Nothing is a button-mash, and the referee stands it up when nobody does anything.
export type GPos = 'clinch' | 'drive' | 'guard' | 'half' | 'side' | 'mount' | 'back';
export type GDir = 'W' | 'A' | 'D' | 'S';
export type GOpt = {dir: GDir; label: string; to: GPos | 'stand' | 'land' | 'sweep'; role: 'top' | 'bottom' | 'any'; diff: number; cost: number; stat: 'wrestling' | 'grappling'; flipTo?: GPos};
export const GPOS_LABEL: Record<GPos, string> = {clinch: 'Clinch', drive: 'Takedown', guard: 'Full guard', half: 'Half guard', side: 'Side control', mount: 'Mount', back: 'Back control'};
const opt = (dir: GDir, label: string, to: GOpt['to'], role: GOpt['role'], diff: number, cost: number, stat: GOpt['stat'], flipTo?: GPos): GOpt => ({dir, label, to, role, diff, cost, stat, flipTo});
export const GOPTS: Record<GPos, GOpt[]> = {
  clinch: [opt('W', 'Body-lock takedown', 'land', 'any', .05, 12, 'wrestling'), opt('A', 'Trip', 'land', 'any', 0, 9, 'wrestling'), opt('S', 'Break away', 'stand', 'any', .15, 3, 'wrestling')],
  drive: [opt('W', 'Double leg', 'land', 'top', 0, 0, 'wrestling'), opt('A', 'Single leg', 'land', 'top', 0, 0, 'wrestling'), opt('D', 'Single leg', 'land', 'top', 0, 0, 'wrestling')],
  guard: [opt('W', 'Pass to half guard', 'half', 'top', 0, 7, 'grappling'), opt('D', 'Pass to side control', 'side', 'top', .12, 10, 'grappling'), opt('S', 'Stand up', 'stand', 'top', -.15, 4, 'wrestling'),
    opt('W', 'Get up', 'stand', 'bottom', .2, 7, 'wrestling'), opt('A', 'Sweep', 'sweep', 'bottom', .15, 10, 'grappling', 'guard')],
  half: [opt('W', 'Pass to side control', 'side', 'top', .03, 8, 'grappling'), opt('D', 'Mount', 'mount', 'top', .12, 10, 'grappling'), opt('S', 'Stand up', 'stand', 'top', -.15, 4, 'wrestling'),
    opt('W', 'Get up', 'stand', 'bottom', .22, 8, 'wrestling'), opt('A', 'Recover guard', 'guard', 'bottom', .12, 6, 'grappling'), opt('D', 'Sweep', 'sweep', 'bottom', .15, 11, 'grappling', 'half')],
  side: [opt('W', 'Mount', 'mount', 'top', .05, 9, 'grappling'), opt('D', 'Take the back', 'back', 'top', .15, 11, 'grappling'), opt('S', 'Stand up', 'stand', 'top', -.15, 4, 'wrestling'),
    opt('W', 'Get up', 'stand', 'bottom', .28, 9, 'wrestling'), opt('A', 'Recover half guard', 'half', 'bottom', .18, 7, 'grappling')],
  mount: [opt('W', 'Take the back', 'back', 'top', .08, 9, 'grappling'), opt('S', 'Stand up', 'stand', 'top', -.15, 4, 'wrestling'),
    opt('A', 'Elbow escape', 'half', 'bottom', .22, 8, 'grappling'), opt('D', 'Bridge and roll', 'sweep', 'bottom', .26, 10, 'wrestling', 'guard')],
  back: [opt('S', 'Let him up', 'stand', 'top', -.15, 4, 'wrestling'), opt('A', 'Turn into him', 'guard', 'bottom', .24, 9, 'grappling'), opt('W', 'Get up', 'stand', 'bottom', .3, 10, 'wrestling')],
};
/** submissions on offer in each position, for the man on top / underneath */
export const GSUBS: Partial<Record<GPos, {top?: string[]; bottom?: string[]}>> = {
  guard: {bottom: ['Triangle', 'Armbar']}, half: {top: ['Kimura']},
  side: {top: ['Arm-triangle', 'Kimura']}, mount: {top: ['Armbar', 'Arm-triangle']}, back: {top: ['Rear-naked choke']},
};
/** chokes run round a full circle (no corner to hide in) and drain his tank; joint locks run on an arc */
export const CHOKES = new Set(['Rear-naked choke', 'Guillotine', 'Arm-triangle', 'Triangle']);
/** how dangerous each one is (the rear-naked choke finishes the most fights in UFC history) */
const SUB_BITE: Record<string, number> = {'Rear-naked choke': .2, 'Arm-triangle': .1, 'Armbar': .08, 'Guillotine': .06, 'Triangle': .05, 'Kimura': 0};
/** bar-chase tuning: bar speeds and how fast each meter fills */
export const SUBT = {att: .48, def: .59, lock: .18, esc: .28};
/** ground and pound: how much a shot lands for from each position */
const GNP: Record<GPos, number> = {clinch: .55, drive: 0, guard: .6, half: .8, side: 1, mount: 1.45, back: 1.2};
/** points the judges give per second of control */
const CTRL: Record<GPos, number> = {clinch: .35, drive: 0, guard: .9, half: 1.2, side: 1.6, mount: 2.2, back: 2.4};
export type GMove = {id: number; by: 0 | 1; opt: GOpt; t: number; win: number; tele: number; aiDeny?: number};
/** the bar chase: positions on the track (0..1), bar widths, the two meters, and a short boost from strikes */
export type GSub = {id: number; by: 0 | 1; name: string; choke: boolean; a: number; d: number; aw: number; dw: number; lock: number; esc: number; t: number; boost: [number, number]};
export type Grapple = {pos: GPos; top: 0 | 1; t: number; move: GMove | null; sub: GSub | null; momentum: [number, number]; idle: number; guess: [GDir | null, GDir | null]; cd: [number, number]};
let gid = 1;
const ROLE = (g: LiveFight, s: 0 | 1) => g.grap!.pos === 'clinch' ? 'any' : g.grap!.top === s ? 'top' : 'bottom';
/** the moves a fighter can try from where he is now */
export function grappleOptions(g: LiveFight, s: 0 | 1): GOpt[] {
  const G = g.grap; if (!G || G.pos === 'drive') return [];
  const role = ROLE(g, s);
  return GOPTS[G.pos].filter(o => o.role === 'any' || o.role === role || role === 'any');
}
export function grappleSubs(g: LiveFight, s: 0 | 1): string[] {
  const G = g.grap; if (!G) return [];
  const e = GSUBS[G.pos]; if (!e) return [];
  return (ROLE(g, s) === 'top' ? e.top : e.bottom) ?? [];
}
const nearCage = (f: Fighter) => Math.hypot(f.x, f.z) > CAGE_R - 1.1;
const dirOf = (inp: Input): GDir | null => inp.up ? 'W' : inp.left ? 'A' : inp.right ? 'D' : inp.down ? 'S' : null;
export const DIR_KEY: Record<GDir, 'up' | 'left' | 'right' | 'down'> = {W: 'up', A: 'left', D: 'right', S: 'down'};
const clamp01 = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
/** the bar sizes right now: damage, a lowered ceiling and an empty tank make the defender's bar bigger */
export function subBars(g: LiveFight, S: GSub) {
  const a = g.f[S.by], d = g.f[S.by ? 0 : 1];
  const hurt = (100 - Math.max(0, d.hp)) / 100 * .3 + (100 - d.cap) / 100 * .15 + (100 - d.stamina) / 100 * .12 + (d.rocked > 0 ? .06 : 0);
  const dw = clamp01(.11 + hurt + (a.stats.grappling - d.stats.grappling) / 500, .09, .5) + S.boost[d.side] * -.03;
  const aw = clamp01(.15 + (a.stats.grappling - d.stats.grappling) / 450 + (SUB_BITE[S.name] ?? 0) * .4, .1, .36) + S.boost[a.side] * .07;
  return {aw: Math.max(.08, aw), dw: Math.max(.08, dw)};
}
/** how much of his bar the attacker's bar covers (0..1) on the arc or round the circle */
export function subOverlap(S: GSub) {
  const span = (c: number, w: number): [number, number] => [c - w / 2, c + w / 2];
  const ov = (x: [number, number], y: [number, number]) => Math.max(0, Math.min(x[1], y[1]) - Math.max(x[0], y[0]));
  const A = span(S.a, S.aw), D = span(S.d, S.dw);
  let o = ov(A, D);
  if (S.choke) o = Math.max(o, ov([A[0] + 1, A[1] + 1], D), ov([A[0] - 1, A[1] - 1], D));
  return Math.min(1, o / S.dw);
}

/** both men go into a grappling position (top = who is on top / pressing) */
function startGrapple(g: LiveFight, pos: GPos, top: 0 | 1) {
  const keep = g.grap?.momentum ?? [0, 0];
  g.grap = {pos, top, t: 0, move: null, sub: null, momentum: keep, idle: 0, guess: [null, null], cd: [.35, .35]}; g.fh = null;
  const a = g.f[top], b = g.f[top === 0 ? 1 : 0];
  for (const f of g.f) { f.move = null; f.queued = null; f.combo = 0; f.comboKey = null; f.rocked = Math.min(f.rocked, .4); }
  if (pos === 'clinch' || pos === 'drive') { setState(a, 'clinch'); setState(b, 'clinch'); }
  else { setState(a, 'top'); setState(b, 'bottom'); }
  const r = rel(a, b), d = pos === 'clinch' || pos === 'drive' ? .62 : .55;
  b.x = a.x + r.ux * d; b.z = a.z + r.uz * d; a.hx = r.ux; a.hz = r.uz; b.hx = -r.ux; b.hz = -r.uz;
}
/** back on the feet: the man getting up is a beat behind */
function separate(g: LiveFight, up: 0 | 1 | -1) {
  const [a, b] = g.f; const r = rel(a, b);
  const gap = 1.25 - r.d; a.x -= r.ux * gap / 2; a.z -= r.uz * gap / 2; b.x += r.ux * gap / 2; b.z += r.uz * gap / 2;
  for (const f of g.f) { setState(f, up === f.side ? 'getup' : 'idle'); f.invuln = .4; }
  g.grap = null;
}
/** where a takedown lands: the better the wrestling edge (and the more tired he is), the better the position */
function landing(att: Fighter, def: Fighter): GPos {
  const edge = att.stats.wrestling - def.stats.wrestling + (100 - def.stamina) / 4 + (rand() - .5) * 16;
  return edge > 24 ? 'side' : edge > 7 ? 'half' : 'guard';
}
/** the shot got in: now it's a drive (the defender has one read to stuff it) */
function startDrive(g: LiveFight, f: Fighter, o: Fighter, chance: number, dir: GDir) {
  startGrapple(g, 'drive', f.side);
  const win = .62, tele = Math.max(.08, Math.min(.65, .28 + (chance - .5) * .7)) * win;   // harsh: a good shot is read late
  g.grap!.move = {id: gid++, by: f.side, opt: GOPTS.drive.find(x => x.dir === dir) ?? GOPTS.drive[0], t: 0, win, tele, aiDeny: Math.max(.15, Math.min(.9, 1.25 - chance))};
}
function beginMove(g: LiveFight, s: 0 | 1, o: GOpt) {
  const G = g.grap!, f = g.f[s], d = g.f[s ? 0 : 1];
  if (G.move || G.sub || G.cd[s] > 0 || f.stamina < o.cost * .5) return;
  f.stamina = Math.max(0, f.stamina - o.cost);
  const getup = o.to === 'stand' && ROLE(g, s) === 'bottom';
  const win = (o.to === 'stand' && !getup ? .55 : .95) * (1 - G.momentum[s] * .25) / (.8 + f.stats.speed / 250);
  const edge = (f.stats[o.stat] - d.stats[o.stat]) / 250 + (getup && nearCage(f) ? .12 : 0);   // a wall walk is hard to stop
  const tele = Math.max(.08, Math.min(.7, .3 + edge + o.diff * .6)) * win;
  G.move = {id: gid++, by: s, opt: o, t: 0, win, tele}; G.guess = [null, null]; G.idle = 0;
  if (o.to === 'land') f.tdAttempts += 1;
}
function beginSub(g: LiveFight, s: 0 | 1, name: string) {
  const G = g.grap!, f = g.f[s];
  if (G.move || G.sub || G.cd[s] > 0 || f.stamina < 10) return;
  f.stamina -= 10; G.idle = 0;
  const choke = CHOKES.has(name);
  // he starts on the far side of the track from the attacker
  const a = .5, d = choke ? (rand() < .5 ? .15 : .85) : (rand() < .5 ? .16 : .84);
  G.sub = {id: gid++, by: s, name, choke, a, d, aw: .2, dw: .15, lock: 0, esc: 0, t: 0, boost: [0, 0]};
  const bars = subBars(g, G.sub); G.sub.aw = bars.aw; G.sub.dw = bars.dw;
  g.how = name;
  ev(g, {type: 'sub', side: s, x: f.x, z: f.z, power: 1, text: name + '!'});
}
/** what a move does when nobody stopped it */
function landMove(g: LiveFight, m: GMove) {
  const G = g.grap!, a = g.f[m.by], d = g.f[m.by ? 0 : 1], o = m.opt;
  G.momentum[m.by] = Math.min(1, G.momentum[m.by] + .1); G.momentum[d.side] = 0;
  if (o.to === 'stand') { const role = ROLE(g, m.by); separate(g, role === 'top' ? d.side : role === 'bottom' ? m.by : -1); ev(g, {type: 'escape', side: m.by, x: a.x, z: a.z, power: .6, text: role === 'bottom' ? 'Back to the feet!' : role === 'top' ? 'He lets him up' : 'Broken off'}); return; }
  if (o.to === 'land') {
    const pos = landing(a, d); a.takedowns += 1; a.points += 6;
    startGrapple(g, pos, m.by);
    ev(g, {type: 'td', side: m.by, x: d.x, z: d.z, power: 1, text: `${o.label}! ${GPOS_LABEL[pos]}`}); return;
  }
  if (o.to === 'sweep') {
    startGrapple(g, o.flipTo ?? 'guard', m.by); a.points += 5;
    ev(g, {type: 'trans', side: m.by, x: a.x, z: a.z, power: .8, text: `${o.label}! He's on top`}); return;
  }
  G.pos = o.to; G.t = 0; a.points += ROLE(g, m.by) === 'top' ? 3 : 1;
  ev(g, {type: 'trans', side: m.by, x: a.x, z: a.z, power: .6, text: `${o.label}`});
}
/** the defender's one read: right and the move is stuffed, wrong and he's committed */
function guess(g: LiveFight, s: 0 | 1, dir: GDir) {
  const G = g.grap!; if (G.guess[s]) return;
  const f = g.f[s]; if (f.stamina < 6) return;       // an empty tank can't defend
  G.guess[s] = dir; f.stamina = Math.max(0, f.stamina - 2.5);
  const m = G.move;
  if (m && m.by !== s && dir === m.opt.dir) {
    G.momentum[s] = Math.min(1, G.momentum[s] + .35); G.momentum[m.by] = 0; G.cd[m.by] = m.opt.to === 'stand' || G.top !== m.by ? .45 : .8; G.move = null;
    if (G.pos === 'drive') {   // a stuffed shot: he's stuck under a sprawl, head and arm hanging there
      const a = g.f[m.by]; g.grap = null; setState(a, 'sprawled'); setState(f, 'sprawl'); a.stamina = Math.max(0, a.stamina - 8); f.points += 3;
      g.fh = {by: s, t: .85};
      ev(g, {type: 'sprawl', side: s, x: f.x, z: f.z, power: .5, text: 'Stuffed! Front headlock'}); return;
    }
    ev(g, {type: 'deny', side: s, x: f.x, z: f.z, power: .4, text: `Denied: ${m.opt.label.toLowerCase()}`});
  }
}
/** a submission ends: the tap, or he gets out (and an attack from on top that fails costs the position) */
function endSub(g: LiveFight, tapped: boolean) {
  const G = g.grap!, S = G.sub!, a = g.f[S.by], d = g.f[S.by ? 0 : 1];
  if (tapped) { ev(g, {type: 'tap', side: S.by, x: d.x, z: d.z, power: 2, text: 'TAP OUT!'}); finish(g, a, 'SUB', S.name); return; }
  G.sub = null; G.cd[S.by] = 2.5; a.stamina = Math.max(0, a.stamina - 6); G.momentum[d.side] = Math.min(1, G.momentum[d.side] + .4);
  ev(g, {type: 'escape', side: d.side, x: d.x, z: d.z, power: .6, text: `Escaped the ${S.name.toLowerCase()}!`});
  if (ROLE(g, S.by) === 'top' && G.pos !== 'back') G.pos = G.pos === 'mount' ? 'half' : 'guard';
  else if (G.pos === 'clinch') startGrapple(g, 'guard', d.side);
}

function grapple(g: LiveFight, inputs: [Input, Input], pressed: [Input, Input], dt: number) {
  const G = g.grap!; G.t += dt; G.idle += dt; G.cd[0] -= dt; G.cd[1] -= dt;
  const top = g.f[G.top], bot = g.f[G.top === 0 ? 1 : 0];
  // keep the bodies together
  const r = rel(top, bot), want = G.pos === 'clinch' || G.pos === 'drive' ? .62 : .55;
  bot.x = top.x + r.ux * want; bot.z = top.z + r.uz * want; top.hx = r.ux; top.hz = r.uz; bot.hx = -r.ux; bot.hz = -r.uz;
  for (const f of g.f) { const d = Math.hypot(f.x, f.z); if (d > CAGE_R) { f.x *= CAGE_R / d; f.z *= CAGE_R / d; } }
  // control
  if (G.pos !== 'clinch' && G.pos !== 'drive') { top.points += dt * CTRL[G.pos]; top.ctrl += dt; }
  else if (G.pos === 'clinch') { const presser = nearCage(bot) ? top : nearCage(top) ? bot : null; if (presser) presser.points += dt * CTRL.clinch; }
  // the bar chase
  const S = G.sub;
  if (S) {
    S.t += dt; S.boost[0] = Math.max(0, S.boost[0] - dt * 1.6); S.boost[1] = Math.max(0, S.boost[1] - dt * 1.6);
    const bars = subBars(g, S); S.aw = bars.aw; S.dw = bars.dw;
    const a = g.f[S.by], d = g.f[S.by ? 0 : 1];
    const speed = (f: Fighter, base: number) => base * (.72 + f.stats.grappling / 220) * (f === d ? .72 + .28 * f.stamina / 100 : .5 + .5 * f.stamina / 100);
    for (const f of [a, d]) {
      const inp = inputs[f.side], prs = pressed[f.side];
      const dir = (inp.right || inp.up ? 1 : 0) - (inp.left || inp.down ? 1 : 0);
      const v = dir * speed(f, f === a ? SUBT.att : SUBT.def) * dt;
      if (f === a) S.a += v; else S.d += v;
      // a strike in the middle of it widens your bar for a moment (and costs gas)
      if ((prs.jab || prs.cross || prs.upper) && f.stamina > 8 && S.boost[f.side] < .3) { S.boost[f.side] = 1; f.stamina -= 4; f.thrown += 1; }
    }
    if (S.choke) { S.a = ((S.a % 1) + 1) % 1; S.d = ((S.d % 1) + 1) % 1; }
    else { S.a = clamp01(S.a, S.aw / 2, 1 - S.aw / 2); S.d = clamp01(S.d, S.dw / 2, 1 - S.dw / 2); }
    const o = subOverlap(S);
    S.lock += dt * o * (SUBT.lock + (SUB_BITE[S.name] ?? 0) * .6) * (S.choke ? 1.15 : .8);   // chokes finish more fights than joint locks
    S.esc += dt * (1 - o) * SUBT.esc * (.75 + d.stats.grappling / 250);
    a.stamina = Math.max(0, a.stamina - dt * 2.2);
    d.stamina = Math.max(0, d.stamina - dt * (S.choke ? 1 + o * 4 : 1 + o * 2));
    if (S.choke && o > .5) d.hp -= dt * 2.5;
    if (S.lock >= 1) return endSub(g, true);
    if (S.esc >= 1) return endSub(g, false);
    return;   // nothing else happens while a submission is on
  }
  for (const s of [0, 1] as const) {
    if (g.grap !== G) return;   // the exchange already ended (a stuffed shot, a stand-up)
    const f = g.f[s], o = g.f[s ? 0 : 1], prs = pressed[s], inp = inputs[s];
    const m = G.move;
    // defending: the first direction pressed while he's moving is your read
    const dir = prs.up ? 'W' : prs.left ? 'A' : prs.right ? 'D' : prs.down ? 'S' : null;
    if (dir && !prs.shoot && m && m.by !== s && G.guess[s] === null) { guess(g, s, dir); continue; }
    if (m || G.pos === 'drive') continue;
    if (prs.shoot) { const opts = grappleOptions(g, s), d = dirOf(inp); const o2 = opts.find(x => x.dir === d) ?? opts[0]; if (o2) beginMove(g, s, o2); continue; }
    if (prs.kick) { const subs = grappleSubs(g, s); if (subs.length) beginSub(g, s, subs[Math.floor(rand() * subs.length)]); continue; }
    // strikes: ground and pound from on top, elbows from guard, knees and short shots in the clinch
    const strike = prs.jab || prs.cross || prs.upper;
    const role = ROLE(g, s);
    if (strike && f.gnpCd <= 0 && f.stamina > 3 && (role !== 'bottom' || G.pos === 'guard' || G.pos === 'half')) {
      f.gnpCd = (role === 'any' ? .5 : .42) / spd(f); f.stamina -= 2.5; f.thrown += 1; G.idle = 0;
      const mult = role === 'bottom' ? .35 : GNP[G.pos], knee = role === 'any' && prs.upper;
      let dmg = (knee ? 4.2 : 2.6) * mult * (.55 + f.stats.power / 110) * (.8 + rand() * .4) * (.62 + .38 * f.stamina / 100);
      if (inputs[o.side].block && role !== 'any') dmg *= .45;
      dmg *= 1.3 - o.stats.chin / 170;
      if (knee && rand() < .5) { hurtBody(g, f, o, 'kick', dmg, 1); f.bodyLanded += 1; }
      else { o.hp -= dmg; o.cap = Math.max(20, o.cap - dmg * .08); o.sinceHit = 0; f.headLanded += 1; if (role === 'top') cutCheck(g, f, o, .8, dmg * 1.5); }
      o.absorbed += dmg; f.points += dmg * .3; f.landed += 1;
      ev(g, {type: 'hit', side: s, x: o.x, z: o.z, power: dmg / 8, target: 'head'});
      if (o.hp <= 0) { g.slowmo = 1; ev(g, {type: 'ko', side: s, x: o.x, z: o.z, power: 2, text: 'TKO! Ref stops it'}); return finish(g, f, 'KO/TKO', role === 'any' ? 'Knees in the clinch' : 'Ground and pound'); }
    }
  }
  if (!g.grap) return;
  // the move in flight
  const m = G.move;
  if (m) { m.t += dt; if (m.t >= m.win) { G.move = null; landMove(g, m); if (!g.grap) return; } }
  // nobody doing anything: the referee stands them up
  if (G.idle > (G.pos === 'clinch' ? 6 : 9) && (G.pos === 'clinch' || G.pos === 'guard' || G.pos === 'half' || G.pos === 'side')) { separate(g, -1); ev(g, {type: 'escape', side: 0, x: 0, z: 0, power: .3, text: 'The referee stands them up'}); }
}

/** the AI on the ground: it reads your moves (more often the better it is), chases or runs in a submission,
 *  and picks its own moves by style and situation */
function aiGrapple(g: LiveFight, me: Fighter, them: Fighter, brain: AIBrain): {held: Input; pressed: Input} {
  const held = {...NO_INPUT}, pressed = {...NO_INPUT}, G = g.grap!, lvl = brain.level;
  brain.plan -= DT; brain.react -= DT;
  const m = G.move, S = G.sub;
  if (S) {
    // re-aim a few times a second, with a little error that shrinks as it gets better
    if (brain.react <= 0) {
      brain.react = .22 - lvl * .14 + rand() * .1;
      const mine = S.by === me.side, from = mine ? S.a : S.d, other = mine ? S.d : S.a;
      let diff = other - from; if (S.choke) diff = ((diff + 1.5) % 1) - .5;   // shortest way round the circle
      if (mine) brain.subDir = Math.abs(diff) < .015 + (1 - lvl) * .05 ? 0 : Math.sign(diff + (rand() - .5) * (1 - lvl) * .12);
      else {
        // run from his bar; on an arc, a man pinned at the end has to dart past it
        let away = -Math.sign(diff || (rand() - .5));
        if (!S.choke && ((away < 0 && from - S.dw / 2 < .03) || (away > 0 && from + S.dw / 2 > .97))) away = -away;
        brain.subDir = rand() < .82 + lvl * .15 ? away : -away;
      }
    }
    if (brain.subDir) held[brain.subDir > 0 ? 'right' : 'left'] = true;
    if (me.stamina > 30 && rand() < .008 + lvl * .012) pressed.jab = true;
    return {held, pressed};
  }
  // defend a move: decide once, a human-ish beat after it starts
  if (m && m.by !== me.side && G.guess[me.side] === null && brain.decided !== m.id && m.t > m.win * (.25 + rand() * .35)) {
    brain.decided = m.id;
    if (me.stamina >= 6) {
      const escaping = m.opt.to === 'stand' || (G.top !== m.by && G.pos !== 'clinch');
      const p0 = m.aiDeny ?? Math.max(.03, Math.min(.85, .18 + lvl * .32 + (me.stats[m.opt.stat] - them.stats[m.opt.stat]) / 170 - m.opt.diff + G.momentum[me.side] * .1));
      const p = escaping ? Math.min(.38, p0 * .65) : p0;   // escapes are hard to shut down every time
      const opts = G.pos === 'drive' ? GOPTS.drive : GOPTS[G.pos].filter(o => o.role === 'any' || o.role === (G.top === them.side ? 'top' : 'bottom'));
      const dirs = [...new Set(opts.map(o => o.dir))].filter(d => d !== m.opt.dir);
      const pick = rand() < p ? m.opt.dir : dirs[Math.floor(rand() * dirs.length)] ?? null;
      if (pick) pressed[DIR_KEY[pick]] = true;
    }
    return {held, pressed};
  }
  if (m || G.pos === 'drive') return {held, pressed};
  const role = G.pos === 'clinch' ? 'any' : G.top === me.side ? 'top' : 'bottom';
  const grappler = me.style === 'Grappler', wrestler = me.style === 'Wrestler', striker = me.style === 'Striker';
  // strikes keep coming between moves
  const rate = role === 'top' ? .06 + lvl * .07 : role === 'any' ? .04 + lvl * .05 : .015;
  if (rand() < rate) pressed[role === 'any' && rand() < .45 ? 'upper' : 'jab'] = true;
  if (role === 'bottom' && rand() < .3 + lvl * .4) held.block = true;
  if (brain.plan > 0) return {held, pressed};
  brain.plan = .9 + rand() * 1.6 * (1.1 - lvl * .5);
  if (me.stamina < 14) return {held, pressed};
  const opts = grappleOptions(g, me.side), subs = grappleSubs(g, me.side);
  const go = (o: GOpt | undefined) => { if (!o) return; pressed.shoot = true; held[DIR_KEY[o.dir]] = true; };
  // a hurt or tired man is the time to hunt the finish
  const subChance = subs.length ? (G.pos === 'back' ? .62 : G.pos === 'mount' ? .18 : G.pos === 'guard' ? .06 : .1) * (.4 + me.stats.grappling / 100) * (them.stamina < 40 || them.hp < 50 ? 1.6 : 1) * (grappler ? 1.5 : 1) : 0;
  if (rand() < subChance && me.stamina > 22) { pressed.kick = true; return {held, pressed}; }
  if (role === 'top') {
    const better = opts.filter(o => o.to !== 'stand'), stand = opts.find(o => o.to === 'stand');
    if (striker && me.stats.grappling < them.stats.grappling && rand() < .35) go(stand);
    else if (rand() < .55) go(better.find(o => o.to === 'back' && rand() < .6) ?? better[Math.floor(rand() * better.length)]);   // the back is where fights end
  } else if (role === 'bottom') {
    const up = opts.find(o => o.to === 'stand'), rest = opts.filter(o => o.to !== 'stand');
    if ((striker || wrestler || nearCage(me)) && rand() < .55) go(up);
    else if (rand() < .6) go(rest[Math.floor(rand() * rest.length)] ?? up);
  } else {   // clinch
    if ((wrestler || grappler) && rand() < .32) go(opts.find(o => o.to === 'land' && (rand() < .5 ? o.dir === 'W' : o.dir === 'A')) ?? opts[0]);
    else if (striker && rand() < .5) go(opts.find(o => o.to === 'stand'));
  }
  return {held, pressed};
}
