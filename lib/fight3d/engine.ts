// VERSUS live fights: real-time 2.5D fight simulation (fixed 60 Hz step).
// Positions are 1D along the fight line (x, metres). Stats (0-100) from career mode
// shape speed, damage, stamina, takedowns and submissions.
import type {Stats, Style} from '../career/engine';

export type MoveId = 'jab' | 'cross' | 'kick' | 'upper';
export type FState = 'idle' | 'walk' | 'attack' | 'block' | 'stun' | 'down' | 'getup' | 'shoot' | 'sprawl' | 'top' | 'bottom' | 'ko' | 'win';
export type Input = {left: boolean; right: boolean; block: boolean; jab: boolean; cross: boolean; kick: boolean; upper: boolean; shoot: boolean};
export const NO_INPUT: Input = {left: false, right: false, block: false, jab: false, cross: false, kick: false, upper: false, shoot: false};
export const DT = 1 / 60;

const MOVES: Record<MoveId, {start: number; active: number; rec: number; range: number; dmg: number; cost: number; push: number; heavy: boolean}> = {
  jab: {start: .15, active: .06, rec: .2, range: 1.18, dmg: 1.7, cost: 3, push: .15, heavy: false},
  cross: {start: .18, active: .07, rec: .28, range: 1.28, dmg: 3.6, cost: 6, push: .3, heavy: true},
  kick: {start: .3, active: .09, rec: .38, range: 1.55, dmg: 4.4, cost: 9, push: .45, heavy: true},
  upper: {start: .17, active: .07, rec: .3, range: .95, dmg: 5, cost: 8, push: .35, heavy: true},
};
const SHOOT = {start: .26, active: .16, rec: .45, range: 1.35, cost: 14};
export const ROUND_SECONDS = 75;

export type Fighter = {
  name: string; color: string; style: Style; stats: Stats; side: 0 | 1;
  x: number; facing: 1 | -1; state: FState; t: number; move: MoveId | null; hitDone: boolean;
  hp: number; stamina: number; kdRound: number; invuln: number; queued: MoveId | null; combo: number;
  escape: number; sub: number; subClock: number; gnpCd: number; mashCd: number;
  landed: number; points: number; takedowns: number; knockdowns: number;
};
export type FightEvent = {type: 'hit' | 'block' | 'whiff' | 'kd' | 'ko' | 'td' | 'sprawl' | 'sub' | 'escape' | 'tap' | 'bell'; side: 0 | 1; x: number; power: number; text?: string};
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
  const mk = (p: typeof a, side: 0 | 1, x: number): Fighter => ({...p, side, x, facing: side === 0 ? 1 : -1, state: 'idle', t: 0, move: null, hitDone: false, hp: 100, stamina: 100, kdRound: 0, invuln: 0, queued: null, combo: 0, escape: 0, sub: 0, subClock: 0, gnpCd: 0, mashCd: 0, landed: 0, points: 0, takedowns: 0, knockdowns: 0});
  return {f: [mk(a, 0, -1.6), mk(b, 1, 1.6)], round: 1, rounds, clock: ROUND_SECONDS, phase: 'intro', phaseT: 0, slowmo: 0, hitstop: 0, events: [], cards: [[0, 0], [0, 0], [0, 0]], seed, result: null};
}

const spd = (f: Fighter) => (.78 + f.stats.speed / 220) * (.75 + .25 * f.stamina / 100);
const setState = (f: Fighter, s: FState) => { f.state = s; f.t = 0; };
const busy = (f: Fighter) => !['idle', 'walk', 'block'].includes(f.state);
export const moveTiming = (f: Fighter, m: MoveId) => { const k = 1 / spd(f); const d = MOVES[m]; return {start: d.start * k, active: d.active, rec: d.rec * k, range: d.range}; };

