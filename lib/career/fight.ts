// VERSUS career mode: round-by-round fight simulation.
import {rng, type Plan, type Stats, type Style} from './engine';

export const PLANS: Record<Plan, {blurb: string; tone: string}> = {
  Pressure: {blurb: 'Walk them down. More volume, more damage, burns gas.', tone: 'pink'},
  Counter: {blurb: 'Make them miss. Sharper shots when they come forward.', tone: 'sky'},
  Wrestle: {blurb: 'Shoot takedowns and grind from top position.', tone: 'lime'},
  Submit: {blurb: 'Hunt the neck and limbs. Risky, fight-ending.', tone: 'violet'},
  Coast: {blurb: 'Breathe and stay safe. Recovers stamina, loses rounds.', tone: 'sun'},
};

export type Corner = {name: string; stats: Stats; style: Style; hp: number; stamina: number; landed: number; takedowns: number; control: number; knockdowns: number};
export type RoundLine = {text: string; side: 'you' | 'opp' | 'ref'; big?: boolean};
export type FightState = {
  seed: number; round: number; rounds: number; you: Corner; opp: Corner;
  rounds_log: {round: number; lines: RoundLine[]; you: number; opp: number}[];
  cards: [number, number][]; done: boolean;
  outcome?: {winner: 'you' | 'opp' | 'draw'; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; damageTaken: number};
};

const corner = (name: string, stats: Stats, style: Style): Corner => ({name, stats, style, hp: 100, stamina: 100, landed: 0, takedowns: 0, control: 0, knockdowns: 0});
export function startFight(you: {name: string; stats: Stats; style: Style}, opp: {name: string; stats: Stats; style: Style}, rounds: 3 | 5, seed: number): FightState {
  return {seed, round: 1, rounds, you: corner(you.name, you.stats, you.style), opp: corner(opp.name, opp.stats, opp.style), rounds_log: [], cards: [[0, 0], [0, 0], [0, 0]], done: false};
}

export function aiPlan(c: Corner, other: Corner, r: () => number): Plan {
  if (c.stamina < 35 && r() < .5) return 'Coast';
  const s = c.stats;
  const options: [Plan, number][] = [
    ['Pressure', s.striking + s.power + (other.hp < 50 ? 30 : 0)],
    ['Counter', s.striking + s.speed + s.iq * .5],
    ['Wrestle', s.wrestling * 1.6 + (other.stats.wrestling < 50 ? 15 : 0)],
    ['Submit', s.grappling * 1.5],
  ];
  const total = options.reduce((a, [, w]) => a + w * w, 0);
  let roll = r() * total;
  for (const [p, w] of options) { roll -= w * w; if (roll <= 0) return p; }
  return 'Pressure';
}

// pick the 'you' or 'they' wording of a move line
const say = (who: 'you' | 'opp', pair: readonly [string, string]) => who === 'you' ? pair[0] : pair[1];
const eff = (c: Corner, k: keyof Stats) => c.stats[k] * (.55 + .45 * c.stamina / 100);

