// VERSUS career mode: the rules. Pure functions over a plain save object so the
// game is easy to test and to store (localStorage now, an account later).
import type {Look} from '../cosmetics';

export type StatKey = 'striking' | 'power' | 'wrestling' | 'grappling' | 'cardio' | 'chin' | 'speed' | 'iq';
export type Stats = Record<StatKey, number>;
export type Style = 'Striker' | 'Wrestler' | 'Grappler' | 'All-rounder';
export type Plan = 'Pressure' | 'Counter' | 'Wrestle' | 'Submit' | 'Coast';
export const STAT_KEYS: StatKey[] = ['striking', 'power', 'speed', 'wrestling', 'grappling', 'cardio', 'chin', 'iq'];
export const STAT_LABEL: Record<StatKey, string> = {striking: 'Striking', power: 'Power', speed: 'Speed', wrestling: 'Wrestling', grappling: 'Grappling', cardio: 'Cardio', chin: 'Chin', iq: 'Fight IQ'};
export const DIVISIONS = ['Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight'] as const;
export type Division = typeof DIVISIONS[number];
export const STYLES: Record<Style, {blurb: string; bias: Partial<Stats>}> = {
  'Striker': {blurb: 'Hands and kicks. Ends fights on the feet.', bias: {striking: 12, power: 8, speed: 6, wrestling: -6, grappling: -8}},
  'Wrestler': {blurb: 'Takedowns, top control and a deep gas tank.', bias: {wrestling: 14, cardio: 8, chin: 4, striking: -6, speed: -4}},
  'Grappler': {blurb: 'Drags it to the mat and hunts the neck.', bias: {grappling: 16, wrestling: 4, iq: 4, power: -6, striking: -6}},
  'All-rounder': {blurb: 'No glaring holes. Grows in every direction.', bias: {iq: 6, cardio: 4}},
};
export const TIERS = [
  {name: 'Basement Brawl League', short: 'Regional', color: 'sky'},
  {name: 'Neon Contender Series', short: 'Contender', color: 'violet'},
  {name: 'VERSUS Championship', short: 'Major', color: 'sun'},
] as const;

export type NPC = {id: string; name: string; nickname: string; country: string; style: Style; stats: Stats; record: [number, number]; age: number; color: string; tier: number};
export type FightRecord = {week: number; age: number; opponent: string; opponentId: string; result: 'W' | 'L' | 'D'; method: string; round: number; tier: number; title: boolean; purse: number};
export type Tag = 'rematch' | 'grudge' | 'short' | 'eliminator';
export type Offer = {id: string; opponentId: string; tier: number; purse: number; winBonus: number; weeksOut: number; rounds: 3 | 5; title: boolean; note: string; tag?: Tag};
/** event: the card it's on ('VERSUS 214'); billing: where on the card; edge: how fired up the opponent is (live fight difficulty) */
export type Camp = Omit<Offer, 'weeksOut'> & {weeksLeft: number; event?: string; billing?: string; edge?: number; pressDone?: boolean;
  /** 0 home gym, 1 pro camp, 2 elite camp (bought with money: better fitness gains, sparring partners, scouting) */
  level?: number; scouted?: boolean; cutDone?: boolean; missedWeight?: boolean};
export type Rival = {id: string; heat: number; why: string};
export type Choice = {kind: 'press' | 'event'; id?: string; from?: string; title: string; text: string; options: {id: string; label: string; hint: string}[]; target?: string};
export type LogEntry = {week: number; text: string; tone?: 'good' | 'bad' | 'big'};
export type Post = {week: number; handle: string; text: string; likes: number; you?: boolean};
export type Milestone = {week: number; age: number; text: string};
export type CoachKey = 'striking' | 'wrestling' | 'bjj' | 'sc';
export type Payout = {gross: number; manager: number; gym: number; camp: number; net: number; bonus: number};
export type Career = {
  version: 1; seed: number;
  name: string; nickname: string; country: string; division: Division; style: Style; color: string;
  stats: Stats; potential: number;
  record: [number, number, number]; finishes: {ko: number; sub: number; dec: number};
  week: number; age: number; energy: number; health: number; injuryWeeks: number; hype: number; money: number;
  tier: number; rank: number | null; champ: boolean; defenses: number; tierWins: number;
  roster: NPC[]; rankings: string[]; champion: string | null;
  offers: Offer[]; camp: Camp | null; history: FightRecord[]; log: LogEntry[]; retired: boolean; nextOfferWeek: number;
  // storylines (optional so older saves load; migrate() fills them in)
  rivals?: Rival[]; choice?: Choice | null; eventNo?: [number, number, number]; bonuses?: {potn: number; fotn: number};
  lineage?: {week: number; name: string; how: string}[]; coachWeeks?: number;
  // the person behind the fighter (optional: migrate() fills them in on older saves)
  look?: Look; backstory?: string; gym?: string; owned?: string[];
  team?: Partial<Record<CoachKey, number>>;       // hired coaches: 1 = local, 2 = elite (weekly salary)
  fitness?: number; followers?: number; feed?: Post[]; milestones?: Milestone[];
  earnings?: number; lastPayout?: Payout | null; payBump?: number; homecoming?: boolean; streak?: number;
};

/* ---------------------------------------------------------------- random */
export function rng(seed: number) {
  let t = seed >>> 0;
  return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; };
}
const clamp = (n: number, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, n));
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
export const overall = (s: Stats) => Math.round(STAT_KEYS.reduce((a, k) => a + s[k], 0) / STAT_KEYS.length);

/* ------------------------------------------------------------ name pools */
const FIRST = ['Mateo', 'Kenji', 'Dario', 'Tomasz', 'Rafael', 'Idris', 'Luka', 'Bilal', 'Cyrus', 'Arlo', 'Nikolai', 'Teo', 'Marcus', 'Joao', 'Kofi', 'Ryo', 'Emil', 'Santiago', 'Farid', 'Dante', 'Hugo', 'Zane', 'Ilya', 'Kai', 'Osei', 'Viktor', 'Enzo', 'Ruben', 'Taro', 'Malik', 'Andrei', 'Sione', 'Bruno', 'Yusuf', 'Leon', 'Pedro'];
const LAST = ['Varga', 'Okafor', 'Lindqvist', 'Moreau', 'Tanaka', 'Ferreira', 'Kowal', 'Haddad', 'Nakamura', 'Bianchi', 'Petrov', 'Mendes', 'Ashford', 'Delacroix', 'Kaya', 'Sorensen', 'Abara', 'Quintero', 'Volkov', 'Nunez', 'Halloran', 'Achebe', 'Ibarra', 'Strand', 'Mwangi', 'Castell', 'Rourke', 'Takeda', 'Zielinski', 'Arcos', 'Dumont', 'Kalani', 'Brask', 'Oyelaran', 'Vance', 'Sato'];
const NICK = ['The Lighthouse', 'Static', 'Bulldozer', 'Paper Cut', 'Night Shift', 'Riptide', 'The Mechanic', 'Slow Burn', 'Sandman', 'Tremor', 'Ghost Pepper', 'The Surgeon', 'Hammerhead', 'Low Tide', 'Gravity', 'Mr. Overtime', 'The Locksmith', 'Comet', 'Brick House', 'Undertow', 'Firefly', 'The Accountant', 'Monsoon', 'Lockjaw'];
const COUNTRIES = ['United States', 'Brazil', 'Japan', 'Poland', 'Nigeria', 'Mexico', 'England', 'Russia', 'France', 'Australia', 'Sweden', 'New Zealand', 'Georgia', 'Ireland', 'Canada', 'South Korea'];
const COLORS = ['#bfe36b', '#e58fb6', '#86c4dc', '#e9c873', '#968fd6', '#e8a07a', '#7fd1b3'];
export const START_COUNTRIES = COUNTRIES;
export const FIGHTER_COLORS = COLORS;

function statsFor(r: () => number, base: number, style: Style): Stats {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = clamp(Math.round(base + (r() - .5) * 14 + (STYLES[style].bias[k] ?? 0)), 15, 97);
  return s;
}

function makeNPC(r: () => number, tier: number, i: number): NPC {
  const style = pick(r, Object.keys(STYLES) as Style[]);
  const base = [44, 58, 70][tier] + (r() - .5) * 12 + (tier === 2 ? (15 - i) * .7 : 0);
  const w = Math.floor(r() * 6) + tier * 5 + 2, l = Math.floor(r() * 4) + (tier === 0 ? 1 : 0);
  return {id: `npc-${tier}-${i}-${Math.floor(r() * 1e6)}`, name: `${pick(r, FIRST)} ${pick(r, LAST)}`, nickname: pick(r, NICK), country: pick(r, COUNTRIES), style, stats: statsFor(r, base, style), record: [w, l], age: 22 + Math.floor(r() * 13), color: pick(r, COLORS), tier};
}

