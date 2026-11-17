// VERSUS live fights: real-time 3D fight simulation (fixed 60 Hz step).
// Fighters move freely on the octagon floor (x, z in metres) and always turn to face each other
// while free; a committed strike keeps its heading, so stepping off the line makes it miss.
// Stats (0-100) from career mode shape speed, damage, stamina, takedowns and submissions.
import type {Stats, Style} from '../career/engine';

export type MoveId = 'jab' | 'cross' | 'kick' | 'upper';
export type FState = 'idle' | 'walk' | 'attack' | 'block' | 'stun' | 'down' | 'getup' | 'shoot' | 'sprawl' | 'sprawled' | 'top' | 'bottom' | 'ko' | 'win';
/** mx/mz: world-space movement wish (-1..1). left/right/up/down: the player's raw keys (screen space, mapped by the view). */
export type Input = {mx: number; mz: number; left: boolean; right: boolean; up: boolean; down: boolean; block: boolean; jab: boolean; cross: boolean; kick: boolean; upper: boolean; shoot: boolean};
export const NO_INPUT: Input = {mx: 0, mz: 0, left: false, right: false, up: false, down: false, block: false, jab: false, cross: false, kick: false, upper: false, shoot: false};
export const DT = 1 / 60;

const MOVES: Record<MoveId, {start: number; active: number; rec: number; range: number; dmg: number; cost: number; push: number; heavy: boolean}> = {
  jab: {start: .15, active: .06, rec: .2, range: 1.18, dmg: 1.7, cost: 3, push: .15, heavy: false},
  cross: {start: .18, active: .07, rec: .28, range: 1.28, dmg: 3.6, cost: 6, push: .3, heavy: true},
  kick: {start: .3, active: .09, rec: .38, range: 1.55, dmg: 4.4, cost: 9, push: .45, heavy: true},
  upper: {start: .17, active: .07, rec: .3, range: 1.08, dmg: 5, cost: 8, push: .35, heavy: true},
};
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
  hp: number; stamina: number; kdRound: number; invuln: number; queued: MoveId | null; combo: number;
  escape: number; sub: number; subClock: number; gnpCd: number; mashCd: number;
  landed: number; points: number; takedowns: number; knockdowns: number;
  /** hold-to-combo: the button that started the current flurry; fight stats for the post-fight screen */
  comboKey: MoveId | null; thrown: number; tdAttempts: number; ctrl: number;
};
export type FightEvent = {type: 'hit' | 'block' | 'whiff' | 'kd' | 'ko' | 'td' | 'sprawl' | 'sub' | 'escape' | 'tap' | 'bell' | 'tired'; side: 0 | 1; x: number; z: number; power: number; text?: string};
export type Phase = 'intro' | 'fight' | 'break' | 'over';
export type LiveFight = {
  f: [Fighter, Fighter]; round: number; rounds: number; clock: number; phase: Phase; phaseT: number;
  slowmo: number; hitstop: number; events: FightEvent[]; cards: [number, number][]; seed: number;
  result: null | {winner: 0 | 1 | -1; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number};
};

let seedState = 1;
const rand = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; };

export function createFight(a: {name: string; color: string; style: Style; stats: Stats}, b: {name: string; color: string; style: Style; stats: Stats}, rounds: number, seed = Date.now()): LiveFight {
  seedState = seed >>> 0 || 1;
  const mk = (p: typeof a, side: 0 | 1, x: number): Fighter => ({...p, side, x, z: 0, hx: side === 0 ? 1 : -1, hz: 0, state: 'idle', t: 0, move: null, hitDone: false, hp: 100, stamina: 100, kdRound: 0, invuln: 0, queued: null, combo: 0, escape: 0, sub: 0, subClock: 0, gnpCd: 0, mashCd: 0, landed: 0, points: 0, takedowns: 0, knockdowns: 0, comboKey: null, thrown: 0, tdAttempts: 0, ctrl: 0});
  return {f: [mk(a, 0, -1.6), mk(b, 1, 1.6)], round: 1, rounds, clock: ROUND_SECONDS, phase: 'intro', phaseT: 0, slowmo: 0, hitstop: 0, events: [], cards: [[0, 0], [0, 0], [0, 0]], seed, result: null};
}