/* ------------------------------------------------------------------ step */
export function step(g: LiveFight, inputs: [Input, Input], pressed: [Input, Input]) {
  g.events = [];
  if (g.hitstop > 0) { g.hitstop -= DT; return; }
  const dt = g.slowmo > 0 ? DT * .3 : DT;
  if (g.slowmo > 0) g.slowmo -= DT;
  g.phaseT += DT;
  if (g.phase === 'intro') { if (g.phaseT > 1.4) { g.phase = 'fight'; g.phaseT = 0; g.events.push({type: 'bell', side: 0, x: 0, power: 1, text: `Round ${g.round}`}); } return; }
  if (g.phase === 'break') { if (g.phaseT > 2.6) nextRound(g); return; }
  if (g.phase === 'over') { for (const f of g.f) f.t += dt; return; }

  g.clock -= dt;
  const [a, b] = g.f;
  for (const f of g.f) { f.t += dt; f.invuln = Math.max(0, f.invuln - dt); f.gnpCd -= dt; f.mashCd -= dt; }
  // stamina regen
  for (const f of g.f) if (!['attack', 'shoot'].includes(f.state)) f.stamina = Math.min(100, f.stamina + dt * (4 + f.stats.cardio / 9) * (f.state === 'block' ? .5 : 1));

  if (a.state === 'top' || a.state === 'bottom') ground(g, inputs, pressed, dt);
  else for (const f of g.f) standUp(g, f, f.side === 0 ? b : a, inputs[f.side], pressed[f.side], dt);

  // keep apart + face each other while standing
  if (a.state !== 'top' && a.state !== 'bottom') {
    const minGap = .72; const gap = b.x - a.x;
    if (Math.abs(gap) < minGap) { const push = (minGap - Math.abs(gap)) / 2 * Math.sign(gap || 1); a.x -= push; b.x += push; }
    if (!busy(a)) a.facing = b.x > a.x ? 1 : -1;
    if (!busy(b)) b.facing = a.x > b.x ? 1 : -1;
  }
  for (const f of g.f) f.x = Math.max(-4.3, Math.min(4.3, f.x));

  if (g.clock <= 0 && g.phase === 'fight') endRound(g);
}

function standUp(g: LiveFight, f: Fighter, o: Fighter, inp: Input, prs: Input, dt: number) {
  const k = spd(f);
  switch (f.state) {
    case 'idle': case 'walk': case 'block': {
      if (prs.shoot && f.stamina > 15) { setState(f, 'shoot'); f.stamina -= SHOOT.cost; return; }
      const m: MoveId | null = prs.jab ? 'jab' : prs.cross ? 'cross' : prs.kick ? 'kick' : prs.upper ? 'upper' : null;
      if (m && f.stamina > 4) { setState(f, 'attack'); f.move = m; f.hitDone = false; f.stamina -= MOVES[m].cost; return; }
      if (inp.block) { if (f.state !== 'block') setState(f, 'block'); return; }
      const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (dir) { f.x += dir * dt * 2.3 * k * (f.state === 'block' ? .5 : 1); if (f.state !== 'walk') setState(f, 'walk'); }
      else if (f.state !== 'idle') setState(f, 'idle');
      return;
    }
    case 'attack': {
      const tm = moveTiming(f, f.move!);
      const q: MoveId | null = prs.jab ? 'jab' : prs.cross ? 'cross' : prs.kick ? 'kick' : prs.upper ? 'upper' : null;
      if (q && f.t > tm.start * .5) f.queued = q;
      if (!f.hitDone && f.t >= tm.start) { f.hitDone = true; resolveHit(g, f, o, f.move!); }
      // combo: a strike pressed during this one chains in early, before full recovery
      if (f.queued && f.hitDone && f.t >= tm.start + tm.active + tm.rec * .35 && f.stamina > MOVES[f.queued].cost) {
        const m = f.queued; f.queued = null; f.combo = Math.min(4, f.combo + 1);
        setState(f, 'attack'); f.move = m; f.hitDone = false; f.stamina -= MOVES[m].cost; return;
      }
      if (f.t >= tm.start + tm.active + tm.rec) { setState(f, 'idle'); f.move = null; f.combo = 0; f.queued = null; }
      return;
    }
    case 'shoot': {
      const s = SHOOT.start / k;
      if (f.t < s) f.x += f.facing * dt * 2.4;
      if (!f.hitDone && f.t >= s) {
        f.hitDone = true;
        const dist = Math.abs(o.x - f.x);
        if (dist <= SHOOT.range && !['down', 'ko', 'getup'].includes(o.state)) {
          const defending = o.state === 'block' || o.state === 'sprawl';
          const chance = .55 + (f.stats.wrestling - o.stats.wrestling) / 140 - (defending ? .28 : 0) + (100 - o.stamina) / 400 + (o.state === 'attack' ? .15 : 0);
          if (rand() < chance) { takedown(g, f, o); return; }
          setState(o, 'sprawl'); g.events.push({type: 'sprawl', side: o.side, x: o.x, power: .4, text: 'Sprawl!'});
          o.points += 1.5;
        } else g.events.push({type: 'whiff', side: f.side, x: f.x, power: .2});
      }
      if (f.t >= s + SHOOT.active + SHOOT.rec / k) { setState(f, 'idle'); f.hitDone = false; }
      return;
    }
    case 'sprawl': if (f.t > .45) setState(f, 'idle'); return;
    case 'stun': if (f.t > .38) setState(f, 'idle'); return;
    case 'down': if (f.t > 1.7) { if (f.hp <= 0) return finish(g, o, 'KO/TKO'); setState(f, 'getup'); } return;
    case 'getup': if (f.t > .5) { setState(f, 'idle'); f.invuln = .5; } return;
    default: return;
  }
}