/* --------------------------------------------------------------- create */
/** where you came from: a head start in one area and the first line of your story */
export const BACKSTORIES: Record<string, {label: string; blurb: string; bonus: Partial<Stats>; money?: number; hype?: number; line: string}> = {
  wrestler: {label: 'College wrestler', blurb: 'Four years on a wrestling scholarship. Takes people down for a living.', bonus: {wrestling: 6, cardio: 3}, line: 'The college wrestler who traded singlets for four-ounce gloves.'},
  street: {label: 'Street fighter', blurb: 'Learned in car parks and backyards. Hits hard, takes a shot.', bonus: {power: 5, chin: 4, iq: -2}, hype: 6, line: 'The backyard brawler with a viral knockout reel.'},
  kickboxer: {label: 'Kickboxing champ', blurb: 'National amateur kickboxing title. Sharp on the feet.', bonus: {striking: 6, speed: 3}, line: 'A national kickboxing champion trying a new sport.'},
  bjj: {label: 'Jiu-jitsu prodigy', blurb: 'Black belt at 20. Wants every fight on the mat.', bonus: {grappling: 7, iq: 2}, line: 'The jiu-jitsu prodigy who got his black belt at 20.'},
  late: {label: 'Late starter', blurb: 'Walked into a gym at 19 after a desk job. Smart, saved some money.', bonus: {iq: 4, cardio: 2}, money: 2500, line: 'A late starter who quit a desk job to chase this.'},
};
/** your home gym: training there makes some stats grow faster */
export const GYMS: Record<string, {label: string; blurb: string; boost: StatKey[]}> = {
  ironside: {label: 'Ironside Wrestling Club', blurb: 'Grinding room. Wrestling and cardio grow faster.', boost: ['wrestling', 'cardio']},
  neon: {label: 'Neon Muay Thai', blurb: 'Pad work all day. Striking and power grow faster.', boost: ['striking', 'power']},
  lockdown: {label: 'Lockdown Jiu-Jitsu', blurb: 'Mat rats. Grappling and fight IQ grow faster.', boost: ['grappling', 'iq']},
  apex: {label: 'Apex Performance', blurb: 'Sports science lab. Speed, cardio and chin grow faster.', boost: ['speed', 'cardio', 'chin']},
};
export function createCareer(input: {name: string; nickname: string; country: string; division: Division; style: Style; color: string; backstory?: string; gym?: string; look?: Look}, seed = Date.now()): Career {
  const r = rng(seed);
  const roster: NPC[] = [];
  for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 16; i++) roster.push(makeNPC(r, tier, i));
  const major = roster.filter(n => n.tier === 2).sort((a, b) => overall(b.stats) - overall(a.stats));
  const bs = BACKSTORIES[input.backstory ?? ''];
  const stats = statsFor(r, 38, input.style);
  if (bs) for (const [k, v] of Object.entries(bs.bonus)) stats[k as StatKey] = clamp(stats[k as StatKey] + (v ?? 0));
  const c: Career = {
    version: 1, seed, ...input,
    stats, potential: 82 + Math.floor(r() * 14),
    record: [0, 0, 0], finishes: {ko: 0, sub: 0, dec: 0},
    week: 1, age: 21, energy: 100, health: 100, injuryWeeks: 0, hype: 5, money: 500,
    tier: 0, rank: null, champ: false, defenses: 0, tierWins: 0,
    roster, rankings: major.slice(1).map(n => n.id), champion: major[0].id,
    offers: [], camp: null, history: [], log: [], retired: false, nextOfferWeek: 1,
  };
  if (bs) { c.money += bs.money ?? 0; c.hype += bs.hype ?? 0; }
  c.log.push({week: 1, text: `${input.name} signs with the ${TIERS[0].name}. Every legend starts in a basement.`, tone: 'big'});
  migrate(c);   // seeds the title lineage with the reigning champion
  milestone(c, bs ? bs.line : `${input.name} turns pro at 21.`);
  if (input.gym && GYMS[input.gym]) milestone(c, `Joins ${GYMS[input.gym].label}.`);
  post(c, '@BasementBrawlHQ', `New signing: ${input.name}${input.nickname ? ` "${input.nickname}"` : ''} out of ${input.country}. ${bs ? bs.line : 'Raw, hungry, 21.'}`, 40);
  return withOffers(c, r);
}

/* -------------------------------------------------------------- weekly */
export type Action = {type: 'train'; focus: StatKey} | {type: 'spar'} | {type: 'rest'} | {type: 'promote'} | {type: 'tape'};
export const ACTIONS = {
  train: {label: 'Train', energy: -18, blurb: 'Big gains in one stat. Builds fight fitness in camp. Tiring.'},
  spar: {label: 'Spar', energy: -12, blurb: 'Small gains in a few stats, builds fitness. Small knock risk.'},
  rest: {label: 'Rest', energy: +35, blurb: 'Recover energy and heal up.'},
  promote: {label: 'Promote', energy: -8, blurb: 'Interviews and socials. Hype = more offers, bigger names, reach fights. Costs fitness in camp.'},
  tape: {label: 'Study tape', energy: -5, blurb: 'Break down his last fights. You learn his habits and he becomes easier to read on fight night.'},
} as const;

/* ------------------------------------------------------------ the team */
/** coaches you pay every week; they speed up growth in their stats */
export const COACHES: Record<CoachKey, {label: string; stats: StatKey[]; pay: [number, number, number]}> = {
  striking: {label: 'Striking coach', stats: ['striking', 'power'], pay: [0, 180, 1400]},
  wrestling: {label: 'Wrestling coach', stats: ['wrestling'], pay: [0, 160, 1200]},
  bjj: {label: 'Jiu-jitsu coach', stats: ['grappling', 'iq'], pay: [0, 160, 1200]},
  sc: {label: 'Strength & conditioning', stats: ['cardio', 'speed', 'chin'], pay: [0, 200, 1500]},
};
export const LIVING = [140, 380, 1100];                 // rent and food, per week, by league
export const CAMP_LEVELS = [{label: 'Home gym', price: 0, mult: 1}, {label: 'Pro camp', price: [700, 3500, 14000], mult: 1.35}, {label: 'Elite camp', price: [1800, 9000, 38000], mult: 1.7}] as const;
export const campPrice = (c: Career, level: number) => level === 0 ? 0 : (CAMP_LEVELS[level].price as readonly number[])[c.tier];
export const physioPrice = (c: Career) => [250, 900, 2600][c.tier];
export const prPrice = (c: Career) => [400, 2500, 12000][c.tier];
export const weeklyCost = (c: Career) => LIVING[c.tier] + (Object.entries(c.team ?? {}) as [CoachKey, number][]).reduce((s, [k, lvl]) => s + COACHES[k].pay[lvl ?? 0], 0);
export const fitnessLabel = (f: number) => f >= 88 ? 'Peak' : f >= 70 ? 'Sharp' : f >= 45 ? 'Fit' : 'Out of shape';
/** what you actually bring on fight night: camp fitness (and a bad weight cut) moves the numbers */
export function fightStats(c: Career): Stats {
  const s = {...c.stats}; const d = ((c.fitness ?? 55) - 60) / 40;
  s.cardio = clamp(s.cardio + d * 8); s.chin = clamp(s.chin + d * 3); s.speed = clamp(s.speed + d * 3); s.power = clamp(s.power + d * 2);
  if (c.camp?.missedWeight) { s.cardio = clamp(s.cardio - 6); s.chin = clamp(s.chin - 3); }
  return s;
}

const growth = (age: number) => age < 26 ? 1.25 : age < 30 ? 1 : age < 33 ? .7 : .4;
function gain(c: Career, k: StatKey, amount: number) {
  const room = Math.max(0, c.potential - c.stats[k]) / c.potential;
  const visitor = (c.coachWeeks ?? 0) > 0 ? 1.3 : 1;
  const hired = (Object.entries(c.team ?? {}) as [CoachKey, number][]).find(([key, lvl]) => lvl && COACHES[key].stats.includes(k));
  const coach = visitor * (hired ? (hired[1] === 2 ? 1.45 : 1.2) : 1) * (c.gym && GYMS[c.gym]?.boost.includes(k) ? 1.15 : 1);
  const g = Math.max(0, Math.round(amount * coach * growth(c.age) * (room > 0 ? .15 + room * 1.4 : .05) * 10) / 10);
  c.stats[k] = clamp(Math.round((c.stats[k] + g) * 10) / 10, 1, 99);
  return g;
}

export function takeAction(prev: Career, a: Action): Career {
  if (prev.retired) return prev;
  const c: Career = migrate(structuredClone(prev));
  const r = rng(c.seed + c.week * 7919);
  const tired = c.energy < 30;
  if (c.injuryWeeks > 0 && a.type !== 'rest' && a.type !== 'promote' && a.type !== 'tape') {
    c.log.unshift({week: c.week, text: 'Still injured. The doctors say rest, promote or study tape only.', tone: 'bad'});
    return c;
  }
  // fight fitness: built in camp by hard weeks (more with a paid camp), lost to media weeks and time off
  const mult = c.camp ? CAMP_LEVELS[c.camp.level ?? 0].mult : 0;
  const fit = c.camp ? ({train: 9, spar: 7, rest: -1, promote: -5, tape: 1} as const)[a.type] * (a.type === 'train' || a.type === 'spar' ? mult : 1) : 0;
  c.fitness = Math.max(0, Math.min(100, (c.fitness ?? 55) + fit));
  if (a.type === 'tape') {
    c.energy = Math.max(0, c.energy + ACTIONS.tape.energy);
    if (c.camp) {
      const n = npc(c, c.camp.opponentId)!;
      if (!c.camp.scouted) { c.camp.scouted = true; c.log.unshift({week: c.week, text: `Film study on ${n.name}: ${tendency(n)} You'll see it coming on fight night.`, tone: 'good'}); }
      else { gain(c, 'iq', .6); c.log.unshift({week: c.week, text: `More film on ${n.name}. Fight IQ up a little.`}); }
    } else { const g = gain(c, 'iq', .9); c.log.unshift({week: c.week, text: `You study the best in the division. Fight IQ +${g.toFixed(1)}.`}); }
    return advanceWeek(c, r);
  }
  if (a.type === 'train') {
    const g = gain(c, a.focus, (1 + r()) * (tired ? .5 : 1));
    if (a.focus === 'cardio') c.stats.cardio = clamp(c.stats.cardio);
    c.log.unshift({week: c.week, text: `Hard week on ${STAT_LABEL[a.focus].toLowerCase()} (+${g.toFixed(1)}).`});
    c.energy = Math.max(0, c.energy + ACTIONS.train.energy);
    injuryRoll(c, r, tired ? .12 : .025);
  } else if (a.type === 'spar') {
    const ks = [pick(r, STAT_KEYS), pick(r, STAT_KEYS), 'iq' as StatKey];
    const gs = ks.map(k => `${STAT_LABEL[k]} +${gain(c, k, .7 + r() * .7).toFixed(1)}`);
    c.log.unshift({week: c.week, text: `Sparring rounds: ${[...new Set(gs)].join(', ')}.`});
    c.energy = Math.max(0, c.energy + ACTIONS.spar.energy);
    injuryRoll(c, r, tired ? .06 : .015, true);   // controlled rounds: knocks are rare and short
  } else if (a.type === 'rest') {
    c.energy = Math.min(100, c.energy + ACTIONS.rest.energy);
    c.health = Math.min(100, c.health + 20);
    c.log.unshift({week: c.week, text: 'Rest week. Ice baths and sleep.'});
  } else {
    const h = 4 + Math.round(r() * 5) + c.tier * 2, cash = 100 + c.tier * 400 + Math.round(c.hype * 8);
    c.hype = Math.min(100, c.hype + h); c.money += cash; c.energy = Math.max(0, c.energy + ACTIONS.promote.energy);
    c.followers = (c.followers ?? 0) + Math.round(150 + c.hype * 40 * (1 + c.tier));
    c.log.unshift({week: c.week, text: `Media day: +${h} hype, +$${cash.toLocaleString()}.`});
    if (r() < .5) post(c, c.camp ? '@' + handleOf(npc(c, c.camp.opponentId)!.name) : '@CageSideNews', c.camp ? `Saw ${c.name}'s interview. Talk is cheap. See you in the cage.` : `${c.name} on the media rounds today. Says he's "ready for anyone they put in front of me."`, Math.round(30 + c.hype * 12));
  }
  return advanceWeek(c, r);
}

/** what the tape shows about a fighter (style habits the player can look for) */
function tendency(n: NPC) {
  const s = n.stats;
  if (n.style === 'Wrestler') return s.cardio > 70 ? 'he shoots when you throw the cross, and he never tires. Sprawl on his level change.' : 'he shoots early and fades late. Survive the first round and he is yours.';
  if (n.style === 'Grappler') return 'he pulls you into scrambles and hunts the neck. Don\'t follow him to the mat.';
  if (n.style === 'Striker') return s.chin < 55 ? 'he drops his right hand after the jab, and the chin is suspect. Counter him.' : 'he walks forward behind a high guard. Go to the body and the legs.';
  return s.iq > 70 ? 'no obvious holes, but he fades if you push the pace early.' : 'he gets lazy with his guard in exchanges. Hooks will land.';
}

