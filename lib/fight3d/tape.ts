// Tale of the tape: the numbers a broadcast shows before a fight. Height and reach are stable per
// fighter (derived from the division and the name), weight is the division limit at the weigh-in,
// and the odds come from the skill gap, shown as a moneyline the way sportsbooks print it.
import {overall, type Stats, type Style} from '../career/engine';

export type Tape = {name: string; nickname?: string; record: string; country?: string; age: number; height: string; weight: string; reach: string; rank?: string; odds: string; fav: boolean; style: Style; model?: string};
export type FightCard = {event: string; billing: string; title?: string; you: Tape; opp: Tape};

const DIV: Record<string, [number, number]> = {   // [weight limit lb, typical height inches]
  Flyweight: [125, 65], Bantamweight: [135, 67], Featherweight: [145, 68.5], Lightweight: [155, 70],
  Welterweight: [170, 72], Middleweight: [185, 73.5], 'Light Heavyweight': [205, 75], Heavyweight: [265, 76],
};
const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const feet = (inches: number) => `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;

/** probability that a beats b, from overall ratings */
export const winChance = (a: Stats, b: Stats) => 1 / (1 + Math.exp(-(overall(a) - overall(b)) / 7));
/** American moneyline for a win probability, rounded like a book would */
export function moneyline(p: number) {
  const q = Math.min(.95, Math.max(.05, p));
  const n = q >= .5 ? -(q / (1 - q)) * 100 : ((1 - q) / q) * 100;
  const r = Math.round(n / 5) * 5;
  return (r > 0 ? '+' : '') + (Math.abs(r) < 105 ? (q >= .5 ? -105 : 105) : r);
}

export function tape(f: {name: string; nickname?: string; style: Style; stats: Stats; country?: string; age?: number; record?: string; rank?: string; model?: string}, opp: Stats, division = 'Lightweight'): Tape {
  const [lb, base] = DIV[division] ?? DIV.Lightweight;
  const h = base + (hash(f.name + 'h') - .5) * 4;
  const reach = h + (hash(f.name + 'r') * 4.5 - 1) + (f.style === 'Striker' ? 1 : 0);
  const p = winChance(f.stats, opp);
  return {
    name: f.name, nickname: f.nickname, country: f.country, style: f.style, rank: f.rank, model: f.model,
    record: f.record ?? `${8 + Math.floor(hash(f.name + 'w') * 16)}-${Math.floor(hash(f.name + 'l') * 6)}`,
    age: f.age ?? 23 + Math.floor(hash(f.name + 'a') * 13),
    height: feet(h), weight: (lb + (hash(f.name + 'kg') < .5 ? .5 : 0)).toFixed(1), reach: `${(Math.round(reach * 2) / 2).toFixed(1).replace('.0', '')}"`,
    odds: String(moneyline(p)), fav: p >= .5,
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