function resolveHit(g: LiveFight, f: Fighter, o: Fighter, m: MoveId) {
  const d = MOVES[m];
  const dist = Math.abs(o.x - f.x), facingRight = (o.x - f.x) * f.facing > 0;
  if (!facingRight || dist > d.range || ['down', 'ko', 'getup'].includes(o.state) || o.invuln > 0) { g.events.push({type: 'whiff', side: f.side, x: f.x + f.facing * .8, power: .2}); return; }
  const tired = .65 + .35 * f.stamina / 100;
  let dmg = d.dmg * (.55 + f.stats.power / 100) * (1.25 - o.stats.chin / 200) * tired * (.85 + rand() * .3);
  const hx = (f.x + o.x) / 2;
  if (o.state === 'block' && (f.x - o.x) * o.facing > 0) {
    o.stamina = Math.max(0, o.stamina - dmg * .9); o.hp -= dmg * .12; o.x += f.facing * d.push * .6; g.hitstop = .03;
    g.events.push({type: 'block', side: o.side, x: hx, power: dmg / 10});
    if (o.stamina <= 0) setState(o, 'stun');
    return;
  }
  const counter = o.state === 'attack' ? 1.3 : 1;
  dmg *= counter * (1 + f.combo * .08);
  o.hp -= dmg; o.x += f.facing * d.push * (d.heavy ? 1.6 : 1); f.landed += 1; f.points += dmg;
  g.hitstop = d.heavy ? .085 : .045;
  g.events.push({type: 'hit', side: f.side, x: hx, power: dmg / 10, text: counter > 1 ? 'Counter!' : undefined});
  const kdChance = d.heavy ? .022 + (f.stats.power - o.stats.chin) / 700 + Math.max(0, 55 - o.hp) / 260 + (counter > 1 ? .08 : 0) + (m === 'upper' ? .04 : 0) : .0;
  if (o.hp <= 0 || rand() < kdChance) {
    o.kdRound += 1; f.knockdowns += 1; f.points += 12;
    setState(o, 'down'); o.move = null;
    const stoppage = o.hp <= 0 || o.kdRound >= 3 || (o.hp < 25 && rand() < .5);
    if (stoppage) { o.hp = Math.min(o.hp, 0); g.slowmo = 1.1; g.events.push({type: 'ko', side: f.side, x: o.x, power: 2, text: 'KNOCKOUT!'}); }
    else { o.hp = Math.max(o.hp, 6); g.events.push({type: 'kd', side: f.side, x: o.x, power: 1.4, text: 'Knockdown!'}); }
  } else setState(o, 'stun');
}

function takedown(g: LiveFight, f: Fighter, o: Fighter) {
  f.takedowns += 1; f.points += 5;
  setState(f, 'top'); setState(o, 'bottom'); f.move = null; o.move = null;
  o.x = f.x + f.facing * .55; o.escape = 0; f.sub = 0;
  g.events.push({type: 'td', side: f.side, x: o.x, power: 1, text: 'Takedown!'});
}