/* ------------------------------------------------------------- spending */
export type Purchase = {type: 'physio'} | {type: 'pr'} | {type: 'camp'; level: number} | {type: 'coach'; key: CoachKey; level: number} | {type: 'cosmetic'; id: string; price: number} | {type: 'look'; look: Look};
/** spend money: everything here changes something you can feel (gains, fitness, health, hype, how you look) */
export function buy(prev: Career, p: Purchase): Career {
  const c: Career = migrate(structuredClone(prev));
  const pay = (n: number, what: string) => { if (c.money < n) { c.log.unshift({week: c.week, text: `Not enough money for ${what}.`, tone: 'bad'}); return false; } c.money -= n; return true; };
  if (p.type === 'physio') {
    if (!pay(physioPrice(c), 'the physio')) return c;
    const weeks = Math.min(c.injuryWeeks, 2); c.injuryWeeks -= weeks; c.health = Math.min(100, c.health + 35); c.energy = Math.min(100, c.energy + 15);
    c.log.unshift({week: c.week, text: `Physio and recovery block: +35 health${weeks ? `, back ${weeks} week${weeks > 1 ? 's' : ''} sooner` : ''}.`, tone: 'good'});
  } else if (p.type === 'pr') {
    if (!pay(prPrice(c), 'a PR push')) return c;
    const h = 6 + c.tier * 2; c.hype = clamp(c.hype + h, 0, 100); c.followers = (c.followers ?? 0) + 2000 * (1 + c.tier);
    c.log.unshift({week: c.week, text: `Your PR team runs a campaign: +${h} hype.`, tone: 'good'});
    post(c, '@MMAWire', `${c.name} is everywhere this week. Feature interview, billboard, the works.`, 900 + c.hype * 30);
  } else if (p.type === 'camp') {
    if (!c.camp) return c;
    const cur = c.camp.level ?? 0; if (p.level <= cur) return c;
    if (!pay(campPrice(c, p.level) - campPrice(c, cur), CAMP_LEVELS[p.level].label.toLowerCase())) return c;
    c.camp.level = p.level;
    if (p.level === 2) c.camp.scouted = true;
    c.log.unshift({week: c.week, text: p.level === 2 ? 'Elite camp booked: altitude, hand-picked sparring partners who fight like him, a full film team.' : 'Pro camp booked: better sparring partners and a proper strength block.', tone: 'good'});
  } else if (p.type === 'coach') {
    c.team ??= {};
    if (p.level === 0) { delete c.team[p.key]; c.log.unshift({week: c.week, text: `You part ways with your ${COACHES[p.key].label.toLowerCase()}.`}); }
    else { if (c.money < COACHES[p.key].pay[p.level] * 2) { c.log.unshift({week: c.week, text: 'You need at least two weeks of his salary in the bank.', tone: 'bad'}); return c; } c.team[p.key] = p.level; c.log.unshift({week: c.week, text: `Hired: ${p.level === 2 ? 'an elite' : 'a local'} ${COACHES[p.key].label.toLowerCase()} ($${COACHES[p.key].pay[p.level].toLocaleString()}/week).`, tone: 'good'}); }
  } else if (p.type === 'cosmetic') {
    c.owned ??= [];
    if (c.owned.includes(p.id)) return c;
    if (!pay(p.price, 'that')) return c;
    c.owned.push(p.id); c.log.unshift({week: c.week, text: `New ink / gear: paid $${p.price.toLocaleString()}.`});
  } else if (p.type === 'look') {
    c.look = p.look;
  }
  return c;
}

function injuryRoll(c: Career, r: () => number, chance: number, minor = false) {
  if (r() < chance) {
    c.injuryWeeks = minor ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 4); c.health = Math.max(20, c.health - (minor ? 15 : 30));
    c.log.unshift({week: c.week, text: `Injured in camp. Out ${c.injuryWeeks} weeks.`, tone: 'bad'});
    if (c.camp) { c.log.unshift({week: c.week, text: 'The fight is off. The promotion pulls the bout.', tone: 'bad'}); c.camp = null; c.hype = Math.max(0, c.hype - 5); }
  }
}

function advanceWeek(c: Career, r: () => number): Career {
  c.week += 1;
  if (c.injuryWeeks > 0) c.injuryWeeks -= 1;
  c.health = Math.min(100, c.health + 4);
  c.hype = Math.max(0, c.hype - .5);
  if (!c.camp) c.fitness = Math.round(((c.fitness ?? 55) + (55 - (c.fitness ?? 55)) * .25) * 10) / 10;   // out of camp, fitness drifts back to normal
  c.followers = Math.max(0, Math.round((c.followers ?? 0) + c.hype * (3 + c.tier * 6)));
  // the bills: rent and food, and every coach on the payroll
  const bill = weeklyCost(c); c.money -= bill;
  if (c.money < 0) {
    if (c.team && Object.keys(c.team).length && c.money < -LIVING[c.tier] * 4) { c.team = {}; c.log.unshift({week: c.week, text: 'You can\'t make payroll. Your coaches walk out.', tone: 'bad'}); }
    else if (c.week % 3 === 0) c.log.unshift({week: c.week, text: `You're $${Math.abs(Math.round(c.money)).toLocaleString()} in debt. Your manager says take the next fight offered.`, tone: 'bad'});
    c.energy = Math.max(0, c.energy - 4);   // working a side job
  }
  if (c.camp) c.camp.weeksLeft = Math.max(0, c.camp.weeksLeft - 1);
  c.offers = c.offers.map(o => ({...o, weeksOut: o.weeksOut})).filter(() => !c.camp);
  if (c.week % 52 === 0) ageUp(c, r);
  if (c.week % 4 === 0) worldTurns(c, r);
  storyWeek(c, r);
  return c.camp || c.offers.length ? c : withOffers(c, r);
}

function ageUp(c: Career, r: () => number) {
  c.age += 1;
  // regression with age (20% slower than it used to be): speed, cardio, chin and power fade from 32
  if (c.age >= 32) for (const k of ['speed', 'cardio', 'chin', 'power'] as StatKey[]) c.stats[k] = clamp(Math.round((c.stats[k] - (1 + Math.floor(r() * (c.age - 30))) * .8) * 10) / 10);
  for (const n of c.roster) n.age += 1;
  c.log.unshift({week: c.week, text: c.age >= 32 ? `Turns ${c.age}. The body is starting to send invoices.` : `Turns ${c.age}.`, tone: c.age >= 32 ? 'bad' : undefined});
}

function worldTurns(c: Career, r: () => number) {
  const a = pick(r, c.roster.filter(n => n.tier === c.tier)), b = pick(r, c.roster.filter(n => n.tier === c.tier && n.id !== a.id));
  if (!a || !b) return;
  const aWins = r() < .5 + (overall(a.stats) - overall(b.stats)) / 60;
  const [w, l] = aWins ? [a, b] : [b, a];
  w.record[0] += 1; l.record[1] += 1;
  if (c.tier === 2) {
    const wi = c.rankings.indexOf(w.id), li = c.rankings.indexOf(l.id);
    if (wi > li && li >= 0) { c.rankings.splice(wi, 1); c.rankings.splice(li, 0, w.id); syncRank(c); }
  }
  c.log.unshift({week: c.week, text: `Around the ${TIERS[c.tier].short.toLowerCase()} scene: ${w.name} beats ${l.name}${r() < .4 ? ' by ' + pick(r, ['knockout', 'submission', 'split decision', 'unanimous decision']) : ''}.`});
  livingDivision(c, r);
}

/* --------------------------------------------------------------- offers */
export const npc = (c: Career, id: string) => c.roster.find(n => n.id === id);
function syncRank(c: Career) { const i = c.rankings.indexOf('you'); c.rank = c.tier === 2 && i >= 0 ? i + 1 : null; }

function withOffers(c: Career, r: () => number): Career {
  if (c.camp || c.injuryWeeks > 0 || c.retired || c.week < c.nextOfferWeek) return c;
  const pool = c.roster.filter(n => n.tier === c.tier);
  const offers: Offer[] = [];
  // hype is reach: the more people want to see you, the more (and bigger) fights the matchmakers offer
  const reach = Math.floor(c.hype / 20);                  // 0..5
  const want = 2 + (c.hype >= 30 ? 1 : 0) + (c.hype >= 60 ? 1 : 0);
  if (c.tier === 2 && !c.champ && c.rank != null && c.rank <= 3 + Math.floor(c.hype / 25) && c.hype >= 45 && c.champion) {
    offers.push(offer(c, r, c.champion, true));
  }
  if (c.tier === 2 && c.champ) {
    // title defenses: the matchmakers pitch two challengers from the top six, never the last two people
    // you fought, with bad blood and momentum pushing names up the list
    const recent = c.history.slice(0, 2).map(h => h.opponentId);
    const pool = c.rankings.slice(0, 6).filter(id => id !== 'you' && !recent.includes(id));
    const score = (id: string, i: number) => (6 - i) + heatOf(c, id) / 15 + r() * 3;
    const picks = pool.map((id, i) => ({id, s: score(id, i)})).sort((a, b) => b.s - a.s).slice(0, 2);
    for (const p of picks) offers.push(offer(c, r, p.id, true, c.tier, beaten(c, p.id) ? 'rematch' : heatOf(c, p.id) >= 40 ? 'grudge' : undefined));
  } else {
    // title eliminator: ranked 2-6 with some hype gets a crack at another contender for the #1 spot
    if (c.tier === 2 && c.rank != null && c.rank >= 2 && c.rank <= 6 && c.hype >= 30 && r() < .6) {
      const other = c.rankings.slice(0, 6).find(id => id !== 'you' && id !== c.history[0]?.opponentId && r() < .6);
      if (other) offers.push(offer(c, r, other, false, c.tier, 'eliminator'));
    }
    // bad blood: rivals in your league want the fight (rematch if they've beaten you before)
    for (const rv of (c.rivals ?? []).filter(x => x.heat >= 40).slice(0, 2)) {
      const n = npc(c, rv.id);
      if (!n || n.tier !== c.tier || c.history[0]?.opponentId === n.id || c.champion === n.id || offers.some(o => o.opponentId === n.id)) continue;
      offers.push(offer(c, r, n.id, false, c.tier, beaten(c, n.id) ? 'rematch' : 'grudge'));
    }
    let near = pool;
    if (c.tier === 2 && c.rank != null) near = c.rankings.slice(Math.max(0, c.rank - 4 - reach), c.rank + 3).filter(id => id !== 'you').map(id => npc(c, id)!).filter(Boolean);
    // reach fight: enough hype gets you a call-up bout against someone from the league above
    if (c.tier < 2 && c.hype >= 35) {
      const above = c.roster.filter(n => n.tier === c.tier + 1).sort((x, y) => overall(x.stats) - overall(y.stats));
      const pickUp = above[Math.floor(r() * Math.max(1, Math.ceil(above.length / 2)))];
      if (pickUp) offers.push(offer(c, r, pickUp.id, false, c.tier + 1));
    }
    const shuffled = [...near].filter(n => !offers.some(o => o.opponentId === n.id)).sort(() => r() - .5).slice(0, Math.max(0, want + Math.min(2, offers.length) - offers.length));
    for (const n of shuffled) offers.push(offer(c, r, n.id, false));
  }
  c.offers = offers;
  return c;
}