/** unit vector and distance from f to o */
export const rel = (f: {x: number; z: number}, o: {x: number; z: number}) => {
  const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz) || 1e-6;
  return {ux: dx / d, uz: dz / d, d};
};
export const distance = (a: Fighter, b: Fighter) => rel(a, b).d;
const spd = (f: Fighter) => (.78 + f.stats.speed / 220) * (.75 + .25 * f.stamina / 100);
const setState = (f: Fighter, s: FState) => { f.state = s; f.t = 0; };
const busy = (f: Fighter) => !['idle', 'walk', 'block'].includes(f.state);
const ev = (g: LiveFight, e: Omit<FightEvent, 'z'> & {z?: number}) => g.events.push({z: 0, ...e});
export const moveTiming = (f: Fighter, m: MoveId) => { const k = 1 / spd(f); const d = MOVES[m]; return {start: d.start * k, active: d.active, rec: d.rec * k, range: d.range}; };
const push = (o: Fighter, ux: number, uz: number, amt: number) => { o.x += ux * amt; o.z += uz * amt; };

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
  for (const f of g.f) { f.t += dt; f.invuln = Math.max(0, f.invuln - dt); f.gnpCd -= dt; f.mashCd -= dt; }
  // stamina regen (half while blocking, none while throwing or stuck under a sprawl)
  for (const f of g.f) if (!['attack', 'shoot', 'sprawled'].includes(f.state)) f.stamina = Math.min(100, f.stamina + dt * (4 + f.stats.cardio / 9) * (f.state === 'block' ? .5 : 1));

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
      if (m && f.stamina > 4) { setState(f, 'attack'); f.move = m; f.hitDone = false; f.stamina -= MOVES[m].cost; f.comboKey = m; f.combo = 0; f.thrown += 1; return; }
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
      if (f.queued && f.hitDone && f.t >= tm.start + tm.active + tm.rec * .35 && f.stamina > MOVES[f.queued].cost) {
        const m = f.queued; f.queued = null; f.combo = Math.min(4, f.combo + 1);
        const r = rel(f, o); f.hx = r.ux; f.hz = r.uz;
        setState(f, 'attack'); f.move = m; f.hitDone = false; f.stamina -= MOVES[m].cost; f.thrown += 1; return;
      }
      if (f.t >= tm.start + tm.active + tm.rec) { setState(f, 'idle'); f.move = null; f.combo = 0; f.queued = null; f.comboKey = null; }
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
          const turtled = o.state === 'block' && !timedSprawl;   // a guard held up the whole time does nothing against a shot
          const chance = .5 + (f.stats.wrestling - o.stats.wrestling) / 120 + (100 - o.stamina) / 450 + (o.state === 'attack' ? .22 : 0)
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
    case 'sprawled': if (f.t > 1.0) { setState(f, 'idle'); f.hitDone = false; } return;
    case 'stun': if (f.t > .38) setState(f, 'idle'); return;
    case 'down': if (f.t > 1.7) { if (f.hp <= 0) return finish(g, o, 'KO/TKO'); setState(f, 'getup'); } return;
    case 'getup': if (f.t > .5) { setState(f, 'idle'); f.invuln = .5; } return;
    default: return;
  }
}