function ground(g: LiveFight, inputs: [Input, Input], pressed: [Input, Input], dt: number) {
  const top = g.f[0].state === 'top' ? g.f[0] : g.f[1], bot = top.side === 0 ? g.f[1] : g.f[0];
  const tp = pressed[top.side], bp = pressed[bot.side];
  // bottom player works to escape: mash any button
  const mash = bp.jab || bp.cross || bp.kick || bp.upper || bp.shoot || bp.block;
  if (top.sub === 0) {
    if (mash) bot.escape += .028 + bot.stats.wrestling / 1800 + bot.stats.grappling / 2800;
    bot.escape += dt * .085;
  }
  bot.escape -= dt * (.02 + top.stats.wrestling / 2500);
  if (top.sub > 0) {
    // submission attempt in progress
    top.sub += dt * (.37 + (top.stats.grappling - bot.stats.grappling) / 250) * (.6 + .4 * (1 - bot.stamina / 100));
    if (mash) top.sub -= .009 + bot.stats.grappling / 6000;
    if (top.sub >= 1) { g.events.push({type: 'tap', side: top.side, x: bot.x, power: 2, text: 'TAP OUT!'}); return finish(g, top, 'SUB'); }
    top.subClock += dt;
    if (top.subClock > 8) top.sub = 0;
    if (top.sub <= 0) { top.sub = 0; bot.escape += .3; g.events.push({type: 'escape', side: bot.side, x: bot.x, power: .6, text: 'Escaped!'}); }
  } else {
    if ((tp.jab || tp.cross || tp.upper) && top.gnpCd <= 0) {
      top.gnpCd = .42 / spd(top);
      const dmg = .9 * (.55 + top.stats.power / 100) * (1.25 - bot.stats.chin / 200);
      bot.hp -= dmg; top.points += dmg; top.landed += 1; top.stamina -= 2.5;
      g.events.push({type: 'hit', side: top.side, x: bot.x, power: dmg / 8});
      if (bot.hp <= 0) { g.slowmo = 1; g.events.push({type: 'ko', side: top.side, x: bot.x, power: 2, text: 'TKO! Ref stops it'}); return finish(g, top, 'KO/TKO'); }
    }
    if (tp.kick && top.stamina > 20) { top.sub = .18; top.subClock = 0; top.stamina -= 12; g.events.push({type: 'sub', side: top.side, x: bot.x, power: 1, text: ['Rear-naked choke!', 'Armbar!', 'Guillotine!', 'Kimura!'][Math.floor(rand() * 4)]}); }
  }
  top.points += dt * 1.2;
  if (bot.escape >= 1) {
    setState(top, 'idle'); setState(bot, 'getup'); top.sub = 0;
    bot.x = top.x + (bot.x > top.x ? 1 : -1) * .9;
    g.events.push({type: 'escape', side: bot.side, x: bot.x, power: .6, text: 'Back to the feet'});
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
  g.events.push({type: 'bell', side: 0, x: 0, power: 1, text: `End of round ${g.round}`});
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
  g.f.forEach((f, i) => { f.points = 0; f.kdRound = 0; f.x = i === 0 ? -1.6 : 1.6; f.facing = i === 0 ? 1 : -1; setState(f, 'idle'); f.stamina = Math.min(100, f.stamina + 35 * f.stats.cardio / 100 + 20); f.hp = Math.min(100, f.hp + 8); f.sub = 0; f.escape = 0; });
}

/* -------------------------------------------------------------------- AI */
export type AIBrain = {react: number; plan: number; want: Partial<Input>; level: number; chain: MoveId | null};
export const makeBrain = (level: number): AIBrain => ({react: 0, plan: 0, want: {}, level, chain: null});

export function aiInput(g: LiveFight, me: Fighter, them: Fighter, brain: AIBrain): {held: Input; pressed: Input} {
  const held = {...NO_INPUT}, pressed = {...NO_INPUT};
  if (g.phase !== 'fight') return {held, pressed};
  brain.react -= DT; brain.plan -= DT;
  const lvl = brain.level; // 0..1
  if (me.state === 'bottom') { if (rand() < .06 + lvl * .1) pressed.jab = true; return {held, pressed}; }
  if (me.state === 'top') {
    if (me.sub === 0 && brain.plan <= 0) { brain.plan = .5; if (me.stats.grappling > 55 && rand() < .25 + lvl * .2) pressed.kick = true; }
    if (rand() < .12 + lvl * .1) pressed.jab = true;
    return {held, pressed};
  }
  const dist = Math.abs(them.x - me.x), toward = them.x > me.x ? 'right' : 'left', away = toward === 'right' ? 'left' : 'right';
  const ideal = me.style === 'Wrestler' || me.style === 'Grappler' ? 1.15 : me.style === 'Striker' ? 1.3 : 1.22;
  // defend: react to an incoming attack
  if (them.state === 'attack' || them.state === 'shoot') {
    if (brain.react <= 0) { brain.react = .35 - lvl * .2; brain.want = rand() < (them.state === 'shoot' ? .45 : .25) + lvl * .5 ? {block: true} : rand() < .3 ? {[away]: true} : {}; }
  } else if (brain.plan <= 0) {
    brain.plan = .18 + rand() * (.4 - lvl * .22);
    brain.want = {};
    if (me.stamina < 25) brain.want = {[away]: true, block: rand() < .5};
    else if (dist > ideal + .25) brain.want = {[toward]: true};
    else if (dist < ideal - .45 && me.style === 'Striker') brain.want = {[away]: true};
    else {
      const r = rand();
      const grappler = me.style === 'Wrestler' || me.style === 'Grappler';
      if (grappler && r < .28 && dist < 1.35) brain.want = {shoot: true};
      else if (r < .45) brain.want = {jab: true};
      else if (r < .65) brain.want = {cross: true};
      else if (r < .76) brain.want = {kick: true};
      else if (r < .82 && dist < 1) brain.want = {upper: true};
      else if (r < .9) brain.want = {block: true};
      else brain.want = {[away]: true};
    }
    for (const k of ['jab', 'cross', 'kick', 'upper', 'shoot'] as const) if (brain.want[k]) { pressed[k] = true; brain.want[k] = false; }
    if ((pressed.jab || pressed.cross) && rand() < .35 + lvl * .35) brain.chain = rand() < .5 ? 'cross' : rand() < .5 ? 'kick' : 'upper';
  }
  if (brain.chain && me.state === 'attack' && me.hitDone) { pressed[brain.chain] = true; brain.chain = null;
  }
  held.block = !!brain.want.block; held.left = !!brain.want.left; held.right = !!brain.want.right;
  return {held, pressed};
}