function offer(c: Career, r: () => number, opponentId: string, title: boolean, tier = c.tier, tag?: Tag): Offer {
  const bump = tag === 'rematch' || tag === 'grudge' ? 1.4 : tag === 'eliminator' ? 1.3 : tag === 'short' ? 1.5 : 1;
  // show money roughly doubles with a win (show + win bonus, like real contracts); hype and a better deal push it up
  const base = [800, 6000, 40000][tier] * (1 + c.hype / 100) * (title ? 3 : 1) * bump * (c.payBump ?? 1);
  const o = npc(c, opponentId)!;
  const gap = overall(o.stats) - overall(c.stats);
  const note = tag === 'rematch' ? (title ? 'Title rematch' : 'Rematch') : tag === 'grudge' ? (title ? 'Grudge title fight' : 'Grudge match') : tag === 'eliminator' ? 'Title eliminator' : tag === 'short' ? 'Short notice'
    : title ? (c.champ ? 'Title defense' : 'Title shot') : tier > c.tier ? `Reach fight: ${TIERS[tier].short} call-up` : gap > 8 ? 'Big step up' : gap < -8 ? 'Tune-up fight' : 'Even matchup';
  return {id: `${opponentId}-${c.week}`, opponentId, tier, purse: Math.round(base / 50) * 50, winBonus: Math.round(base / 50) * 50, weeksOut: tag === 'short' ? 2 + Math.floor(r() * 2) : title ? 10 : 6 + Math.floor(r() * 5), rounds: title || tag === 'eliminator' ? 5 : 3, title, note, tag};
}

const PROMOTIONS = ['Basement Brawl', 'Neon Contender Series', 'VERSUS'] as const;
export function acceptOffer(prev: Career, id: string): Career {
  const c: Career = migrate(structuredClone(prev));
  const o = c.offers.find(x => x.id === id); if (!o) return c;
  const {weeksOut, ...rest} = o;
  // every fight lands on a numbered card with a billing, like a real promotion
  c.eventNo![o.tier] += 1 + (c.week % 3);
  const event = `${PROMOTIONS[o.tier]} ${c.eventNo![o.tier]}`;
  const billing = o.title ? 'Main event' : o.tag === 'grudge' || o.tag === 'rematch' || o.tag === 'eliminator' || c.hype >= 60 ? 'Co-main event' : c.hype >= 30 || o.tier === 2 ? 'Main card' : 'Prelims';
  c.camp = {...rest, weeksLeft: weeksOut, event, billing, edge: 0, level: 0};
  if (c.homecoming) { c.camp.purse = Math.round(c.camp.purse * 1.2 / 50) * 50; c.camp.edge = -.03; c.homecoming = false; c.camp.note += ' · Hometown card'; }
  c.fitness = Math.min(c.fitness ?? 55, 60);
  const n = npc(c, o.opponentId)!;
  c.log.unshift({week: c.week, text: `Signed: ${c.name} vs ${n.name}, ${billing.toLowerCase()} of ${event}${o.title ? ' for the belt' : ''}. Camp starts now: train hard to peak on fight night.`, tone: 'big'});
  post(c, '@MMAWire', `BREAKING: ${c.name} vs ${n.name} is official for ${event}${o.title ? ' with the belt on the line' : ''}. ${o.tag === 'grudge' ? 'These two do NOT like each other.' : o.tag === 'rematch' ? 'Run it back.' : ''}`.trim(), 300 + c.hype * 25);
  if (o.tag === 'grudge' || o.tag === 'rematch') c.log.unshift({week: c.week, text: `${n.name}: "${pick(rng(c.seed + c.week), TRASH)}"`, tone: 'bad'});
  return c;
}
export function declineOffer(prev: Career, id: string): Career {
  const c: Career = migrate(structuredClone(prev));
  c.offers = c.offers.filter(o => o.id !== id); c.hype = Math.max(0, c.hype - 2);
  if (!c.offers.length) return withOffers(c, rng(c.seed + c.week * 31 + 7));
  return c;
}

/* --------------------------------------------------------- after a fight */
export type FightOutcome = {winner: 'you' | 'opp' | 'draw'; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; damageTaken: number; how?: string};

export function applyResult(prev: Career, out: FightOutcome): Career {
  const c: Career = migrate(structuredClone(prev));
  const camp = c.camp; if (!camp) return c;
  const opp = npc(c, camp.opponentId)!;
  const r = rng(c.seed + c.week * 104729);
  const won = out.winner === 'you', lost = out.winner === 'opp';
  let purse = camp.purse + (won ? camp.winBonus : 0);
  if (camp.missedWeight) purse = Math.round(purse * .8);           // 20% of the purse to the other corner
  // the cut: your manager and your gym take theirs off the top, like real fighters' purses
  const manager = Math.round(purse * .1), gymCut = Math.round(purse * .1);
  c.money += purse - manager - gymCut;
  c.earnings = (c.earnings ?? 0) + purse;
  c.lastPayout = {gross: purse, manager, gym: gymCut, camp: campPrice(c, camp.level ?? 0), net: purse - manager - gymCut, bonus: 0};
  c.streak = won ? Math.max(1, (c.streak ?? 0) + 1) : lost ? Math.min(-1, (c.streak ?? 0) - 1) : 0;
  if (won) { c.record[0] += 1; opp.record[1] += 1; c.tierWins += 1; if (out.method === 'KO/TKO') c.finishes.ko += 1; else if (out.method === 'SUB') c.finishes.sub += 1; else c.finishes.dec += 1; }
  else if (lost) { c.record[1] += 1; opp.record[0] += 1; } else c.record[2] += 1;
  c.hype = clamp(c.hype + (won ? (out.method === 'DEC' || out.method === 'SPLIT DEC' ? 8 : 15) + (camp.title ? 15 : 0) : lost ? -12 : 2), 0, 100);
  c.health = Math.max(10, c.health - out.damageTaken * .6);
  c.energy = 55;
  if (out.damageTaken > 60 && r() < .5) { c.injuryWeeks = 3 + Math.floor(r() * 4); c.log.unshift({week: c.week, text: `Medical suspension: ${c.injuryWeeks} weeks.`, tone: 'bad'}); }
  for (const k of STAT_KEYS) gain(c, k, .3);
  c.history.unshift({week: c.week, age: c.age, opponent: opp.name, opponentId: opp.id, result: won ? 'W' : lost ? 'L' : 'D', method: out.method, round: out.round, tier: camp.tier, title: camp.title, purse});
  const res = won ? 'beats' : lost ? 'loses to' : 'draws with';
  c.log.unshift({week: c.week, text: `${camp.event ? camp.event + ': ' : ''}${c.name} ${res} ${opp.name} by ${out.method} in round ${out.round}. Purse $${purse.toLocaleString()}.`, tone: won ? 'good' : lost ? 'bad' : undefined});
  // post-fight bonuses, like the real thing
  const finish = out.method === 'KO/TKO' || out.method === 'SUB';
  const bonus = [2000, 12000, 50000][camp.tier];
  if (won && finish && r() < .45) { c.money += bonus; c.lastPayout!.bonus = bonus; c.hype = clamp(c.hype + 4, 0, 100); c.bonuses!.potn += 1; c.log.unshift({week: c.week, text: `Performance of the Night! +$${bonus.toLocaleString()}.`, tone: 'big'}); }
  else if (out.damageTaken > 35 && (won || out.method !== 'KO/TKO') && r() < .3) { c.money += bonus; c.lastPayout!.bonus = bonus; c.bonuses!.fotn += 1; c.log.unshift({week: c.week, text: `Fight of the Night with ${opp.name}. Both of you take home +$${bonus.toLocaleString()}.`, tone: 'big'}); }
  // the internet reacts
  const howTxt = out.how ? ` (${out.how.toLowerCase()})` : '';
  c.followers = Math.max(0, (c.followers ?? 0) + (won ? (finish ? 6000 : 2500) * (1 + c.tier * 2) : -800));
  if (won && finish) post(c, '@CageSideNews', `${c.name.toUpperCase()} ${out.method === 'SUB' ? 'TAPS' : 'FLATTENS'} ${opp.name.toUpperCase()}${howTxt.toUpperCase()} IN ROUND ${out.round}!! 🤯`, 4000 + c.hype * 120);
  else if (won) post(c, '@MMAWire', `${c.name} gets past ${opp.name} on the scorecards at ${camp.event ?? 'the event'}. ${out.method === 'SPLIT DEC' ? 'Plenty of people had it the other way.' : 'Clear win.'}`, 900 + c.hype * 40);
  else if (lost) post(c, '@FightTwitterKing', `${opp.name} ${out.method === 'KO/TKO' ? 'sleeps' : out.method === 'SUB' ? 'chokes out' : 'beats'} ${c.name}. Told y'all the hype was fake.`, 2500 + c.hype * 60);
  if (won) post(c, '@' + handleOf(c.name), pick(r, ['Thank you God, thank you to my team. We\'re just getting started.', 'Told you. Nobody believed but us.', 'Back to the gym tomorrow. The work never stops.', 'Who\'s next? 👀']), 1500 + c.hype * 90, true);
  // milestones of a career
  const fights = c.record[0] + c.record[1] + c.record[2];
  if (fights === 1) milestone(c, `Pro debut at ${camp.event ?? 'the regional scene'}: ${won ? 'a win' : lost ? 'a loss' : 'a draw'} against ${opp.name}.`);
  if (won && c.record[0] === 1) milestone(c, `First professional win: ${opp.name} by ${out.method}${howTxt}.`);
  if (won && finish && c.finishes.ko + c.finishes.sub === 1) milestone(c, `First finish: ${opp.name}${howTxt}, round ${out.round}.`);
  if (lost && c.record[1] === 1) milestone(c, `First loss: ${opp.name} by ${out.method}. How he responds defines him.`);
  if (c.record[0] === 10 && won) milestone(c, `Ten professional wins.`);
  if (c.streak && c.streak >= 5 && won) milestone(c, `${c.streak}-fight win streak.`);
  if (won && camp.title) milestone(c, c.champ ? `Title defense: beats ${opp.name}.` : `Champion: beats ${opp.name} for the VERSUS ${c.division} title.`);
  // the mic: after a win the cage-side interviewer asks who's next
  if (won && !c.retired) c.choice = micChoice(c, opp);
  // storylines: losses breed rivals, close split decisions breed rematches, wins over rivals settle them
  const heatBefore = heatOf(c, opp.id);
  if (won && heatBefore >= 40) { setHeat(c, opp.id, 0, ''); c.hype = clamp(c.hype + 8, 0, 100); c.log.unshift({week: c.week, text: `Rivalry settled. ${c.name} gets the last word over ${opp.name}.`, tone: 'big'}); }
  else if (lost) addHeat(c, opp.id, 40, `beat you at ${camp.event ?? 'their last meeting'}`);
  if (out.method === 'SPLIT DEC') { addHeat(c, opp.id, 25, 'a disputed split decision'); c.log.unshift({week: c.week, text: `Fans are split on the scorecards. Talk of a rematch already.`}); }
  if (won && camp.tag === 'eliminator' && c.tier === 2 && !c.champ) { c.rankings = c.rankings.filter(id => id !== 'you'); c.rankings.unshift('you'); c.log.unshift({week: c.week, text: `Eliminator won. ${c.name} is the #1 contender.`, tone: 'big'}); }
  if (won && c.champion && c.champion !== 'you' && c.tier === 2 && !camp.title && r() < .5) { const ch = npc(c, c.champion); if (ch) { addHeat(c, ch.id, 20, 'called out the champ'); c.log.unshift({week: c.week, text: `In the cage after the fight, ${c.name} calls out champion ${ch.name}. The crowd erupts.`, tone: 'big'}); c.hype = clamp(c.hype + 5, 0, 100); } }

  if (c.tier === 2) {
    if (camp.title) {
      if (won && !c.champ) { const old = c.champion!; c.champ = true; c.champion = 'you'; c.lineage!.unshift({week: c.week, name: c.name, how: `beat ${opp.name}`}); c.rankings = c.rankings.filter(id => id !== 'you'); c.rankings.unshift(old); c.rankings = c.rankings.slice(0, 15); c.log.unshift({week: c.week, text: `AND NEW! ${c.name} is the VERSUS ${c.division} champion.`, tone: 'big'}); }
      else if (won && c.champ) { c.defenses += 1; c.log.unshift({week: c.week, text: `Title defense number ${c.defenses}.`, tone: 'big'}); }
      else if (lost && c.champ) { c.champ = false; c.champion = opp.id; c.lineage!.unshift({week: c.week, name: opp.name, how: `beat ${c.name}`}); c.rankings = c.rankings.filter(id => id !== opp.id); c.rankings.unshift('you'); c.rankings = c.rankings.slice(0, 15); c.log.unshift({week: c.week, text: `The belt changes hands. ${opp.name} is the new champion.`, tone: 'bad'}); }
    } else if (!c.champ) {
      const me = c.rankings.indexOf('you'), them = c.rankings.indexOf(opp.id);
      c.rankings = c.rankings.filter(id => id !== 'you');
      let to = me < 0 ? c.rankings.length : me;
      if (won && them >= 0 && (me < 0 || them < me)) to = them; else if (won) to = Math.max(0, (me < 0 ? 14 : me) - 1); else if (lost) to = Math.min(c.rankings.length, (me < 0 ? 15 : me) + 2);
      if (!(lost && me < 0)) c.rankings.splice(Math.min(to, 14), 0, 'you');
      c.rankings = c.rankings.slice(0, 15);
    }
    syncRank(c);
  }
  // promotions up the ladder
  const reachWin = won && camp.tier > c.tier;   // beat someone from the league above: straight call-up
  if (c.tier < 2 && won && (reachWin || (c.tierWins >= (c.tier === 0 ? 3 : 2) && c.hype >= (c.tier === 0 ? 20 : 35)))) {
    c.tier += 1; c.tierWins = 0;
    milestone(c, c.tier === 2 ? `Signs with the VERSUS Championship, the big show, at ${c.age}.` : `Called up to the ${TIERS[c.tier].name}.`);
    if (c.tier === 2) { c.rankings = c.rankings.slice(0, 14); c.rankings.push('you'); syncRank(c); }
    c.log.unshift({week: c.week, text: `Contract offer accepted: ${c.name} moves up to the ${TIERS[c.tier].name}!`, tone: 'big'});
  }
  if (c.rank && c.rank <= 15 && !(c.milestones ?? []).some(m => m.text.startsWith('Ranked'))) milestone(c, `Ranked #${c.rank} in the ${c.division} division for the first time.`);
  c.camp = null;
  c.nextOfferWeek = c.week + Math.max(1, 3 - Math.floor(c.hype / 34)) + Math.round(out.damageTaken / 20) + c.injuryWeeks;   // hyped fighters get the phone call sooner
  return withOffers(c, r);
}

