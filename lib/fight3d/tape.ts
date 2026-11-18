// Tale of the tape: the numbers a broadcast shows before a fight. Height and reach are stable per
// fighter (derived from the division and the name), weight is the division limit at the weigh-in,
// and the odds come from the skill gap, shown as a moneyline the way sportsbooks print it.
import {overall, type Stats, type Style} from '../career/engine';

export type Tape = {name: string; nickname?: string; record: string; country?: string; age: number; height: string; weight: string; reach: string; rank?: string; odds: string; fav: boolean; style: Style; model?: string; prob?: number};
export type FightCard = {event: string; billing: string; title?: string; you: Tape; opp: Tape};

const DIV: Record<string, [number, number]> = {   // [weight limit lb, typical height inches]
  Flyweight: [125, 65], Bantamweight: [135, 67], Featherweight: [145, 68.5], Lightweight: [155, 70],
  Welterweight: [170, 72], Middleweight: [185, 73.5], 'Light Heavyweight': [205, 75], Heavyweight: [265, 76],
};
const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const feet = (inches: number) => `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;

/** one corner as the oddsmakers see it */
export type Side = {name?: string; stats: Stats; style?: Style; record?: string; age?: number; rank?: string};
const recordOf = (f: {name: string; record?: string}) => f.record ?? `${8 + Math.floor(hash(f.name + 'w') * 16)}-${Math.floor(hash(f.name + 'l') * 6)}`;
const ageOf = (f: {name: string; age?: number}) => f.age ?? 23 + Math.floor(hash(f.name + 'a') * 13);
/** Fair probability that a beats b, the way a sportsbook builds a line: mostly the skill gap, then form
 *  (record, regressed toward .500 so a 3-0 prospect isn't priced like a 15-0 champ), age past 34, the
 *  respect the market gives champions and ranked names, and the classic wrestler-over-striker edge.
 *  Calibrated so typical favourites land at -150 to -300 and win about two thirds of the time, as UFC
 *  favourites do; real mismatches go past -500. */
export function winProb(a: Side, b: Side) {
  let x = (overall(a.stats) - overall(b.stats)) / 5.5;
  const wr = (s?: string) => { if (!s) return .5; const [w, l] = s.split('-').map(Number); return (w + 2.5) / (w + l + 5); };
  x += (wr(a.record) - wr(b.record)) * 1.4;
  const old = (n?: number) => n && n > 34 ? (n - 34) * .07 : 0; x += old(b.age) - old(a.age);
  const rk = (r?: string) => r === 'C' ? .25 : r?.startsWith('#') ? Math.max(0, (16 - Number(r.slice(1))) * .012) : 0; x += rk(a.rank) - rk(b.rank);
  if (a.style === 'Wrestler' && b.style === 'Striker') x += .15; else if (b.style === 'Wrestler' && a.style === 'Striker') x -= .15;
  return Math.min(.96, Math.max(.04, 1 / (1 + Math.exp(-x))));
}
/** kept for older callers: skill gap only */
export const winChance = (a: Stats, b: Stats) => winProb({stats: a}, {stats: b});
/** American moneyline for a fair probability with the book's margin (~4.5% overround) on top,
 *  rounded the way books print them: an even fight is -110 / -110 */
export function moneyline(p: number, vig = .045) {
  const i = Math.min(.97, Math.max(.03, p * (1 + vig)));
  const n = i >= .5 ? -(i / (1 - i)) * 100 : ((1 - i) / i) * 100;
  const step = Math.abs(n) < 200 ? 5 : Math.abs(n) < 500 ? 10 : 25;
  const r = Math.round(n / step) * step;
  return (r > 0 ? '+' : '') + (Math.abs(r) < 100 ? (r < 0 ? -100 : 100) : r);
}

export function tape(f: {name: string; nickname?: string; style: Style; stats: Stats; country?: string; age?: number; record?: string; rank?: string; model?: string}, opp: Stats | (Side & {name: string}), division = 'Lightweight'): Tape & {prob: number} {
  const [lb, base] = DIV[division] ?? DIV.Lightweight;
  const h = base + (hash(f.name + 'h') - .5) * 4;
  const reach = h + (hash(f.name + 'r') * 4.5 - 1) + (f.style === 'Striker' ? 1 : 0);
  const me: Side = {stats: f.stats, style: f.style, record: recordOf(f), age: ageOf(f), rank: f.rank};
  const them: Side = 'stats' in opp ? {stats: opp.stats, style: opp.style, record: recordOf(opp), age: ageOf(opp), rank: opp.rank} : {stats: opp as Stats};
  const p = winProb(me, them);
  return {
    name: f.name, nickname: f.nickname, country: f.country, style: f.style, rank: f.rank, model: f.model,
    record: me.record!, age: me.age!,
    height: feet(h), weight: (lb + (hash(f.name + 'kg') < .5 ? .5 : 0)).toFixed(1), reach: `${(Math.round(reach * 2) / 2).toFixed(1).replace('.0', '')}"`,
    odds: String(moneyline(p)), fav: p >= .5, prob: p,
  };
}

// original MakeHuman fighter bodies built by scripts/art/build_fighter_mh.py (portraits: public/fighters/<model>.webp)
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
/** bodies for both corners, never the same one twice */
export function pairModels(red: string, blue: string): [FighterModel, FighterModel] {
  const a = modelFor(red); let b = modelFor(blue);
  if (b === a) b = modelFor(blue + ' blue');
  if (b === a) b = FIGHTER_MODELS[(FIGHTER_MODELS.indexOf(a) + 1) % FIGHTER_MODELS.length];
  return [a, b];
}
/** give both corners a body/portrait (never the same one) unless the card already names them */
export function withModels(card: FightCard): FightCard {
  const [a, b] = pairModels(card.you.name, card.opp.name);
  return {...card, you: {...card.you, model: card.you.model ?? a}, opp: {...card.opp, model: card.opp.model ?? b}};
}