function resolveHit(g: LiveFight, f: Fighter, o: Fighter, m: MoveId) {
  const d = MOVES[m];
  const r = rel(f, o), aligned = f.hx * r.ux + f.hz * r.uz > ALIGN;
  const wx = f.x + f.hx * .8, wz = f.z + f.hz * .8;
  if (!aligned || r.d > d.range || ['down', 'ko', 'getup'].includes(o.state) || o.invuln > 0) { ev(g, {type: 'whiff', side: f.side, x: wx, z: wz, power: .2}); return; }
  // a level change ducks straight punches (uppercuts and knees/kicks still catch a shot)
  if (o.state === 'shoot' && (m === 'jab' || m === 'cross')) { ev(g, {type: 'whiff', side: f.side, x: wx, z: wz, power: .2, text: o.side === 0 || f.side === 0 ? 'Ducked under!' : undefined}); return; }
  const tired = .65 + .35 * f.stamina / 100;
  let dmg = d.dmg * (.55 + f.stats.power / 100) * (1.25 - o.stats.chin / 200) * tired * (.85 + rand() * .3);
  const hx = (f.x + o.x) / 2, hz = (f.z + o.z) / 2;
  // blocking only works facing the attacker; a high guard doesn't stop every low kick
  const facingIt = o.hx * -r.ux + o.hz * -r.uz > .3;
  const underGuard = o.state === 'block' && facingIt && m === 'kick' && rand() < .35;
  const guarded = o.state === 'block' && facingIt && !underGuard;
  if (underGuard) dmg *= .55;   // a chopped leg, not a clean head shot
  if (guarded) {
    o.stamina = Math.max(0, o.stamina - dmg * 1.1); o.hp -= dmg * .16; push(o, r.ux, r.uz, d.push * .25); g.hitstop = .03;
    ev(g, {type: 'block', side: o.side, x: hx, z: hz, power: dmg / 10});
    if (o.stamina <= 0) { setState(o, 'stun'); ev(g, {type: 'tired', side: o.side, x: o.x, z: o.z, power: .4, text: 'Guard broken, gassed!'}); }
    return;
  }
  const open = o.state === 'sprawled';          // caught under a stuffed shot
  const counter = o.state === 'attack' || open ? 1.2 : 1;
  dmg *= counter * (1 + f.combo * .05) * .238;  // tuned for 1:30 rounds
  o.hp -= dmg; push(o, r.ux, r.uz, d.push * (d.heavy ? .7 : .4) * (open ? .3 : 1)); f.landed += 1; f.points += dmg;   // a snap back, not a shove across the cage
  g.hitstop = d.heavy ? .085 : .045;
  ev(g, {type: 'hit', side: f.side, x: hx, z: hz, power: dmg / 10, text: counter > 1 ? 'Counter!' : undefined});
  const kdChance = d.heavy && !underGuard ? .005 + (f.stats.power - o.stats.chin) / 800 + Math.max(0, 40 - o.hp) / 520 + (counter > 1 ? .03 : 0) + (m === 'upper' ? .04 : 0) : .0;
  if (o.hp <= 0 || rand() < kdChance) {
    o.kdRound += 1; f.knockdowns += 1; f.points += 12;
    setState(o, 'down'); o.move = null;
    const stoppage = o.hp <= 0 || o.kdRound >= 3 || (o.hp < 15 && rand() < .5);
    if (stoppage) { o.hp = Math.min(o.hp, 0); g.slowmo = 1.1; ev(g, {type: 'ko', side: f.side, x: o.x, z: o.z, power: 2, text: 'KNOCKOUT!'}); }
    else { o.hp = Math.max(o.hp, 6); ev(g, {type: 'kd', side: f.side, x: o.x, z: o.z, power: 1.4, text: 'Knockdown!'}); }
  } else if (!open) setState(o, 'stun');
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
    if (top.sub >= 1) { ev(g, {type: 'tap', side: top.side, x: bot.x, z: bot.z, power: 2, text: 'TAP OUT!'}); return finish(g, top, 'SUB'); }
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
      const dmg = .75 * (.55 + top.stats.power / 100) * (1.25 - bot.stats.chin / 200);
      bot.hp -= dmg; top.points += dmg; top.landed += 1; top.stamina -= 2.5; bot.escape -= .04;
      ev(g, {type: 'hit', side: top.side, x: bot.x, z: bot.z, power: dmg / 8});
      if (bot.hp <= 0) { g.slowmo = 1; ev(g, {type: 'ko', side: top.side, x: bot.x, z: bot.z, power: 2, text: 'TKO! Ref stops it'}); return finish(g, top, 'KO/TKO'); }
    }
    if (tp.kick && top.stamina > 20 && top.mashCd <= 0) {
      top.sub = .2; top.subClock = 0; top.stamina -= 12;
      ev(g, {type: 'sub', side: top.side, x: bot.x, z: bot.z, power: 1, text: ['Rear-naked choke!', 'Armbar!', 'Guillotine!', 'Kimura!'][Math.floor(rand() * 4)]});
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
function finish(g: LiveFight, winner: Fighter, method: 'KO/TKO' | 'SUB') {
  const loser = winner.side === 0 ? g.f[1] : g.f[0];
  setState(loser, 'ko'); setState(winner, 'win');
  g.phase = 'over'; g.phaseT = 0;
  g.result = {winner: winner.side, method, round: g.round};
}

function endRound(g: LiveFight) {
  const [a, b] = g.f;
  for (const card of g.cards) {
    const n = (rand() - .5) * 6;
    const aWin = a.points + n > b.points;
    const wide = Math.abs(a.points - b.points) > 40;
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
  g.f.forEach((f, i) => { f.points = 0; f.kdRound = 0; f.x = i === 0 ? -1.6 : 1.6; f.z = 0; f.hx = i === 0 ? 1 : -1; f.hz = 0; setState(f, 'idle'); f.stamina = Math.min(100, f.stamina + 35 * f.stats.cardio / 100 + 20); f.hp = Math.min(100, f.hp + 8); f.sub = 0; f.escape = 0; });
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

export function aiInput(g: LiveFight, me: Fighter, them: Fighter, brain: AIBrain): {held: Input; pressed: Input} {
  const held = {...NO_INPUT}, pressed = {...NO_INPUT};
  if (g.phase !== 'fight') return {held, pressed};
  brain.react -= DT; brain.plan -= DT; brain.shotCd -= DT;
  const lvl = brain.level; // 0..1
  // ground mashing: a hard-mashing human is ~6-8 presses/s; Normal AI ~4/s, more when fighting off a submission
  if (me.state === 'bottom') { if (rand() < (them.sub > 0 ? (.03 + lvl * .07) * 1.5 : .06 + lvl * .07)) pressed.jab = true; return {held, pressed}; }
  if (me.state === 'top') {
    if (me.sub === 0 && brain.plan <= 0) { brain.plan = 1.2; if (me.stats.grappling > 55 && them.hp < 85 && rand() < .15 + lvl * .15) pressed.kick = true; }
    // ground and pound ~2/s; while a submission is on, crank it (Normal ~3 presses/s)
    if (rand() < (me.sub > 0 ? .02 + lvl * .06 : .12 + lvl * .1)) pressed.jab = true;
    return {held, pressed};
  }
  const dist = rel(me, them).d;
  const ideal = me.style === 'Striker' ? 1.1 : 1.04;   // inside its own jab range (1.18)
  const grappler = me.style === 'Wrestler' || me.style === 'Grappler';
  const out = (h: Input, p: Input) => { if (p.shoot) brain.shotCd = 4.2 - lvl * 1.6; const [mx, mz] = steer(me, them, brain.want.move ?? null); h.mx = mx; h.mz = mz; h.block = !!brain.want.block; return {held: h, pressed: p}; };
  // a stuffed shooter stuck under a sprawl: free shots
  if (them.state === 'sprawled' && dist < 1.25 && me.state !== 'attack' && brain.react <= 0) {
    brain.react = .25; if (rand() < .3 + lvl * .5) { pressed[rand() < .5 ? 'cross' : 'upper'] = true; return out(held, pressed); }
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