export function retire(prev: Career): Career {
  const c: Career = structuredClone(prev); c.retired = true; c.camp = null; c.offers = [];
  c.log.unshift({week: c.week, text: `${c.name} retires at ${c.age} with a ${c.record.join('-')} record.`, tone: 'big'});
  return c;
}

export function legacy(c: Career) {
  const titleWins = c.history.filter(h => h.title && h.result === 'W').length;
  return Math.round(c.record[0] * 10 - c.record[1] * 4 + (c.finishes.ko + c.finishes.sub) * 4 + titleWins * 60 + c.tier * 40 + c.hype);
}

/* ============================================================ storylines */
// The division lives on without you: title fights, retirements, new prospects, callouts and bad blood.

/** fill in storyline fields on saves from before they existed */
export function migrate(c: Career): Career {
  c.rivals ??= []; c.choice ??= null; c.eventNo ??= [112, 38, 207]; c.bonuses ??= {potn: 0, fotn: 0};
  c.lineage ??= []; c.coachWeeks ??= 0;
  c.owned ??= []; c.team ??= {}; c.fitness ??= 55; c.followers ??= 200 + c.record[0] * 900; c.feed ??= []; c.milestones ??= [];
  c.earnings ??= c.history.reduce((s, h) => s + h.purse, 0); c.lastPayout ??= null; c.payBump ??= 1; c.streak ??= 0;
  if (!c.lineage.length && c.champion && c.champion !== 'you') { const ch = npc(c, c.champion); if (ch) c.lineage.push({week: c.week, name: ch.name, how: 'reigning champion'}); }
  return c;
}
export const heatOf = (c: Career, id: string) => (c.rivals ?? []).find(x => x.id === id)?.heat ?? 0;
export const handleOf = (name: string) => name.replace(/[^A-Za-z]/g, '').slice(0, 14) + (name.length % 3 === 0 ? 'MMA' : name.length % 3 === 1 ? '_' + (10 + name.length * 7 % 89) : 'Official');
function post(c: Career, handle: string, text: string, likes: number, you = false) {
  c.feed ??= [];
  c.feed.unshift({week: c.week, handle, text, likes: Math.max(3, Math.round(likes * (.7 + ((c.week * 7 + text.length) % 60) / 100))), you});
  c.feed = c.feed.slice(0, 30);
}
function milestone(c: Career, text: string) { c.milestones ??= []; c.milestones.unshift({week: c.week, age: c.age, text}); }
const beaten = (c: Career, id: string) => c.history.some(h => h.opponentId === id);
function setHeat(c: Career, id: string, heat: number, why: string) {
  c.rivals ??= [];
  const rv = c.rivals.find(x => x.id === id);
  if (heat <= 0) { c.rivals = c.rivals.filter(x => x.id !== id); return; }
  if (rv) { rv.heat = heat; if (why) rv.why = why; } else c.rivals.push({id, heat, why});
  c.rivals.sort((a, b) => b.heat - a.heat);
}
function addHeat(c: Career, id: string, amt: number, why: string) {
  const before = heatOf(c, id), after = Math.min(100, before + amt);
  setHeat(c, id, after, why);
  const n = npc(c, id);
  if (n && before < 40 && after >= 40) c.log.unshift({week: c.week, text: `A rivalry is born: ${c.name} vs ${n.name} (${why}).`, tone: 'big'});
}

const TRASH = ['I already beat guys like you in the gym. You are a warm-up.', 'Enjoy the hype while it lasts. I am taking it.', 'He has never been hit by someone like me.',
  'Tell him to bring a mouthguard and a backup plan.', 'Last time was a fluke. This time I finish it.', 'I watched his tape. I fell asleep twice.',
  'He talks a lot for someone who has never been past round two with me.', 'This is my division. He is visiting.'];
const CALLOUTS = ['I want {you}. Nobody else.', '{you} is ducking me. Sign the paper.', 'Everyone keeps asking about {you}. Let us settle it.', '{you} is overrated and I will prove it.'];