export function fightRound(prev: FightState, plan: Plan): FightState {
  if (prev.done) return prev;
  const f: FightState = structuredClone(prev);
  const r = rng(f.seed + f.round * 977);
  const oppPlan = aiPlan(f.opp, f.you, r);
  const lines: RoundLine[] = [{text: `Round ${f.round}. You go ${plan.toLowerCase()}, ${f.opp.name.split(' ')[0]} looks to ${oppPlan.toLowerCase()}.`, side: 'ref'}];
  const sides = [{me: f.you, them: f.opp, plan, who: 'you' as const}, {me: f.opp, them: f.you, plan: oppPlan, who: 'opp' as const}];
  const roundPts = {you: 0, opp: 0};
  let ground: 'you' | 'opp' | null = null;

  for (let ex = 0; ex < 10 && !f.done; ex++) {
    for (const s of sides) s.me.stamina = Math.max(5, Math.min(100, s.me.stamina - ({Pressure: 2.4, Counter: 1.4, Wrestle: 2.6, Submit: 2, Coast: -2.5}[s.plan]) * (1.4 - s.me.stats.cardio / 100)));
    // initiative: who acts this exchange
    const w0 = eff(f.you, 'speed') + eff(f.you, 'iq') * .5 + (plan === 'Pressure' ? 20 : plan === 'Coast' ? -30 : 0);
    const w1 = eff(f.opp, 'speed') + eff(f.opp, 'iq') * .5 + (oppPlan === 'Pressure' ? 20 : oppPlan === 'Coast' ? -30 : 0);
    const s = r() < w0 / (w0 + w1) ? sides[0] : sides[1];
    const name = s.who === 'you' ? 'You' : s.me.name.split(' ')[0];
    const other = s.who === 'you' ? f.opp.name.split(' ')[0] : 'you';

    if (ground) {
      const top = ground === 'you' ? sides[0] : sides[1], bottom = ground === 'you' ? sides[1] : sides[0];
      top.me.control += 1; roundPts[top.who] += 1.2;
      if (r() < .18 + (eff(bottom.me, 'wrestling') - eff(top.me, 'wrestling')) / 200) { ground = null; lines.push({text: `${bottom.who === 'you' ? 'You' : bottom.me.name.split(' ')[0]} ${say(bottom.who, ['scramble', 'scrambles'])} back to the feet.`, side: bottom.who}); continue; }
      if ((top.plan === 'Submit' || r() < .35) && r() < (top.plan === 'Submit' ? .3 : .14)) {
        const sub = (eff(top.me, 'grappling') - eff(bottom.me, 'grappling') * .85 + (100 - bottom.me.stamina) * .25) / 100;
        lines.push({text: `${top.who === 'you' ? 'You' : top.me.name.split(' ')[0]} ${say(top.who, ['lock', 'locks'])} up a ${['rear-naked choke', 'guillotine', 'armbar', 'kimura', 'triangle'][Math.floor(r() * 5)]}!`, side: top.who, big: true});
        if (r() < Math.max(.06, sub * .9 + .2)) { finish(f, top.who, 'SUB', lines); break; }
        lines.push({text: `${bottom.who === 'you' ? 'You' : bottom.me.name.split(' ')[0]} ${say(bottom.who, ['survive and escape', 'survives and escapes'])}.`, side: bottom.who}); ground = null; continue;
      }
      const gnp = Math.max(1, eff(top.me, 'power') / 12 * (.6 + r() * .8) * (110 - bottom.me.stats.chin) / 60);
      bottom.me.hp -= gnp; top.me.landed += 1; roundPts[top.who] += gnp * .5;
      if (r() < .35) lines.push({text: `Ground and pound from ${top.who === 'you' ? 'you' : top.me.name.split(' ')[0]}.`, side: top.who});
      if (bottom.me.hp <= 0) { finish(f, top.who, 'KO/TKO', lines); break; }
      continue;
    }

    if (s.plan === 'Wrestle' || (s.plan === 'Submit' && r() < .6)) {
      const td = .25 + (eff(s.me, 'wrestling') - eff(s.them, 'wrestling') * .9) / 120;
      if (r() < td) { ground = s.who; s.me.takedowns += 1; roundPts[s.who] += 3; lines.push({text: `${name} ${say(s.who, ([['shoot a double leg', 'shoots a double leg'], ['chain a single into a trip', 'chains a single into a trip'], ['hit a body lock takedown', 'hits a body lock takedown'], ['drag them down against the cage', 'drags you down against the cage']] as const)[Math.floor(r() * 4)])}. ${s.who === 'you' ? 'You are on top.' : 'They are on top.'}`, side: s.who}); }
      else { roundPts[s.who === 'you' ? 'opp' : 'you'] += .8; if (r() < .4) lines.push({text: `${other === 'you' ? 'You ' + ['stuff the shot', 'sprawl hard', 'shut down the takedown', 'pummel free'][Math.floor(r() * 4)] : other + ' ' + ['stuffs the shot', 'sprawls hard', 'shuts down the takedown', 'pummels free'][Math.floor(r() * 4)]}.`, side: s.who === 'you' ? 'opp' : 'you'}); }
      continue;
    }

    // striking exchange
    const counterBonus = (s.plan === 'Counter' && (s.who === 'you' ? oppPlan : plan) === 'Pressure') ? 15 : 0;
    const acc = .38 + (eff(s.me, 'striking') + counterBonus - eff(s.them, 'speed') * .6 - eff(s.them, 'iq') * .2) / 160;
    const shots = s.plan === 'Pressure' ? 2 : s.plan === 'Coast' ? 0 : 1;
    for (let k = 0; k < shots + 1; k++) {
      if (r() > acc) continue;
      let dmg = (eff(s.me, 'power') / 14) * (.5 + r()) * (115 - s.them.stats.chin) / 70 * (s.plan === 'Coast' ? .4 : 1);
      const crit = s.plan !== 'Coast' && r() < .028 + (eff(s.me, 'power') - s.them.stats.chin) / 900 + (100 - s.them.hp) / 1400 + counterBonus / 600;
      if (crit) dmg *= 2.6;
      s.them.hp -= dmg; s.me.landed += 1; roundPts[s.who] += 1 + dmg * .4;
      if (crit) {
        s.me.knockdowns += 1; roundPts[s.who] += 5;
        lines.push({text: `${name} ${say(s.who, ([['crack them with a right hand', 'cracks you with a right hand'], ['land a head kick', 'lands a head kick'], ['counter with a perfect hook', 'counters with a perfect hook'], ['drop them with an uppercut', 'drops you with an uppercut']] as const)[Math.floor(r() * 4)])}! ${other === 'you' ? 'You are' : other + ' is'} hurt!`, side: s.who, big: true});
        if (r() < .3 + Math.max(0, 70 - s.them.hp) / 90 + (eff(s.me, 'power') - s.them.stats.chin) / 250) { finish(f, s.who, 'KO/TKO', lines); break; }
      } else if (r() < .25) lines.push({text: `${name} ${say(s.who, ([['land a stiff jab', 'lands a stiff jab'], ['chop the lead leg', 'chops the lead leg'], ['go to the body', 'goes to the body'], ['snap a clean one-two', 'snaps a clean one-two']] as const)[Math.floor(r() * 4)])}.`, side: s.who});
      if (s.them.hp <= 0) { finish(f, s.who, 'KO/TKO', lines); break; }
    }
  }

  // between rounds recovery + judges
  if (!f.done) {
    for (const c of [f.you, f.opp]) { c.stamina = Math.min(100, c.stamina + 22 * c.stats.cardio / 100); c.hp = Math.min(100, c.hp + 5); }
    for (const card of f.cards) {
      const noise = (r() - .5) * 3;
      const youWin = roundPts.you + noise > roundPts.opp;
      const wide = Math.abs(roundPts.you - roundPts.opp) > 26;
      card[0] += youWin ? 10 : wide ? 8 : 9; card[1] += youWin ? (wide ? 8 : 9) : 10;
    }
    lines.push({text: `End of round ${f.round}.`, side: 'ref'});
  }
  f.rounds_log.push({round: f.round, lines, you: Math.round(roundPts.you), opp: Math.round(roundPts.opp)});
  if (!f.done && f.round >= f.rounds) decide(f);
  else if (!f.done) f.round += 1;
  return f;
}

function finish(f: FightState, who: 'you' | 'opp', method: 'KO/TKO' | 'SUB', lines: RoundLine[]) {
  f.done = true;
  lines.push({text: who === 'you' ? `IT'S OVER! You win by ${method}!` : `It's over. ${f.opp.name} wins by ${method}.`, side: who, big: true});
  f.outcome = {winner: who, method, round: f.round, damageTaken: Math.round(100 - Math.max(0, f.you.hp))};
}

function decide(f: FightState) {
  f.done = true;
  const votes = f.cards.map(([a, b]) => a > b ? 1 : a < b ? -1 : 0);
  const sum = votes.reduce((a: number, b) => a + b, 0);
  const winner = sum > 0 ? 'you' : sum < 0 ? 'opp' : 'draw';
  const split = winner !== 'draw' && votes.some(v => v !== Math.sign(sum));
  f.outcome = {winner, method: winner === 'draw' ? 'DRAW' : split ? 'SPLIT DEC' : 'DEC', round: f.rounds, damageTaken: Math.round(100 - Math.max(0, f.you.hp))};
}