/** every 4 weeks: the division moves (called from worldTurns) */
function livingDivision(c: Career, r: () => number) {
  const tierPool = c.roster.filter(n => n.tier === c.tier);
  // a second bout on the scene
  const a = pick(r, tierPool), b = pick(r, tierPool.filter(n => n.id !== a?.id));
  if (a && b && r() < .7) {
    const aWins = r() < .5 + (overall(a.stats) - overall(b.stats)) / 60; const [w, l] = aWins ? [a, b] : [b, a];
    w.record[0] += 1; l.record[1] += 1;
    if (c.tier === 2) { const wi = c.rankings.indexOf(w.id), li = c.rankings.indexOf(l.id); if (wi > li && li >= 0) { c.rankings.splice(wi, 1); c.rankings.splice(li, 0, w.id); syncRank(c); } }
  }
  // the title gets fought for while you climb: belts change hands, challengers come and go
  const inTitleCamp = !!c.camp?.title;
  if (c.tier === 2 && !c.champ && !inTitleCamp && c.champion && c.week % 16 === 0) {
    const champ = npc(c, c.champion)!;
    const chalId = c.rankings.find(id => id !== 'you');
    const chal = chalId ? npc(c, chalId) : undefined;
    if (champ && chal) {
      const chalWins = r() < .36 + (overall(chal.stats) - overall(champ.stats)) / 50;
      c.eventNo![2] += 1; const ev = `VERSUS ${c.eventNo![2]}`;
      if (chalWins) {
        c.champion = chal.id; chal.record[0] += 1; champ.record[1] += 1;
        c.rankings = c.rankings.filter(id => id !== chal.id); c.rankings.splice(1, 0, champ.id); c.rankings = c.rankings.slice(0, 15); syncRank(c);
        c.lineage!.unshift({week: c.week, name: chal.name, how: `beat ${champ.name} at ${ev}`});
        c.log.unshift({week: c.week, text: `${ev}: AND NEW! ${chal.name} dethrones ${champ.name} by ${pick(r, ['knockout', 'submission', 'split decision', 'unanimous decision'])}.`, tone: 'big'});
      } else {
        champ.record[0] += 1; chal.record[1] += 1;
        const ci = c.rankings.indexOf(chal.id); if (ci >= 0) { c.rankings.splice(ci, 1); c.rankings.splice(Math.min(c.rankings.length, ci + 2), 0, chal.id); syncRank(c); }
        c.log.unshift({week: c.week, text: `${ev}: ${champ.name} defends the belt against ${chal.name}.`, tone: 'big'});
      }
    }
  }
  // careers end: old veterans retire and hungry prospects take their place
  for (const n of [...c.roster]) {
    if (n.age < 35 || r() > .12 || n.id === c.champion || n.id === c.camp?.opponentId || c.offers.some(o => o.opponentId === n.id)) continue;
    const idx = c.roster.indexOf(n);
    const fresh = makeNPC(r, n.tier, Math.floor(r() * 16)); fresh.age = 21 + Math.floor(r() * 4); fresh.record = [3 + Math.floor(r() * 5) + n.tier * 3, 0];
    c.roster[idx] = fresh;
    const ri = c.rankings.indexOf(n.id); if (ri >= 0) c.rankings[ri] = fresh.id;
    c.rivals = (c.rivals ?? []).filter(x => x.id !== n.id);
    if (n.tier === c.tier) c.log.unshift({week: c.week, text: `${n.name} retires at ${n.age} (${n.record.join('-')}). Unbeaten prospect ${fresh.name} "${fresh.nickname}" signs in his place.`});
    break;
  }
  // someone wants your name in their mouth
  // old feuds cool off; only the hottest six stay live
  c.rivals = (c.rivals ?? []).map(x => ({...x, heat: x.heat - 3})).filter(x => x.heat > 0).sort((a, b) => b.heat - a.heat).slice(0, 6);
  if (c.record[0] >= 2 && r() < .2) {
    const near = c.tier === 2 && c.rank ? c.rankings.slice(Math.max(0, c.rank - 4), c.rank + 4).filter(id => id !== 'you') : tierPool.map(n => n.id);
    const n = npc(c, pick(r, near) ?? '');
    if (n && n.id !== c.camp?.opponentId) {
      addHeat(c, n.id, 22, 'called you out');
      c.log.unshift({week: c.week, text: `${n.name} on a podcast: "${pick(r, CALLOUTS).replace('{you}', c.name)}"`});
    }
  }
}

/** every week: life outside the cage, and fight-week beats */
function storyWeek(c: Career, r: () => number) {
  if ((c.coachWeeks ?? 0) > 0) c.coachWeeks! -= 1;
  const camp = c.camp;
  if (camp) {
    const n = npc(c, camp.opponentId)!;
    // opponent pulls out: a replacement steps in on short notice
    if (!camp.title && camp.weeksLeft >= 2 && camp.weeksLeft <= 5 && r() < .05) {
      const pool = c.roster.filter(x => x.tier === camp.tier && x.id !== n.id && x.id !== c.champion);
      const sub = pick(r, pool);
      if (sub) {
        camp.opponentId = sub.id; camp.tag = 'short'; camp.purse = Math.round(camp.purse * 1.25 / 50) * 50; camp.note = 'Short-notice replacement';
        c.log.unshift({week: c.week, text: `${n.name} is out with an injury. ${sub.name} "${sub.nickname}" steps in on short notice at ${camp.event}.`, tone: 'bad'});
      }
    }
    // camp life: decisions still land on your phone in the early weeks
    if (!c.choice && camp.weeksLeft >= 2 && r() < .3) { const ch = lifeEvent(c, r); if (ch) c.choice = ch; }
    // the week before: press conference (the player chooses how to play it)
    if (camp.weeksLeft === 1 && !camp.pressDone && !c.choice) {
      c.choice = {kind: 'press', title: `${camp.event} press conference`, text: `${n.name} is at the other podium${heatOf(c, n.id) >= 40 ? ' and there is real bad blood' : ''}. The cameras are on you.`,
        options: [
          {id: 'trash', label: 'Trash talk', hint: '+8 hype, but he comes in fired up'},
          {id: 'respect', label: 'Stay respectful', hint: '+3 hype, he relaxes a little'},
          {id: 'mind', label: 'Mind games', hint: 'Coin flip: rattle him, or it backfires'},
        ]};
    }
    // fight week: the weight cut (how it goes depends on fitness, and money can make it easy)
    if (camp.weeksLeft === 0 && !camp.cutDone) {
      if (c.choice?.kind === 'press') resolvePress(c, r, 'respect');
      camp.cutDone = true;
      const over = Math.max(1, Math.round(6 - (c.fitness ?? 55) / 20 + r() * 2));
      if (over >= 3 && !c.choice) {
        c.choice = {kind: 'event', id: 'cut', from: 'Coach', title: `Fight week: ${over} lb over`, text: `It's the night before weigh-ins and you're ${over} pounds over the ${c.division.toLowerCase()} limit. Your coach looks worried. ${(c.fitness ?? 55) < 45 ? 'Your conditioning in camp wasn\'t where it needed to be.' : ''}`,
          options: [
            {id: 'sauna', label: 'Sauna all night', hint: 'Usually works. Leaves you drained (fitness down).'},
            {id: 'nutri', label: `Hire a cut specialist ($${[300, 1500, 6000][c.tier].toLocaleString()})`, hint: 'Makes weight clean and recovers well.'},
            {id: 'fine', label: 'Miss weight, pay the fine', hint: 'Lose 20% of your purse. You fight fresh, but the crowd boos.'},
          ]};
      }
      if (c.choice?.kind === 'press') resolvePress(c, r, 'respect');
      if (r() < .1) { const fine = Math.round(camp.purse * .2 / 50) * 50; c.money += fine; c.log.unshift({week: c.week, text: `Weigh-ins: ${n.name} misses weight by 1.5 lb and forfeits 20% of his purse to you (+$${fine.toLocaleString()}).`, tone: 'good'}); }
      else c.log.unshift({week: c.week, text: `Weigh-ins: both fighters make weight. The face-off ${heatOf(c, n.id) >= 40 ? 'has to be separated by security' : 'is intense'}.`});
    }
    return;
  }
  if (c.injuryWeeks > 0) return;
  // life between fights: a decision lands on your phone most weeks (UFC 6 style: choices with risk and reward)
  if (!c.choice && r() < .38) { const ch = lifeEvent(c, r); if (ch) { c.choice = ch; return; } }
  if (r() > .08) return;
  const e = r();
  if (e < .3 && c.hype >= 20) { const cash = [300, 2500, 15000][c.tier]; c.money += cash; c.log.unshift({week: c.week, text: `${pick(r, ['Ironclad Nutrition', 'Riptide Energy', 'Apex Gloves', 'Halo Apparel'])} signs ${c.name} to a sponsorship deal (+$${cash.toLocaleString()}).`, tone: 'good'}); }
  else if (e < .55) { c.hype = clamp(c.hype + 5, 0, 100); c.log.unshift({week: c.week, text: pick(r, ['A training clip of yours goes viral overnight (+5 hype).', 'You go viral for a fan meet-and-greet (+5 hype).', 'A big podcast has you on for two hours (+5 hype).']), tone: 'good'}); }
  else if (e < .75) { c.coachWeeks = 6; c.log.unshift({week: c.week, text: `${pick(r, ['A former champion', 'An Olympic wrestling coach', 'A Muay Thai legend'])} joins your camp. Training gains are up for 6 weeks.`, tone: 'good'}); }
  else if (e < .88 && !c.offers.some(o => o.tag === 'short')) {
    const pool = c.roster.filter(x => x.tier === c.tier && x.id !== c.champion);
    const n = pick(r, pool);
    if (n) { c.offers = [...c.offers, offer(c, r, n.id, false, c.tier, 'short')]; c.log.unshift({week: c.week, text: `Short-notice call: a fighter pulled out of a card. ${n.name} needs an opponent in 2-3 weeks. Big money.`, tone: 'big'}); }
  } else { c.hype = clamp(c.hype - 3, 0, 100); c.log.unshift({week: c.week, text: 'An old interview resurfaces and goes badly (-3 hype).', tone: 'bad'}); }
}

function resolvePress(c: Career, r: () => number, choice: 'trash' | 'respect' | 'mind') {
  const camp = c.camp; if (!camp) { c.choice = null; return; }
  const n = npc(c, camp.opponentId)!;
  camp.pressDone = true; c.choice = null;
  if (choice === 'trash') {
    c.hype = clamp(c.hype + 8, 0, 100); camp.edge = (camp.edge ?? 0) + .05; addHeat(c, n.id, 15, 'trash talk at the presser');
    c.log.unshift({week: c.week, text: `Press conference: ${c.name} goes off on ${n.name}. The clip is everywhere (+8 hype). He looks furious.`, tone: 'big'});
  } else if (choice === 'respect') {
    c.hype = clamp(c.hype + 3, 0, 100); camp.edge = (camp.edge ?? 0) - .02;
    c.log.unshift({week: c.week, text: `Press conference: ${c.name} keeps it classy. Respect from the fans (+3 hype).`});
  } else if (r() < .5) {
    c.hype = clamp(c.hype + 6, 0, 100); camp.edge = (camp.edge ?? 0) - .05;
    c.log.unshift({week: c.week, text: `Press conference: your mind games get under ${n.name}'s skin. He looks rattled (+6 hype).`, tone: 'good'});
  } else {
    c.hype = clamp(c.hype - 3, 0, 100); camp.edge = (camp.edge ?? 0) + .03;
    c.log.unshift({week: c.week, text: `Press conference: the mind games backfire. ${n.name} laughs it off and the crowd is with him (-3 hype).`, tone: 'bad'});
  }
}
/** the player's answer to a story choice (press conference, a life event, the weight cut, the mic) */
export function resolveChoice(prev: Career, option: string): Career {
  const c: Career = migrate(structuredClone(prev));
  const r = rng(c.seed + c.week * 613 + option.length * 31);
  if (c.choice?.kind === 'press') resolvePress(c, r, option as 'trash' | 'respect' | 'mind');
  else if (c.choice?.kind === 'event') resolveEvent(c, r, c.choice, option);
  return c;
}

/* ================================================================ life events */
// Each event is a message on your phone with two or three ways to play it. Some are safe, some are
// a dice roll (the hint says so). Effects touch hype, followers, money, energy, health, fitness, stats
// and rivalries, so the choices shape the career rather than decorate it.
type Eff = {hype?: number; money?: number; energy?: number; health?: number; fitness?: number; followers?: number; stat?: [StatKey, number][]; injury?: number; heat?: number; coach?: number; text: string; tone?: LogEntry['tone']; post?: [string, string, number]};
type Opt = {id: string; label: string; hint: string} & ({eff: Eff} | {roll: number; win: Eff; lose: Eff});
type LifeEvent = {id: string; from: string; when: (c: Career) => boolean; weight: number; build: (c: Career, r: () => number, target?: string) => {title: string; text: string; options: Opt[]; target?: string}};
const T = (c: Career, xs: [number, number, number]) => xs[c.tier];
const LIFE: LifeEvent[] = [
  {id: 'commercial', from: 'Manager', weight: 1, when: c => c.hype >= 15, build: c => ({title: 'A commercial shoot', text: `Riptide Energy wants you in a TV spot. Two long days on set, $${T(c, [600, 4000, 25000]).toLocaleString()}.`, options: [
    {id: 'yes', label: 'Do the shoot', hint: `+$${T(c, [600, 4000, 25000]).toLocaleString()}, followers. Tiring, costs fitness.`, eff: {money: T(c, [600, 4000, 25000]), energy: -12, fitness: -4, followers: 3000, hype: 2, text: 'Two days on set. The ad drops and your face is on every phone.', tone: 'good'}},
    {id: 'no', label: 'Stay in the gym', hint: 'Your coach approves.', eff: {fitness: 3, text: 'You turn the ad down. Coach nods: "That\'s why you\'ll be champion."'}}]})},
  {id: 'hills', from: 'Coach', weight: 1, when: () => true, build: () => ({title: '5am hill sprints', text: 'Coach wants you on the hill at 5am every day this week. "Champions are made when nobody\'s watching."', options: [
    {id: 'yes', label: 'Every morning', hint: 'Cardio up, tiring.', eff: {stat: [['cardio', 1.2]], energy: -15, fitness: 5, text: 'Seven sunrises on that hill. Your lungs feel brand new.', tone: 'good'}},
    {id: 'no', label: 'Sleep in', hint: 'Rested, coach is disappointed.', eff: {energy: 10, text: 'You sleep in. Coach doesn\'t say anything. He doesn\'t have to.'}}]})},
  {id: 'dm', from: 'Rival', weight: 1.4, when: c => c.record[0] + c.record[1] >= 1, build: (c, r, t) => { const n = (t && npc(c, t)) || pick(r, c.roster.filter(x => x.tier === c.tier)); return {target: n.id, title: `@${handleOf(n.name)} is talking`, text: `${n.name} posts a clip of your last fight with the caption "glass chin, paper heart." It's everywhere.`, options: [
    {id: 'clap', label: 'Clap back', hint: 'Dice roll: go viral, or look bad. Heats up the rivalry.', roll: .55, win: {hype: 8, followers: 6000, heat: 18, text: `Your reply to ${n.name} gets more likes than his post. The fans want the fight.`, tone: 'good', post: ['@FightTwitterKing', `${c.name} just ended ${n.name}'s whole career on here 💀`, 5000]}, lose: {hype: -4, heat: 12, text: `Your reply to ${n.name} gets ratioed. Even your mum thought it was cringe.`, tone: 'bad'}},
    {id: 'call', label: 'Call him out for a fight', hint: 'Rivalry heats up: he becomes an offer soon.', eff: {heat: 30, hype: 3, text: `"Sign the contract, ${n.name.split(' ')[0]}." The matchmakers noticed.`, tone: 'big'}},
    {id: 'ignore', label: 'Ignore it', hint: 'Classy. Small hype bump.', eff: {hype: 2, text: 'You don\'t reply. The fans respect it.'}}]}; }},
  {id: 'brother', from: 'Family', weight: .7, when: () => true, build: () => ({title: 'Your little brother\'s debut', text: 'Your brother has his first amateur fight this weekend, three hours away. He asked if you\'d corner him.', options: [
    {id: 'yes', label: 'Corner him', hint: 'Costs energy. Good for the soul (and the clip).', eff: {energy: -14, hype: 4, health: 6, followers: 2500, text: 'He wins. You cry more than he does. The video of you in his corner goes around.', tone: 'good'}},
    {id: 'no', label: 'Stay and train', hint: 'Fitness up. He understands. Mostly.', eff: {fitness: 4, text: 'You FaceTime him after. He lost. He says it\'s fine.', tone: 'bad'}}]})},
  {id: 'hospital', from: 'Fan', weight: .6, when: c => c.tier >= 1, build: () => ({title: 'A message from a hospital', text: 'A nurse writes: a kid on the children\'s ward has your posters all over his room. Any chance you could visit?', options: [
    {id: 'visit', label: 'Visit him', hint: 'A day out of the gym. Big hype.', eff: {energy: -6, hype: 7, followers: 9000, text: 'You spend the afternoon with him. You leave him your gloves.', tone: 'good', post: ['@VERSUSofficial', 'Real ones show up. ❤️', 8000]}},
    {id: 'video', label: 'Send a video', hint: 'Small bump.', eff: {hype: 2, text: 'You record a video message. His mum says he watched it fifty times.'}}]})},
  {id: 'vet', from: 'Gym', weight: 1, when: () => true, build: c => ({title: 'A veteran wants hard rounds', text: `A former title challenger is passing through ${c.gym && GYMS[c.gym] ? GYMS[c.gym].label : 'the gym'} and wants five hard rounds with you.`, options: [
    {id: 'spar', label: 'Spar him', hint: 'Dice roll: big gains, or a beating and a week out.', roll: .6, win: {stat: [['striking', 1.4], ['iq', 1]], energy: -15, text: 'You hold your own with him for five rounds. He tells your coach you\'re the real deal.', tone: 'good'}, lose: {health: -18, injury: 1, energy: -15, text: 'He takes you apart. You learn a lot. You also need a week off.', tone: 'bad'}},
    {id: 'no', label: 'Light drilling only', hint: 'Safe, small gain.', eff: {stat: [['iq', .5]], text: 'You drill technique with him instead. Useful.'}}]})},
  {id: 'podcast', from: 'Manager', weight: 1, when: () => true, build: () => ({title: 'Three-hour podcast', text: 'The biggest fight podcast wants you for a long-form episode. They like to push buttons.', options: [
    {id: 'go', label: 'Go on', hint: 'Dice roll: usually great for hype, sometimes a controversy.', roll: .75, win: {hype: 7, followers: 7000, energy: -6, text: 'Three hours flies by. Your story about sleeping in your car before your debut goes viral.', tone: 'good'}, lose: {hype: -5, energy: -6, text: 'You say something dumb about another fighter\'s family. It does not go well.', tone: 'bad', post: ['@MMAWire', 'Backlash after controversial podcast comments.', 2000]}},
    {id: 'pass', label: 'Pass', hint: 'Nothing happens.', eff: {text: 'You pass on the podcast.'}}]})},
  {id: 'crypto', from: 'Manager', weight: .7, when: c => c.hype >= 25, build: c => ({title: 'A sketchy sponsor', text: `A crypto exchange nobody has heard of offers $${T(c, [2500, 15000, 90000]).toLocaleString()} to wear their logo on your shorts.`, options: [
    {id: 'take', label: 'Take the money', hint: 'Dice roll: easy money, or a scandal when it collapses.', roll: .6, win: {money: T(c, [2500, 15000, 90000]), text: 'The money clears. Nobody asks questions.', tone: 'good'}, lose: {money: T(c, [2500, 15000, 90000]) / 2, hype: -10, text: 'The exchange collapses a month later. Your name is in every article.', tone: 'bad'}},
    {id: 'no', label: 'Turn it down', hint: 'A little respect.', eff: {hype: 1, text: 'You turn it down. Probably smart.'}}]})},
  {id: 'party', from: 'Friends', weight: .9, when: () => true, build: () => ({title: 'Birthday at the club', text: 'Your best friend\'s birthday is tonight. "One drink. Come on. You never come out anymore."', options: [
    {id: 'go', label: 'Go out', hint: 'Dice roll: a good night, or photos leak and camp suffers.', roll: .65, win: {energy: 8, health: 4, text: 'One drink turns into a great night. You needed that.', tone: 'good'}, lose: {hype: -5, fitness: -8, energy: -10, text: 'Photos of you at 3am end up online. Your coach is furious.', tone: 'bad'}},
    {id: 'stay', label: 'Stay in', hint: 'Fitness up.', eff: {fitness: 3, text: 'You send a voice note and go to bed at nine.'}}]})},
  {id: 'docu', from: 'Manager', weight: .6, when: c => c.tier >= 1 && !!c.camp, build: () => ({title: 'A documentary crew', text: 'A streaming service wants to follow your camp for a four-part documentary.', options: [
    {id: 'yes', label: 'Let them in', hint: 'Huge hype and followers. Cameras everywhere cost energy.', eff: {hype: 10, followers: 15000, energy: -12, fitness: -3, text: 'The cameras roll for the whole camp. The trailer drops on fight week.', tone: 'big'}},
    {id: 'no', label: 'Closed camp', hint: 'Focus.', eff: {fitness: 4, text: 'Closed doors. All business.'}}]})},
  {id: 'clinic', from: 'Gym', weight: .6, when: c => c.health < 85 || c.energy < 60, build: c => ({title: 'A new recovery clinic', text: `A clinic offers you an experimental recovery program: cryo, hyperbaric chamber, IV drips. $${T(c, [400, 2500, 12000]).toLocaleString()}.`, options: [
    {id: 'try', label: 'Try it', hint: 'Dice roll: it works wonders, or it makes you ill.', roll: .72, win: {money: -T(c, [400, 2500, 12000]), health: 30, energy: 25, text: 'You feel ten years younger.', tone: 'good'}, lose: {money: -T(c, [400, 2500, 12000]), energy: -20, text: 'You react badly to the IV and spend three days in bed.', tone: 'bad'}},
    {id: 'no', label: 'Ice bath and sleep', hint: 'The old way.', eff: {energy: 8, text: 'Ice bath, ten hours of sleep. The classics.'}}]})},
  {id: 'oldcoach', from: 'Old coach', weight: .5, when: c => (c.coachWeeks ?? 0) === 0, build: c => ({title: 'Your first coach calls', text: `The coach who taught you your first jab wants to come back and work your corner. He asks for $${T(c, [500, 3000, 15000]).toLocaleString()} for the next two months.`, options: [
    {id: 'yes', label: 'Bring him back', hint: 'Training gains up for 8 weeks.', eff: {money: -T(c, [500, 3000, 15000]), coach: 8, text: 'He walks into the gym and it feels like being 15 again.', tone: 'good'}},
    {id: 'no', label: 'Not now', hint: 'Save the money.', eff: {text: 'You tell him maybe after the next fight.'}}]})},
  {id: 'homecoming', from: 'Manager', weight: .5, when: c => !c.camp && c.tier >= 1 && !c.homecoming, build: c => ({title: 'Fight at home?', text: `The promotion is planning a card in ${c.country}. They want you on it.`, options: [
    {id: 'yes', label: 'Bring it home', hint: 'Your next fight: +20% purse and the crowd on your side.', eff: {hype: 5, text: 'Your next fight will be in front of your people.', tone: 'big'}},
    {id: 'no', label: 'Fight wherever', hint: 'No change.', eff: {text: 'You tell them to put you wherever the fight makes sense.'}}]})},
  {id: 'streamer', from: 'Fan', weight: .7, when: c => c.hype >= 20, build: () => ({title: 'Streamer collab', text: 'A massive streamer wants you to teach him to fight, live, in front of 200,000 people.', options: [
    {id: 'yes', label: 'Go live', hint: 'Followers. Dice roll: he could clip you looking silly.', roll: .7, win: {followers: 25000, hype: 5, energy: -5, text: 'You catch him with a soft body shot on stream and chat explodes. Great content.', tone: 'good'}, lose: {followers: 10000, hype: -2, energy: -5, text: 'He lands a lucky jab and the clip "streamer drops pro fighter" goes everywhere.', tone: 'bad'}},
    {id: 'no', label: 'Not my thing', hint: 'Nothing happens.', eff: {text: 'You pass.'}}]})},
  {id: 'altitude', from: 'Coach', weight: .6, when: c => !!c.camp && (c.camp.level ?? 0) < 2, build: c => ({title: 'Altitude block', text: `Coach found a spot in the mountains for a two-week altitude block. $${T(c, [600, 3500, 15000]).toLocaleString()}.`, options: [
    {id: 'yes', label: 'Go up the mountain', hint: 'Cardio up, fitness way up.', eff: {money: -T(c, [600, 3500, 15000]), stat: [['cardio', 1.5]], fitness: 12, energy: -8, text: 'Two weeks at altitude. Your heart rate barely moves now.', tone: 'good'}},
    {id: 'no', label: 'Train at home', hint: 'Save the money.', eff: {text: 'You stay home.'}}]})},
  {id: 'contract', from: 'Manager', weight: .5, when: c => c.tier >= 1 && (c.streak ?? 0) >= 2 && (c.payBump ?? 1) < 1.6, build: () => ({title: 'Contract talks', text: 'You\'re on a win streak. The promotion wants to extend your deal. Your manager thinks you could hold out for more.', options: [
    {id: 'sign', label: 'Sign the extension', hint: 'Purses +15% from now on.', eff: {text: 'New deal signed. Purses up 15%.', tone: 'good'}},
    {id: 'hold', label: 'Hold out for more', hint: 'Dice roll: +35%, or they freeze you out for a few weeks.', roll: .5, win: {hype: 3, text: 'They blink. Purses up 35%.', tone: 'big'}, lose: {hype: -4, text: 'The promotion goes quiet. No offers for a while.', tone: 'bad'}}]})},
  {id: 'charity', from: 'Manager', weight: .5, when: c => c.hype >= 10, build: c => ({title: 'Charity exhibition', text: 'A charity boxing night wants you for a three-round exhibition. Headgear, big gloves, good cause.', options: [
    {id: 'yes', label: 'Do it', hint: `+$${T(c, [800, 5000, 20000]).toLocaleString()}, hype. Small knock risk.`, roll: .85, win: {money: T(c, [800, 5000, 20000]), hype: 4, energy: -10, text: 'Fun night, money raised, and you put on a show.', tone: 'good'}, lose: {money: T(c, [800, 5000, 20000]), injury: 1, energy: -10, text: 'You tweak your hand on a headgear. A week off.', tone: 'bad'}},
    {id: 'no', label: 'Decline politely', hint: 'Nothing happens.', eff: {text: 'You decline.'}}]})},
  {id: 'nick', from: 'Fans', weight: .5, when: c => !c.nickname && c.record[0] >= 2, build: (c, r, t) => { const n = t ?? pick(r, ['The Problem', 'Hurricane', 'Iceman', 'The Reaper', 'Wolf', 'Lights Out', 'Smokey']); return {target: n, title: 'The fans picked a nickname', text: `After your last fight, fans keep calling you "${n}". It's trending.`, options: [
    {id: 'yes', label: `Embrace "${n}"`, hint: 'It\'s yours now. +hype', eff: {hype: 4, text: `"${n}" ${c.name}. It sticks.`, tone: 'good'}},
    {id: 'no', label: 'No nicknames', hint: 'Nothing happens.', eff: {text: 'You stay just your name.'}}]}; }},
];

function lifeEvent(c: Career, r: () => number): Choice | null {
  const pool = LIFE.filter(e => e.when(c));
  let x = r() * pool.reduce((s, e) => s + e.weight, 0);
  const e = pool.find(ev => (x -= ev.weight) <= 0) ?? pool[0]; if (!e) return null;
  const b = e.build(c, r);
  return {kind: 'event', id: e.id, from: e.from, title: b.title, text: b.text, target: b.target, options: b.options.map(o => ({id: o.id, label: o.label, hint: o.hint}))};
}

function applyEff(c: Career, e: Eff, target?: string) {
  if (e.hype) c.hype = clamp(c.hype + e.hype, 0, 100);
  if (e.money) c.money += Math.round(e.money);
  if (e.energy) c.energy = Math.max(0, Math.min(100, c.energy + e.energy));
  if (e.health) c.health = Math.max(5, Math.min(100, c.health + e.health));
  if (e.fitness) c.fitness = Math.max(0, Math.min(100, (c.fitness ?? 55) + e.fitness));
  if (e.followers) c.followers = Math.max(0, (c.followers ?? 0) + e.followers * (1 + c.tier));
  if (e.stat) for (const [k, v] of e.stat) gain(c, k, v);
  if (e.coach) c.coachWeeks = Math.max(c.coachWeeks ?? 0, e.coach);
  if (e.heat && target && npc(c, target)) addHeat(c, target, e.heat, 'a war of words online');
  if (e.injury) { c.injuryWeeks = Math.max(c.injuryWeeks, e.injury); if (c.camp && c.camp.weeksLeft <= e.injury) { c.log.unshift({week: c.week, text: 'The injury costs you the fight. The bout is off.', tone: 'bad'}); c.camp = null; } }
  c.log.unshift({week: c.week, text: e.text, tone: e.tone});
  if (e.post) post(c, e.post[0], e.post[1], e.post[2]);
}

function resolveEvent(c: Career, r: () => number, ch: Choice, option: string) {
  c.choice = null;
  if (ch.id === 'cut') {
    const camp = c.camp; if (!camp) return;
    const n = npc(c, camp.opponentId)!;
    if (option === 'nutri') { c.money -= [300, 1500, 6000][c.tier]; c.log.unshift({week: c.week, text: `The cut specialist gets you on weight with an hour to spare. You rehydrate perfectly.`, tone: 'good'}); }
    else if (option === 'sauna') {
      if (r() < .82) { c.fitness = Math.max(0, (c.fitness ?? 55) - 12); c.log.unshift({week: c.week, text: 'Four hours in the sauna. You make weight on the last try, but you feel flat.'}); }
      else { camp.missedWeight = true; c.hype = clamp(c.hype - 6, 0, 100); c.log.unshift({week: c.week, text: `You come in a pound and a half heavy anyway. 20% of your purse goes to ${n.name}, and you're drained.`, tone: 'bad'}); }
    } else { camp.missedWeight = true; c.fitness = Math.min(100, (c.fitness ?? 55) + 5); c.hype = clamp(c.hype - 8, 0, 100); c.log.unshift({week: c.week, text: `You miss weight on purpose. The crowd boos at the weigh-ins and 20% of your purse goes to ${n.name}.`, tone: 'bad'}); post(c, '@CageSideNews', `${c.name} misses weight. Unprofessional.`, 3000); }
    // fitness from the camp and the cut is what you take into the cage
    return;
  }
  if (ch.id === 'mic') {
    const n = ch.target ? npc(c, ch.target) : undefined;
    if (option === 'champ' && c.champion && c.champion !== 'you') { const champ = npc(c, c.champion)!; addHeat(c, champ.id, 30, 'called him out on the mic'); c.hype = clamp(c.hype + 7, 0, 100); c.log.unshift({week: c.week, text: `On the mic: "${champ.name.split(' ')[0]}, I'm coming for that belt." The arena erupts.`, tone: 'big'}); post(c, '@MMAWire', `${c.name} calls out champion ${champ.name} after his win!`, 6000); }
    else if (option === 'rival' && n) { addHeat(c, n.id, 30, 'called out after your win'); c.hype = clamp(c.hype + 5, 0, 100); c.log.unshift({week: c.week, text: `On the mic: "${n.name}, you've been talking. Sign the contract."`, tone: 'big'}); post(c, '@' + handleOf(n.name), `Say less. 🖊️`, 4000); }
    else if (option === 'money') { c.payBump = Math.min(1.6, (c.payBump ?? 1) * 1.08); c.log.unshift({week: c.week, text: 'On the mic: "Pay me!" The crowd loves it. So does your manager. Purses up a little.', tone: 'good'}); }
    else { c.hype = clamp(c.hype + 2, 0, 100); c.log.unshift({week: c.week, text: 'On the mic you thank your team, your family and the fans. Classy.'}); }
    return;
  }
  const ev = LIFE.find(e => e.id === ch.id); if (!ev) return;
  const opt = ev.build(c, r, ch.target).options.find(o => o.id === option);
  if (!opt) return;
  if ('eff' in opt) applyEff(c, opt.eff, ch.target);
  else { const win = r() < opt.roll; applyEff(c, win ? opt.win : opt.lose, ch.target); if (ch.id === 'contract') { if (win) c.payBump = Math.min(1.6, (c.payBump ?? 1) * 1.35); else c.nextOfferWeek = c.week + 4; } }
  if (ch.id === 'contract' && option === 'sign') c.payBump = Math.min(1.6, (c.payBump ?? 1) * 1.15);
  if (ch.id === 'homecoming' && option === 'yes') c.homecoming = true;
  if (ch.id === 'nick' && option === 'yes' && ch.target) c.nickname = ch.target;
}

/** after a win: the octagon interview */
function micChoice(c: Career, opp: NPC): Choice {
  const rival = (c.rivals ?? []).map(x => npc(c, x.id)).find(n => n && n.id !== opp.id && n.tier === c.tier);
  const opts: Choice['options'] = [];
  if (c.tier === 2 && !c.champ && c.champion && c.champion !== 'you') opts.push({id: 'champ', label: `Call out the champ`, hint: 'Big hype, makes an enemy of the champion.'});
  if (rival) opts.push({id: 'rival', label: `Call out ${rival.name}`, hint: 'Sets up a grudge match.'});
  opts.push({id: 'money', label: '"Pay me!"', hint: 'Purses up a little.'}, {id: 'thanks', label: 'Thank the team', hint: 'Small hype bump.'});
  return {kind: 'event', id: 'mic', from: 'Octagon interview', title: 'The mic is yours', text: `You just beat ${opp.name}. The interviewer puts the microphone in your face: "What's next?"`, options: opts.slice(0, 3), target: rival?.id};
}