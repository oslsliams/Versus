// VERSUS career mode: the rules. Pure functions over a plain save object so the
// game is easy to test and to store (localStorage now, an account later).
import type {Look} from '../cosmetics';
import {BEATS, CAST_KEYS, bothBeltsScene, brokenHandFight, contractBonus, contractScene, cutScene, debutNightScene, goalMet, newContract, storyFightFor, taleLine, taleNote, talePost, doubleScene, dualLostScene, epilogue, fightScene, fromName, handleOf, has, legendScene, lockerNote, makeCast, nemesisScene, nextBeat, promotedScene, startBonds, strippedScene, superLossScene, superfightScene, titleShotScene, warningScene, type Bonds, type Cast, type CastKey, type Contract, type Eff, type FightStory, type FightTale, type Scene, type StoryFight, type Award, type Line} from './story';
export {epilogue, handleOf};
import {countdownScene, extrasAfterFight, extrasWeek, hallOfFame, rustMult, tripBoost, type Extras} from './extras';
export type {Bonds, Cast, CastKey, Contract, FightTale, Scene, StoryFight};

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

export type NPC = {id: string; name: string; nickname: string; country: string; style: Style; stats: Stats; record: [number, number]; age: number; color: string; tier: number; /** + wins in a row, - losses in a row */ streak?: number; /** wins this calendar year */ yw?: number};
export type FightRecord = {week: number; age: number; opponent: string; opponentId: string; result: 'W' | 'L' | 'D'; method: string; round: number; tier: number; title: boolean; purse: number; note?: string;
  /** for the year-end awards: how it ended, a bonus, knockdowns (for, against) and the damage you took */
  how?: string; bonus?: 'potn' | 'fotn'; kd?: [number, number]; dmg?: number};
export type Tag = 'rematch' | 'grudge' | 'short' | 'eliminator';
export type Offer = {id: string; opponentId: string; tier: number; purse: number; winBonus: number; weeksOut: number; rounds: 3 | 5; title: boolean; note: string; tag?: Tag};
/** event: the card it's on ('VERSUS 214'); billing: where on the card; edge: how fired up the opponent is (live fight difficulty) */
export type Camp = Omit<Offer, 'weeksOut'> & {weeksLeft: number; event?: string; billing?: string; edge?: number; pressDone?: boolean;
  /** 0 home gym, 1 pro camp, 2 elite camp (bought with money: better fitness gains, sparring partners, scouting) */
  level?: number; scouted?: boolean; cutDone?: boolean; missedWeight?: boolean; story?: StoryFight};
export type Rival = {id: string; heat: number; why: string};
export type Choice = {kind: 'press' | 'event'; id?: string; from?: string; title: string; text: string; options: {id: string; label: string; hint: string}[]; target?: string; week?: number};
/** a finished conversation on your phone */
export type Thread = {week: number; from: string; title?: string; text: string; answer?: string; result?: string};
/** a weight class you are not currently fighting in */
export type DivisionWorld = {roster: NPC[]; rankings: string[]; champion: string | null; lineage: {week: number; name: string; how: string}[]; defenses: number};
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
  /** a cut from the last fight (0-100): it heals week by week, sparring can split it open, and it opens easier on fight night */
  cut?: number;
  /** settings: skip the training drills (quick sessions, half the gains) */
  skipDrills?: boolean;
  /** doctor's orders after a knockout */
  noSparUntil?: number;
  /** callouts, signature move, trips, achievements, career stats, records (lib/career/extras) */
  extra?: Extras;
  /** the rankings as they stood at the last power rankings (for the up / down arrows) */
  lastRanks?: string[];
  /** this year's targets, checked at the awards on your birthday */
  targets?: YearTarget[];
  /** trophies from the year-end awards */
  awards?: {year: number; label: string; detail: string}[];
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
  // the story: who is in your life, what they remember, and what has already happened
  cast?: Cast; bonds?: Bonds; flags?: string[]; storySeen?: Record<string, number>; arcWeek?: Record<string, number>;
  scenes?: Scene[]; threads?: Thread[]; nemesis?: string | null; nemesisDue?: number; partnerId?: string;
  // stakes: damage that never heals, the tax bill, how far you have climbed and how it ended
  koLosses?: number; yearPurses?: number; peakTier?: number; retireReason?: 'choice' | 'age' | 'medical';
  // legends only: other weight classes
  natural?: Division; divisionTitles?: Division[]; worlds?: Partial<Record<Division, DivisionWorld>>; superfight?: {from: Division} | null;
  contract?: Contract;
  /** holding two belts at once: each has a deadline, and missing one gets you stripped */
  dual?: {belts: [Division, Division]; due: Partial<Record<Division, number>>} | null;
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
const NICK = ['The Lighthouse', 'Static', 'Bulldozer', 'Paper Cut', 'Night Shift', 'Riptide', 'The Mechanic', 'Slow Burn', 'Sandman', 'Tremor', 'Ghost Pepper', 'The Surgeon', 'Hammerhead', 'Low Tide', 'Gravity', 'Mr. Overtime', 'The Locksmith', 'Comet', 'Brick House', 'Undertow', 'Firefly', 'The Accountant', 'Monsoon', 'Lockjaw',
  'Iceman', 'The Butcher', 'Quiet Storm', 'Red Line', 'The Professor', 'Wrecking Ball', 'Hurricane', 'The Viper', 'Deadbolt', 'Sledge', 'Northern Star', 'The Anvil', 'Blackout', 'Mongoose', 'Steamroller', 'The Wolf', 'Tsunami', 'Granite', 'The Engineer', 'Thunder', 'Knuckles', 'The Hawk', 'Ironsides', 'Lucky Seven', 'Vortex', 'Cobra', 'Old Faithful', 'The Diplomat'];
/** no two fighters on the roster share a full name or a nickname (rookies get re-rolled until they're unique) */
function uniqueNames(c: Career) {
  const names = new Set<string>([c.name]), nicks = new Set<string>(c.nickname ? [c.nickname] : []);
  for (const n of c.roster) {
    let k = 0;
    while (names.has(n.name) && k++ < 40) n.name = `${FIRST[(n.name.length * 7 + k * 13) % FIRST.length]} ${LAST[(n.id.length * 5 + k * 17) % LAST.length]}`;
    k = 0;
    while (nicks.has(n.nickname) && k++ < 80) n.nickname = NICK[(n.nickname.length * 11 + k * 7 + n.name.length) % NICK.length];
    names.add(n.name); nicks.add(n.nickname);
  }
}
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
export function createCareer(input: {name: string; nickname: string; country: string; division: Division; style: Style; color: string; backstory?: string; gym?: string; look?: Look; coldOpen?: boolean}, seed = Date.now()): Career {
  const {coldOpen, ...profile} = input;
  const r = rng(seed);
  const roster: NPC[] = [];
  for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 16; i++) roster.push(makeNPC(r, tier, i));
  const major = roster.filter(n => n.tier === 2).sort((a, b) => overall(b.stats) - overall(a.stats));
  const bs = BACKSTORIES[input.backstory ?? ''];
  const stats = statsFor(r, 38, input.style);
  if (bs) for (const [k, v] of Object.entries(bs.bonus)) stats[k as StatKey] = clamp(stats[k as StatKey] + (v ?? 0));
  const c: Career = {
    version: 1, seed, ...profile,
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
  withOffers(c, r);
  if (coldOpen) startDebut(c, r);
  return c;
}
/** a new career opens on debut night: straight to the walkout, the weekly routine comes after the first fight */
function startDebut(c: Career, r: () => number) {
  const n = c.roster.filter(x => x.tier === 0).sort((a, b) => overall(a.stats) - overall(b.stats))[1];
  const {weeksOut: _w, ...o} = offer(c, r, n.id, false); void _w;
  c.eventNo![0] = 114; c.offers = [];
  c.camp = {...o, weeksLeft: 0, event: 'Basement Brawl 114', billing: 'Prelims', edge: -.06, level: 0, pressDone: true, cutDone: true, note: 'Pro debut'};
  c.camp.story = storyFightFor(c, n, {title: false, note: 'Pro debut'}); c.fitness = 62;
  addScene(c, debutNightScene(c, n.name));
  c.log.unshift({week: c.week, text: `Short notice: ${c.name} makes his pro debut against ${n.name} tonight.`, tone: 'big'});
}

/* -------------------------------------------------------------- weekly */
/** quality: how well the drill went (0..1); left out when the drill is skipped */
/** quality: how the played drill went (0-1); skipped: the drill was skipped, a quick session worth half */
export type Action = {type: 'train'; focus: StatKey; quality?: number; skipped?: boolean} | {type: 'spar'; quality?: number; skipped?: boolean} | {type: 'rest'} | {type: 'promote'} | {type: 'tape'};
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
export const LIVING = [100, 380, 1100];                 // rent and food, per week, by league
export const CAMP_LEVELS = [{label: 'Home gym', price: 0, mult: 1}, {label: 'Pro camp', price: [700, 3500, 14000], mult: 1.35}, {label: 'Elite camp', price: [1800, 9000, 38000], mult: 1.7}] as const;
export const campPrice = (c: Career, level: number) => level === 0 ? 0 : (CAMP_LEVELS[level].price as readonly number[])[c.tier];
export const physioPrice = (c: Career) => [250, 900, 2600][c.tier];
export const prPrice = (c: Career) => [400, 2500, 12000][c.tier];
export const weeklyCost = (c: Career) => LIVING[c.tier] + (Object.entries(c.team ?? {}) as [CoachKey, number][]).reduce((s, [k, lvl]) => s + COACHES[k].pay[lvl ?? 0], 0);
export const fitnessLabel = (f: number) => f >= 88 ? 'Peak' : f >= 70 ? 'Sharp' : f >= 45 ? 'Fit' : 'Out of shape';
/** the opponent on fight night, after anything the story did to him */
export function opponentStats(c: Career, o: NPC): Stats {
  const s = {...o.stats};
  for (const [k, v] of Object.entries(c.camp?.story?.theirs ?? {})) s[k as StatKey] = clamp(s[k as StatKey] + (v ?? 0));
  return s;
}
/** what you actually bring on fight night: camp fitness (and a bad weight cut) moves the numbers */
export function fightStats(c: Career): Stats {
  const s = {...c.stats}; const d = ((c.fitness ?? 55) - 60) / 40;
  s.cardio = clamp(s.cardio + d * 8); s.chin = clamp(s.chin + d * 3); s.speed = clamp(s.speed + d * 3); s.power = clamp(s.power + d * 2);
  if (c.camp?.missedWeight) { s.cardio = clamp(s.cardio - 6); s.chin = clamp(s.chin - 3); }
  for (const [k, v] of Object.entries(c.camp?.story?.mine ?? {})) s[k as StatKey] = clamp(s[k as StatKey] + (v ?? 0));
  // away from your natural weight: bigger means more power and a sturdier chin but slower; smaller means faster but drained
  const off = DIVISIONS.indexOf(c.division) - DIVISIONS.indexOf(c.natural ?? c.division);
  if (off > 0) { s.power = clamp(s.power + 3 * off); s.chin = clamp(s.chin + 2 * off); s.speed = clamp(s.speed - 3 * off); s.cardio = clamp(s.cardio - 2 * off); }
  if (off < 0) { s.speed = clamp(s.speed - 3 * off); s.power = clamp(s.power + 2 * off); s.chin = clamp(s.chin + 3 * off); s.cardio = clamp(s.cardio + 4 * off); }
  // ring rust after a long layoff
  const rust = rustMult(c); if (rust < 1) { s.speed = clamp(Math.round(s.speed * rust)); s.iq = clamp(Math.round(s.iq * rust)); }
  return s;
}

/** the hired coach who works on this stat, if any */
const hiredCoach = (c: Career, k: StatKey) => (Object.entries(c.team ?? {}) as [CoachKey, number][]).find(([key, lvl]) => lvl && COACHES[key].stats.includes(k))?.[0];
const growth = (age: number) => age < 26 ? 1.25 : age < 30 ? 1 : age < 33 ? .7 : .4;
function gain(c: Career, k: StatKey, amount: number) {
  const room = Math.max(0, c.potential - c.stats[k]) / c.potential;
  const visitor = (c.coachWeeks ?? 0) > 0 ? 1.3 : 1;
  const hired = (Object.entries(c.team ?? {}) as [CoachKey, number][]).find(([key, lvl]) => lvl && COACHES[key].stats.includes(k));
  const trust = (c.bonds?.coach ?? 50) >= 70 ? 1.08 : 1, owned = has(c, 'owns-gym') ? 1.1 : 1;   // a coach who believes in you, and a gym you own
  const coach = visitor * trust * owned * (hired ? (hired[1] === 2 ? 1.6 : 1.3) : 1) * (c.gym && GYMS[c.gym]?.boost.includes(k) ? 1.15 : 1);
  const g = Math.max(0, Math.round(amount * coach * growth(c.age) * (room > 0 ? .15 + room * 1.4 : .05) * 10) / 10);
  c.stats[k] = clamp(Math.round((c.stats[k] + g) * 10) / 10, 1, 99);
  return g;
}

export function takeAction(prev: Career, a: Action): Career {
  if (prev.retired) return prev;
  const c: Career = migrate(structuredClone(prev));
  const r = rng(c.seed + c.week * 7919);
  const tired = c.energy < 30;
  if (a.type === 'spar' && c.week < (c.noSparUntil ?? 0)) { c.log.unshift({week: c.week, text: `No sparring for ${(c.noSparUntil ?? 0) - c.week} more week${(c.noSparUntil ?? 0) - c.week === 1 ? '' : 's'}. Doctor's orders after the knockout. Train or rest instead.`, tone: 'bad'}); return c; }
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
    const session = a.skipped ? .5 : a.quality == null ? 1 : .65 + a.quality * .85;   // a played drill: a great one is worth about twice a poor one; a skipped one, half
    const g = gain(c, a.focus, (1 + r()) * (tired ? .5 : 1) * session * tripBoost(c, a.focus));
    if ((a.quality ?? 0) >= .85) { c.fitness = Math.min(100, (c.fitness ?? 55) + 2); c.log.unshift({week: c.week, text: 'A perfect session. Everyone in the gym stopped to watch.', tone: 'good'}); }
    if (a.focus === 'cardio') c.stats.cardio = clamp(c.stats.cardio);
    const boosts = [hiredCoach(c, a.focus) ? `${COACHES[hiredCoach(c, a.focus)!].label.toLowerCase()} helping` : '', tripBoost(c, a.focus) > 1 ? 'trip boost' : '', c.gym && GYMS[c.gym]?.boost.includes(a.focus) ? 'home gym speciality' : '', c.stats[a.focus] > c.potential * .85 ? 'slower near your potential' : ''].filter(Boolean);
    c.log.unshift({week: c.week, text: `${a.skipped ? 'Quick week' : 'Hard week'} on ${STAT_LABEL[a.focus].toLowerCase()} (+${g.toFixed(1)}${a.skipped ? ', drill skipped' : ''}${boosts.length ? `; ${boosts.join(', ')}` : ''}).`});
    c.energy = Math.max(0, c.energy + ACTIONS.train.energy);
    injuryRoll(c, r, tired ? .12 : .025);
    if (c.energy < 30) c.log.unshift({week: c.week, text: `Energy ${Math.round(c.energy)}. Train or spar this tired and you're likely to get hurt. Rest a week.`, tone: 'bad'});
  } else if (a.type === 'spar') {
    const ks = [pick(r, STAT_KEYS), pick(r, STAT_KEYS), r() < .5 ? 'iq' as StatKey : pick(r, STAT_KEYS)];
    const session = a.skipped ? .5 : a.quality == null ? 1 : .65 + a.quality * .85;
    const gs = ks.map(k => `${STAT_LABEL[k]} +${gain(c, k, (.45 + r() * .5) * session * tripBoost(c, k)).toFixed(1)}`);
    c.log.unshift({week: c.week, text: `${a.skipped ? 'Light sparring' : 'Sparring rounds'}: ${[...new Set(gs)].join(', ')}.`});
    c.energy = Math.max(0, c.energy + ACTIONS.spar.energy);
    injuryRoll(c, r, tired ? .06 : .015, true);   // controlled rounds: knocks are rare and short
    if (c.energy < 30) c.log.unshift({week: c.week, text: `Energy ${Math.round(c.energy)}. Rest before you spar again or you'll get hurt.`, tone: 'bad'});
    if ((c.cut ?? 0) >= 12 && r() < .25 + (c.cut ?? 0) / 120) { c.cut = Math.min(70, (c.cut ?? 0) + 22); c.log.unshift({week: c.week, text: `The cut over your eye splits open in sparring. ${c.cast?.coach.short ?? 'Your coach'} stops the round. It's at ${Math.round(c.cut)}% now.`, tone: 'bad'}); }
  } else if (a.type === 'rest') {
    c.energy = Math.min(100, c.energy + ACTIONS.rest.energy);
    c.health = Math.min(100, c.health + 20);
    if (c.cut) c.cut = Math.max(0, c.cut - 8);
    c.log.unshift({week: c.week, text: 'Rest week. Ice baths and sleep.'});
  } else {
    const h = 4 + Math.round(r() * 5) + c.tier * 2, cash = Math.round((60 + c.tier * 300) * (1 + c.hype / 100));
    c.hype = Math.min(100, c.hype + h); c.money += cash; c.energy = Math.max(0, c.energy + ACTIONS.promote.energy);
    c.followers = (c.followers ?? 0) + Math.round(150 + c.hype * 40 * (1 + c.tier));
    c.log.unshift({week: c.week, text: `Media day: +${h} hype, +$${cash.toLocaleString()}.`});
    if (r() < .5) post(c, c.camp ? '@' + handleOf(npc(c, c.camp.opponentId)!.name) : '@CageSideNews', c.camp ? `Saw ${c.name}'s interview. Talk is cheap. See you in the cage.` : `${c.name} on the media rounds today. Says he's "ready for anyone they put in front of me."`, Math.round(30 + c.hype * 12));
  }
  return advanceWeek(c, r);
}

/** what the tape shows about a fighter (style habits the player can look for) */
function tendency(n: NPC) {
  const s = n.stats, h = [...n.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const keys = STAT_KEYS.filter(k => k !== 'iq');
  const best = [...keys].sort((a, b) => s[b] - s[a])[0], worst = [...keys].sort((a, b) => s[a] - s[b])[0];
  const STRONG: Record<string, string[]> = {striking: ['his hands are the best thing about him', 'he lands clean in every exchange'], power: ['everything he throws is loaded up', 'one shot from him has ended five fights'], speed: ['he is faster than anyone you have faced', 'he darts in and out before you can answer'], wrestling: ['he chains takedowns until you break', 'he shoots from anywhere'], grappling: ['his guard is a trap', 'he hunts the neck in every scramble'], cardio: ['he is still fresh in the last round', 'he sets a pace nobody keeps up with'], chin: ['he walks through big shots', 'nobody has ever dropped him']};
  const WEAK: Record<string, string[]> = {striking: ['his defence leaks when he throws', 'his jab is lazy'], power: ['he doesn\'t hit hard, so you can take a risk', 'he needs volume because he has no power'], speed: ['he is slow to reset after he throws', 'his footwork is flat'], wrestling: ['his takedown defence is poor', 'he panics when he\'s pressed on the fence'], grappling: ['he is lost off his back', 'he gives up position in scrambles'], cardio: ['he fades badly after round one', 'he breathes through his mouth by the second round'], chin: ['his chin has been cracked before', 'he hates getting hit clean']};
  const pickOf = (xs: string[]) => xs[h % xs.length];
  if (s[best] - s[worst] >= 10) return `${pickOf(STRONG[best])}, but ${pickOf(WEAK[worst])}. Make the fight about that.`;
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
    const weeks = Math.min(c.injuryWeeks, 2); c.injuryWeeks -= weeks; c.health = Math.min(100, c.health + 35); c.energy = Math.min(100, c.energy + 15); if (c.cut) c.cut = Math.max(0, c.cut - 15);
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
  if (c.energy < 15) chance *= 1.8;   // running on empty
  if (r() < chance) {
    // a tweak in camp: you fight hurt instead of losing the fight
    if (c.camp && (minor || r() < .5)) { c.fitness = Math.max(0, (c.fitness ?? 55) - 10); c.health = Math.max(20, c.health - 10); c.log.unshift({week: c.week, text: `You tweak something in camp. ${c.cast?.coach.short ?? 'Your coach'}: "We tape it and work around it. The fight's still on, but you won't be 100%."`, tone: 'bad'}); return; }
    c.injuryWeeks = minor ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 4); c.health = Math.max(20, c.health - (minor ? 15 : 30));
    c.log.unshift({week: c.week, text: `Injured in camp. Out ${c.injuryWeeks} weeks.`, tone: 'bad'});
    if (c.camp) { c.log.unshift({week: c.week, text: 'The fight is off. The promotion pulls the bout.', tone: 'bad'}); c.camp = null; c.hype = Math.max(0, c.hype - 5); }
  }
}

function advanceWeek(c: Career, r: () => number): Career {
  // life does not wait: a message you left unanswered for a week is gone
  if (c.choice?.kind === 'event' && c.choice.id !== 'cut' && c.choice.id !== 'belts') expireChoice(c);
  c.week += 1;
  if (c.injuryWeeks > 0) c.injuryWeeks -= 1;
  c.health = Math.min(100, c.health + 4);
  if (c.cut) { c.cut = Math.max(0, Math.round(c.cut - 12)); if (c.cut < 6) { c.cut = 0; c.log.unshift({week: c.week, text: 'The stitches come out. The cut has healed.', tone: 'good'}); } }
  c.hype = Math.max(0, c.hype - .5);
  if (!c.camp) c.fitness = Math.round(((c.fitness ?? 55) + (55 - (c.fitness ?? 55)) * .25) * 10) / 10;   // out of camp, fitness drifts back to normal
  c.followers = Math.max(0, Math.round((c.followers ?? 0) + c.hype * (3 + c.tier * 6)));
  // the bills: rent and food, and every coach on the payroll
  const bill = weeklyCost(c); c.money -= bill;
  if (c.money < 0) {
    if (c.team && Object.keys(c.team).length && c.money < -LIVING[c.tier] * 4) { c.team = {}; c.log.unshift({week: c.week, text: 'You can\'t make payroll. Your coaches walk out.', tone: 'bad'}); }
    else if (c.week % 3 === 0) c.log.unshift({week: c.week, text: `You're $${Math.abs(Math.round(c.money)).toLocaleString()} in debt. ${c.cast?.manager.short ?? 'Your manager'} says ${c.camp ? 'this next purse cannot come soon enough' : 'take the next fight offered'}.`, tone: 'bad'});
    c.energy = Math.max(0, c.energy - 4);   // working a side job
  }
  if (c.camp) c.camp.weeksLeft = Math.max(0, c.camp.weeksLeft - 1);
  c.offers = c.offers.map(o => ({...o, weeksOut: o.weeksOut})).filter(() => !c.camp);
  divisionWeek(c, r);
  extrasWeek(c, r);
  uniqueNames(c);
  if (c.week % 52 === 48 && (c.yearPurses ?? 0) * TAX_RATE >= 1000) c.log.unshift({week: c.week, text: `Your accountant: the tax bill lands on your birthday in 4 weeks. About ${Math.round((c.yearPurses ?? 0) * TAX_RATE).toLocaleString()} (25% of this year's purses). Keep it in the bank.`, tone: 'bad'});
  if (c.week % 52 === 0) ageUp(c, r);
  if (c.week % 4 === 0) worldTurns(c, r);
  if (c.dual) checkBelts(c, r);
  storyWeek(c, r);
  return c.camp || c.offers.length ? c : withOffers(c, r);
}

function ageUp(c: Career, r: () => number) {
  c.age += 1;
  // regression with age (20% slower than it used to be): speed, cardio, chin and power fade from 32
  if (c.age >= 32) for (const k of ['speed', 'cardio', 'chin', 'power'] as StatKey[]) c.stats[k] = clamp(Math.round((c.stats[k] - (1 + Math.floor(r() * (c.age - 30))) * .8) * 10) / 10);
  for (const n of c.roster) n.age += 1;
  if (!c.retired) yearAwards(c, r);
  c.log.unshift({week: c.week, text: c.age >= 32 ? `Turns ${c.age}. The body is starting to send invoices.` : `Turns ${c.age}.`, tone: c.age >= 32 ? 'bad' : undefined});
  // the tax man: a quarter of the year's purses, due on your birthday
  const tax = Math.round((c.yearPurses ?? 0) * TAX_RATE); c.yearPurses = 0;
  if (tax >= 1000) { c.money -= tax; c.log.unshift({week: c.week, text: `The tax bill lands: -$${tax.toLocaleString()}.`, tone: 'bad'}); }
  // every fighter's career ends
  if (c.age >= MAX_AGE) { forceRetire(c, 'age'); return; }
  if (c.age >= 35 && !c.choice) c.choice = {kind: 'event', id: 'crossroads', from: c.cast?.coach.short ?? 'Coach', title: `You're ${c.age}`, text: `"Another birthday. Your body is slower, and we both know it. Do you want another year of this?"`, week: c.week, options: [
    {id: 'go', label: 'One more year', hint: 'Keep fighting.'}, {id: 'stop', label: 'Hang up the gloves', hint: 'Your career ends here, on your own terms.'}]};
}

/* -------------------------------------------------------- year-end awards */
export type YearTarget = {id: 'wins' | 'finish' | 'rank' | 'title' | 'defend' | 'callup' | 'unbeaten'; label: string; n: number; base: number};
const isFinish = (h: FightRecord) => h.method === 'KO/TKO' || h.method === 'SUB';
function targetDone(c: Career, t: YearTarget, year: FightRecord[]) {
  const W = year.filter(h => h.result === 'W');
  if (t.id === 'wins') return W.length >= t.n;
  if (t.id === 'finish') return W.filter(isFinish).length >= t.n;
  if (t.id === 'rank') return c.champ || (!!c.rank && c.rank <= t.n);
  if (t.id === 'title') return c.champ || W.some(h => h.title);
  if (t.id === 'defend') return W.filter(h => h.title).length >= t.n;
  if (t.id === 'callup') return c.tier > t.base;
  return year.length >= 2 && !year.some(h => h.result === 'L');
}
function newTargets(c: Career): YearTarget[] {
  const T = (id: YearTarget['id'], label: string, n = 1): YearTarget => ({id, label, n, base: c.tier});
  if (c.tier < 2) return [T('callup', `Get called up to the ${TIERS[c.tier + 1].short}`), T('wins', 'Win 3 fights', 3), T('finish', 'Finish somebody')];
  if (c.champ) return [T('defend', 'Defend the belt twice', 2), T('unbeaten', 'Go unbeaten'), T('finish', 'Finish a challenger')];
  if (c.rank && c.rank <= 5) return [T('title', 'Win the title'), T('wins', 'Win 2 fights', 2), T('unbeaten', 'Go unbeaten')];
  const goal = c.rank ? Math.max(5, Math.floor((c.rank - 1) / 5) * 5) : 10;
  return [T('rank', `Break into the top ${goal}`, goal), T('wins', 'Win 3 fights', 3), T('finish', 'Get a finish')];
}
const KO_NAMES = ['Head kick', 'Counter left hook', 'Spinning elbow', 'Flying knee', 'Right hand', 'Uppercut'];
const SUB_NAMES = ['Rear-naked choke', 'Armbar', 'Triangle', 'Guillotine', 'Kimura', "D'Arce choke"];
/** settings: turn the training drills off (every session then counts as skipped, half the gains) */
export function setSkipDrills(prev: Career, on: boolean): Career { const c: Career = migrate(structuredClone(prev)); c.skipDrills = on; return c; }
/** this year's targets and whether they are done yet (for the hub) */
export function targetProgress(c: Career) { const start = Math.floor(c.week / 52) * 52; const fights = c.history.filter(h => h.week > start); return (c.targets ?? []).map(t => ({label: t.label, done: targetDone(c, t, fights)})); }
/** your birthday doubles as awards night: the year's best, your best moments, last year's targets and next year's */
function yearAwards(c: Career, r: () => number) {
  const year = Math.round(c.week / 52);
  const fights = c.history.filter(h => h.week > c.week - 52), W = fights.filter(h => h.result === 'W'), L = fights.filter(h => h.result === 'L');
  const pool = c.roster.filter(n => n.tier === c.tier);
  const two = () => { const a = pick(r, pool), b = pick(r, pool.filter(n => n.id !== a?.id)); return [a?.name ?? 'A prospect', b?.name ?? 'a veteran']; };
  const lg = TIERS[c.tier].short;
  const awards: Award[] = [];
  // fighter of the year
  const npcScore = (n: NPC) => (n.yw ?? 0) * 10 + (n.id === c.champion ? 15 : 0) + Math.max(0, n.streak ?? 0) * 3;
  const top = [...pool].sort((a, b) => npcScore(b) - npcScore(a))[0];   // a quiet year still crowns somebody, the busiest man on the scene
  const mine = W.length * 10 + W.filter(isFinish).length * 4 + W.filter(h => h.title).length * 15 - L.length * 12 + (c.champ ? 10 : 0);
  const fy = mine >= 25 && (!top || mine > npcScore(top));
  awards.push({label: `${lg} Fighter of the Year`, you: fy, winner: fy ? c.name : top?.name ?? '-', detail: fy ? `${W.length}-${L.length} this year${W.some(h => h.title) ? ' with a title win' : ''}${W.filter(isFinish).length ? `, ${W.filter(isFinish).length} finish${W.filter(isFinish).length > 1 ? 'es' : ''}` : ''}` : `${top?.yw ?? 0} win${top?.yw === 1 ? '' : 's'} this year${top?.id === c.champion ? ' and the belt' : ''}`});
  // knockout of the year
  const koS = (h: FightRecord) => 50 + (h.round === 1 ? 18 : 0) + (h.title ? 18 : 0) + (/kick|elbow|counter|knee/i.test(h.how ?? '') ? 14 : 0) + h.tier * 6;
  const myKO = W.filter(h => h.method === 'KO/TKO' && h.how !== 'Doctor stoppage').sort((a, b) => koS(b) - koS(a))[0];
  const rival = 45 + r() * 40 + c.tier * 6;
  if (myKO && koS(myKO) > rival) awards.push({label: 'Knockout of the Year', you: true, winner: c.name, detail: `${myKO.how ?? 'Knockout'} on ${myKO.opponent}, round ${myKO.round}`});
  else { const [a, b] = two(); awards.push({label: 'Knockout of the Year', you: false, winner: a, detail: `${pick(r, KO_NAMES)} on ${b}, round ${1 + Math.floor(r() * 3)}`}); }
  // submission of the year
  const subS = (h: FightRecord) => 50 + (h.title ? 18 : 0) + (h.round === 1 ? 10 : 0) + (/triangle|armbar|d'arce|kimura/i.test(h.how ?? '') ? 10 : 0) + h.tier * 6;
  const mySub = W.filter(h => h.method === 'SUB').sort((a, b) => subS(b) - subS(a))[0];
  if (mySub && subS(mySub) > 42 + r() * 40 + c.tier * 6) awards.push({label: 'Submission of the Year', you: true, winner: c.name, detail: `${mySub.how ?? 'Submission'} on ${mySub.opponent}, round ${mySub.round}`});
  else { const [a, b] = two(); awards.push({label: 'Submission of the Year', you: false, winner: a, detail: `${pick(r, SUB_NAMES)} on ${b}`}); }
  // fight of the year
  const fS = (h: FightRecord) => 40 + (h.bonus === 'fotn' ? 25 : 0) + (h.kd && h.kd[0] && h.kd[1] ? 20 : 0) + (h.title ? 15 : 0) + (h.method === 'SPLIT DEC' ? 10 : 0) + Math.min(15, (h.dmg ?? 0) / 4) + h.tier * 6;
  // it has to have been a fight: a decision, a war, or a finish after round one (not a quick knockout either way)
  const myF = [...fights].filter(h => h.method.includes('DEC') || h.method === 'DRAW' || h.round >= 2 || h.bonus === 'fotn' || (h.kd && h.kd[0] && h.kd[1])).sort((a, b) => fS(b) - fS(a))[0];
  if (myF && fS(myF) > 48 + r() * 40 + c.tier * 6) awards.push({label: 'Fight of the Year', you: true, winner: `${c.name} vs ${myF.opponent}`, detail: `${myF.result === 'W' ? 'You won' : myF.result === 'L' ? 'You lost' : 'A draw'} by ${myF.method}${myF.method.includes('DEC') || myF.method === 'DRAW' ? '' : ` in round ${myF.round}`}${myF.kd && myF.kd[0] && myF.kd[1] ? ', both of you hit the floor' : ''}`});
  else { const [a, b] = two(); awards.push({label: 'Fight of the Year', you: false, winner: `${a} vs ${b}`, detail: pick(r, ['Five rounds of war, split decision', 'Both men down, finished in the third', 'A comeback nobody will forget'])}); }
  // what you won pays: hype, followers and a place on your trophy shelf
  const won = awards.filter(a => a.you);
  for (const a of won) { c.hype = clamp(c.hype + 6, 0, 100); c.followers = (c.followers ?? 0) + 5000 * (1 + c.tier); (c.awards ??= []).push({year, label: a.label, detail: a.detail}); milestone(c, `${a.label} (year ${year}): ${a.detail}.`); }
  // last year's targets
  const last = (c.targets ?? []).map(t => ({label: t.label, done: targetDone(c, t, fights)}));
  const hit = last.filter(t => t.done).length;
  if (hit) c.hype = clamp(c.hype + hit * 3, 0, 100);
  c.targets = newTargets(c);
  for (const n of c.roster) n.yw = 0;
  // best moments: the year's milestones
  const moments = (c.milestones ?? []).filter(m => m.week > c.week - 52 && !/of the Year/.test(m.text)).slice(0, 3);
  const coach = c.cast?.coach.short ?? 'Coach';
  const best = W.filter(h => h.title)[0] ?? [...W].sort((a, b) => b.tier - a.tier)[0];
  const lines: Line[] = [
    {who: REPORTER.name, text: fights.length ? `Year ${year} is in the books. ${c.name} went ${W.length}-${L.length}${fights.length - W.length - L.length ? `-${fights.length - W.length - L.length}` : ''}${best ? `, and the best night was ${best.opponent}${best.title ? ' for the belt' : ''}` : ''}.` : `Year ${year} is in the books. ${c.name} didn't fight once this year, and people noticed.`},
    ...moments.map(m => ({who: REPORTER.name, text: `Moment of the year: ${m.text}`})),
    {who: coach, text: won.length ? `"${won.length > 1 ? `${['', '', 'Two', 'Three', 'Four'][won.length]} trophies` : 'A trophy'}. Enjoy it tonight. Tomorrow we're back at work."` : L.length > W.length ? '"Not our year. Write down what went wrong, then throw the paper away. New year."' : '"Nobody gave us a trophy. Good. Stay hungry."'},
  ];
  addScene(c, {id: 'awards-' + year, kicker: `Year ${year} awards · ${TIERS[c.tier].name}`, title: won.length ? `${won.length} award${won.length > 1 ? 's' : ''} for ${c.name}` : 'Awards night', tone: won.length ? 'big' : 'quiet', lines, awards, review: {last, next: c.targets.map(t => t.label)}});
  post(c, REPORTER.handle, `My year ${year} awards (${lg}): ${awards.map(a => `${a.label.replace(lg + ' ', '')}: ${a.winner}`).join(' · ')}`, 3000 + c.tier * 3000);
  c.log.unshift({week: c.week, text: won.length ? `Year-end awards: ${won.map(a => a.label).join(', ')}.` : 'Year-end awards: nothing for you this year.', tone: won.length ? 'big' : undefined});
}

function worldTurns(c: Career, r: () => number) {
  livingDivision(c, r);
  climbWorld(c, r);
}

/* ------------------------------------------------------ the living division */
/** the fight reporter who covers your division (fictional) */
export const REPORTER = {name: 'Mara Quinn', handle: '@MaraQuinnMMA'};
const METHODS = ['knockout', 'submission', 'unanimous decision', 'split decision'] as const;
const rec = (n: {record: number[]}) => `${n.record[0]}-${n.record[1]}`;
/** an NPC bout: records and streaks move, and in the big show the winner takes the loser's spot */
function npcBout(c: Career, r: () => number, a: NPC, b: NPC) {
  const aWins = r() < .5 + (overall(a.stats) - overall(b.stats)) / 60;
  const [w, l] = aWins ? [a, b] : [b, a];
  const lStreak = l.streak ?? 0;
  w.record[0] += 1; l.record[1] += 1; w.yw = (w.yw ?? 0) + 1; w.streak = Math.max(0, w.streak ?? 0) + 1; l.streak = Math.min(0, lStreak) - 1;
  const mix = w.style === 'Striker' ? [.5, .08, .3] : w.style === 'Grappler' ? [.2, .42, .28] : w.style === 'Wrestler' ? [.22, .2, .46] : [.34, .24, .32];
  let x = r(), mi = 0; while (mi < 3 && x > mix[mi]) { x -= mix[mi]; mi++; }
  const wi = c.rankings.indexOf(w.id), li = c.rankings.indexOf(l.id);
  const upset = overall(w.stats) < overall(l.stats) - 7 || (c.tier === 2 && li >= 0 && (wi < 0 || wi > li + 5));
  if (c.tier === 2 && w.tier === 2 && li >= 0 && (wi < 0 || wi > li)) {
    if (wi >= 0) c.rankings.splice(wi, 1);
    c.rankings.splice(c.rankings.indexOf(l.id), 0, w.id);
    while (c.rankings.length > 15) { const j = c.rankings.map((id, i) => id === 'you' ? -1 : i).filter(i => i >= 0).pop()!; c.rankings.splice(j, 1); }
    syncRank(c);
  }
  return {w, l, method: METHODS[mi], upset, wRank: wi, lRank: li, lStreak};
}
const rankTag = (c: Career, i: number) => c.tier === 2 && i >= 0 ? `#${i + 1} ` : '';
/** every week: someone in your division fights, and the reporter writes it up */
function divisionWeek(c: Career, r: () => number) {
  if (c.retired) return;
  const busy = new Set<string>([c.camp?.opponentId ?? '', c.champion ?? '', ...c.offers.map(o => o.opponentId)]);
  const pool = c.roster.filter(n => n.tier === c.tier && !busy.has(n.id));
  if (c.week % 4 === 2) powerRankings(c);
  if (pool.length < 2 || r() > .6) return;
  // matchmaking: rank neighbours in the big show, similar records on the regional scene
  const score = (n: NPC) => c.tier === 2 ? (c.rankings.indexOf(n.id) + 1 || 17) : -(n.record[0] - n.record[1]);
  const a = pick(r, pool);
  const near = pool.filter(n => n.id !== a.id).sort((x, y) => Math.abs(score(x) - score(a)) - Math.abs(score(y) - score(a))).slice(0, 4);
  const b = pick(r, near); if (!b) return;
  const res = npcBout(c, r, a, b), {w, l, method} = res;
  const W = rankTag(c, res.wRank) + w.name, L = rankTag(c, res.lRank) + l.name;
  const big = c.tier === 2 && ((res.lRank >= 0 && res.lRank < 5) || (res.wRank >= 0 && res.wRank < 5));
  let text: string, likes = 300 + c.tier * 500, logIt = false;
  if (res.upset) { text = pick(r, [`UPSET. ${W} stuns ${L} by ${method}. Nobody I talked to this week had this.`, `${W} just ruined a lot of betting slips. Beats ${L} by ${method}.`]); likes *= 3; logIt = true; }
  else if ((w.streak ?? 0) >= 4) { text = w.age <= 26 ? `Prospect watch is over. ${W} (${rec(w)}) makes it ${w.streak} straight, ${method} over ${L}. He's ${w.age}.` : `${W} has won ${w.streak} in a row (${rec(w)}). ${method === 'knockout' || method === 'submission' ? 'Finished' : 'Beat'} ${L} tonight. Time to take him seriously.`; likes *= 2; logIt = (w.streak ?? 0) === 4 || (w.streak ?? 0) === 6; }
  else if (res.lStreak >= 4) { text = `${L}'s ${res.lStreak}-fight win streak is over. ${W} gets it done by ${method}.`; likes *= 2; logIt = true; }
  else text = pick(r, [`Result: ${W} def. ${L} by ${method}.`, `${W} gets past ${L} (${method}). ${rec(w)} now.`, `${W} over ${L}, ${method}. ${(l.streak ?? 0) <= -3 ? `That's ${-(l.streak ?? 0)} losses in a row for ${l.name}.` : 'Solid night.'}`]);
  post(c, REPORTER.handle, text, likes);
  if (logIt || big) c.log.unshift({week: c.week, text: `Around the ${TIERS[c.tier].short.toLowerCase()} scene: ${W} beats ${L} by ${method}${res.upset ? '. An upset.' : (w.streak ?? 0) >= 4 ? `, his ${w.streak}th straight.` : '.'}`, tone: res.upset && big ? 'big' : undefined});
  // a hot fighter near you wants your name
  if ((w.streak ?? 0) >= 3 && c.record[0] >= 2 && r() < .3 && w.id !== c.nemesis) {
    addHeat(c, w.id, 15, 'is calling for you');
    post(c, '@' + handleOf(w.name), `${w.streak} in a row. ${c.name}, you're next. Stop hiding.`, likes);
  }
}
/** every four weeks: the reporter's top five, with who's rising */
function powerRankings(c: Career) {
  const ids = c.tier === 2 ? [c.champion ?? '', ...c.rankings].filter(Boolean)
    : [...c.roster.filter(n => n.tier === c.tier).map(n => n.id), 'you'].sort((x, y) => { const s = (id: string) => { const rr = id === 'you' ? c.record : npc(c, id)!.record; return rr[0] - rr[1]; }; return s(y) - s(x); });
  // after a call-up the old list means nothing: start the arrows fresh
  const prev = (c.lastRanks ?? []).some(id => id !== 'you' && ids.includes(id)) ? c.lastRanks! : [];
  const line = ids.slice(0, 5).map((id, i) => {
    const n = id === 'you' ? null : npc(c, id);
    const p = prev.indexOf(id), mv = p < 0 ? ' NEW' : p > i ? ` ▲${p - i}` : p < i ? ` ▼${i - p}` : '';
    const hot = (n?.streak ?? (id === 'you' ? c.streak ?? 0 : 0)) >= 3 ? ' 🔥' : '';
    return `${c.tier === 2 && i === 0 ? 'C' : i + (c.tier === 2 ? 0 : 1)}. ${n ? n.name : c.name} (${n ? rec(n) : rec(c)})${mv}${hot}`;
  });
  if (prev.length) post(c, REPORTER.handle, `Power rankings, ${TIERS[c.tier].short}: ${line.join(' · ')}`, 800 + c.tier * 900);
  c.lastRanks = ids;
}
/** the reporter's take after your fight */
function reporterTake(c: Career, r: () => number, opp: NPC, out: FightOutcome) {
  const won = out.winner === 'you', lost = out.winner === 'opp', fin = out.method === 'KO/TKO' || out.method === 'SUB';
  const t = out.tale, stat = t && t.landed > 0 ? ` He landed ${t.landed} of ${t.thrown}${t.takedowns ? ` with ${t.takedowns} takedown${t.takedowns > 1 ? 's' : ''}` : ''}.` : '';
  const next = c.tier === 2 ? (c.champ ? ' The line of contenders just got shorter.' : c.rank ? ` Expect him around #${c.rank} on Monday.` : '') : won ? ` ${Math.max(0, (c.tier === 0 ? 3 : 2) - c.tierWins)} more like that and the ${TIERS[c.tier + 1].short} calls.` : '';
  const text = won ? `My take: ${c.name} (${rec(c)}) ${fin ? `finished ${opp.name} in round ${out.round}${out.how ? ` (${out.how.toLowerCase()})` : ''}` : `outworked ${opp.name} over ${out.round}`}.${stat}${(c.streak ?? 0) >= 3 ? ` That's ${c.streak} straight.` : ''}${next}`
    : lost ? `My take: a tough night for ${c.name}. ${opp.name} ${out.method === 'KO/TKO' ? 'stopped him' : out.method === 'SUB' ? 'submitted him' : 'took the decision'} in round ${out.round}.${(c.streak ?? 0) <= -2 ? ` That's ${-(c.streak ?? 0)} losses in a row. His spot on the roster isn't safe.` : ' He has the tools to bounce back.'}`
    : `My take: a draw between ${c.name} and ${opp.name}. Nobody wins, so somebody books the rematch.`;
  post(c, REPORTER.handle, text, 1200 + c.hype * 50 + (r() < .5 ? 300 : 0));
}

/* --------------------------------------------------------------- offers */
export const npc = (c: Career, id: string) => c.roster.find(n => n.id === id);
function syncRank(c: Career) { const i = c.rankings.indexOf('you'); c.rank = c.tier === 2 && i >= 0 ? i + 1 : null; }

function withOffers(c: Career, r: () => number): Career {
  if (c.camp || c.injuryWeeks > 0 || c.retired || c.week < c.nextOfferWeek) return c;
  // a legend visiting another weight class has exactly one fight to take: that division's champion
  if (c.superfight && c.champion && c.champion !== 'you') { c.offers = [superOffer(c, r)]; return c; }
  if (c.dual) focusBelt(c, r);   // a double champion always gets offers for whichever belt is due first
  const recent = new Set(c.history.slice(0, 3).map(h => h.opponentId));
  const times = (id: string) => c.history.filter(h => h.opponentId === id).length;
  const fresh = (id: string) => !recent.has(id) && times(id) < 3;
  const pool = c.roster.filter(n => n.tier === c.tier && fresh(n.id));
  const offers: Offer[] = [];
  // hype is reach: the more people want to see you, the more (and bigger) fights the matchmakers offer
  const reach = Math.floor(c.hype / 20);                  // 0..5
  const want = 2 + (c.hype >= 30 ? 1 : 0) + (c.hype >= 60 ? 1 : 0);
  if (c.tier === 2 && !c.champ && c.rank != null && c.champion && c.champion !== 'you' && (c.rank === 1 || (c.rank <= 3 + Math.floor(c.hype / 30) && (c.hype >= 35 || (c.streak ?? 0) >= 3)))) {
    offers.push(offer(c, r, c.champion, true));
  }
  if (c.tier === 2 && c.champ) {
    // title defenses: the matchmakers pitch two challengers from the top six, never the last two people
    // you fought, with bad blood and momentum pushing names up the list
    // and once you have beaten a man three times, he has to win his way back before he gets a fourth
    let pool = c.rankings.slice(0, 6).filter(id => id !== 'you' && !recent.has(id) && times(id) < 3);
    if (pool.length < 2) pool = c.rankings.slice(0, 10).filter(id => id !== 'you' && !recent.has(id) && times(id) < 4);
    if (pool.length < 2) pool = c.rankings.slice(0, 6).filter(id => id !== 'you' && id !== c.history[0]?.opponentId);
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
      if (!n || n.tier !== c.tier || c.history.slice(0, 2).some(h => h.opponentId === n.id) || times(n.id) >= 3 || c.champion === n.id || offers.some(o => o.opponentId === n.id)) continue;
      offers.push(offer(c, r, n.id, false, c.tier, beaten(c, n.id) ? 'rematch' : 'grudge'));
    }
    let near = pool;
    const fresh2 = c.history.filter(h => h.tier === c.tier).length < 2 && c.tier > 0;
    if (fresh2) near = [...pool].sort((x, y) => overall(x.stats) - overall(y.stats)).slice(0, Math.max(3, Math.ceil(pool.length / 4)));
    if (c.tier === 2 && c.rank != null && !fresh2) near = c.rankings.slice(Math.max(0, c.rank - 4 - reach), c.rank + 4).filter(id => id !== 'you' && fresh(id)).map(id => npc(c, id)!).filter(Boolean);
    if (near.length < 2) near = pool;   // everyone near you is someone you just fought: look further down the list
    // reach fight: enough hype gets you a call-up bout against someone from the league above
    if (c.tier < 2 && c.hype >= 35) {
      const mine = overall(c.stats);
      const above = c.roster.filter(n => n.tier === c.tier + 1 && fresh(n.id) && overall(n.stats) <= mine + 8).sort((x, y) => overall(x.stats) - overall(y.stats));
      const pickUp = above[Math.floor(r() * Math.max(1, Math.ceil(above.length / 2)))];
      if (pickUp) offers.push(offer(c, r, pickUp.id, false, c.tier + 1));
    }
    const shuffled = [...near].filter(n => !offers.some(o => o.opponentId === n.id)).sort(() => r() - .5).slice(0, Math.max(0, want + Math.min(2, offers.length) - offers.length));
    for (const n of shuffled) offers.push(offer(c, r, n.id, false));
  }
  if (c.dual) for (const o of offers) { o.weeksOut = DUAL_CAMP; o.note = `${c.division} title defense`; }   // two belts means short camps
  c.offers = offers;
  return c;
}

/** show money by league (the win bonus matches it) */
const PAY = [1000, 6000, 18000];
function offer(c: Career, r: () => number, opponentId: string, title: boolean, tier = c.tier, tag?: Tag): Offer {
  const bump = tag === 'rematch' || tag === 'grudge' ? 1.4 : tag === 'eliminator' ? 1.3 : tag === 'short' ? 1.5 : 1;
  // show money roughly doubles with a win (show + win bonus, like real contracts); hype and a better deal push it up
  // a reach fight pays a premium over your own league, not the other league's rate; in the big show your ranking sets the price
  const tierBase = tier > c.tier ? PAY[c.tier] * 2.2 : PAY[tier];
  const rankMult = tier === 2 && c.tier === 2 ? (c.champ ? 2.4 : 1 + Math.max(0, 16 - (c.rank ?? 16)) / 8) : 1;
  const titleMult = title ? 3 + (c.champ ? Math.min(5, c.defenses) * .2 : 0) : 1;
  const base = tierBase * rankMult * titleMult * (1 + c.hype / 200) * bump * (c.payBump ?? 1) * ((c.bonds?.manager ?? 50) >= 70 ? 1.05 : 1);   // a manager who fights for you gets you more
  const o = npc(c, opponentId)!;
  const gap = overall(o.stats) - overall(c.stats);
  const note = tag === 'rematch' ? (title ? 'Title rematch' : 'Rematch') : tag === 'grudge' ? (title ? 'Grudge title fight' : 'Grudge match') : tag === 'eliminator' ? 'Title eliminator' : tag === 'short' ? 'Short notice'
    : title ? (c.champ ? 'Title defense' : 'Title shot') : tier > c.tier ? `Reach fight: ${TIERS[tier].short} call-up` : gap > 10 ? `Big step up (+${gap} OVR)` : gap > 4 ? `Step up (+${gap} OVR)` : gap < -8 ? 'Tune-up fight' : gap < -4 ? 'You\'re the favourite' : 'Even matchup';
  // show money plus a bigger win bonus: winning is worth 2.5x losing, like real contracts
  return {id: `${opponentId}-${c.week}`, opponentId, tier, purse: Math.round(base * .8 / 50) * 50, winBonus: Math.round(base * 1.2 / 50) * 50, weeksOut: tag === 'short' ? 2 + Math.floor(r() * 2) : title ? 10 : 6 + Math.floor(r() * 5), rounds: title || tag === 'eliminator' ? 5 : 3, title, note, tag};
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
  c.camp.story = storyFightFor(c, n, {title: o.title, tag: o.tag, note: c.camp.note});
  if (c.camp.story) c.log.unshift({week: c.week, text: `${c.camp.story.title}: ${c.camp.story.goal.label.toLowerCase()} for a bonus.`, tone: 'good'});
  c.log.unshift({week: c.week, text: `Signed: ${c.name} vs ${n.name}, ${billing.toLowerCase()} of ${event}${o.title ? ' for the belt' : ''}. Camp starts now: train hard to peak on fight night.`, tone: 'big'});
  post(c, '@MMAWire', `BREAKING: ${c.name} vs ${n.name} is official for ${event}${o.title ? ' with the belt on the line' : ''}. ${o.tag === 'grudge' ? 'These two do NOT like each other.' : o.tag === 'rematch' ? 'Run it back.' : ''}`.trim(), 300 + c.hype * 25);
  // what he says depends on what has actually happened between you
  if (o.tag === 'grudge' || o.tag === 'rematch') { const last = c.history.find(h => h.opponentId === n.id); c.log.unshift({week: c.week, text: `${n.name}: "${pick(rng(c.seed + c.week), !last ? TRASH_NEW : last.result === 'L' ? TRASH_BEAT_YOU : TRASH_LOST_TO_YOU)}"`, tone: 'bad'}); }
  if (o.title && !c.champ && !c.superfight && !c.history.some(h => h.title)) addScene(c, titleShotScene(c, n.name));
  else if (o.title) addScene(c, countdownScene(c, n, c.champ));
  return c;
}
export function declineOffer(prev: Career, id: string): Career {
  const c: Career = migrate(structuredClone(prev));
  (c.extra ??= {}).declined = c.week;
  c.offers = c.offers.filter(o => o.id !== id); c.hype = Math.max(0, c.hype - 2);
  if (!c.offers.length) return withOffers(c, rng(c.seed + c.week * 31 + 7));
  return c;
}

/* --------------------------------------------------------- after a fight */
export type FightOutcome = {winner: 'you' | 'opp' | 'draw'; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; damageTaken: number; how?: string; tale?: FightTale};

export function applyResult(prev: Career, out: FightOutcome): Career {
  const c: Career = migrate(structuredClone(prev));
  const camp = c.camp; if (!camp) return c;
  const opp = npc(c, camp.opponentId)!;
  const r = rng(c.seed + c.week * 104729);
  const won = out.winner === 'you', lost = out.winner === 'opp';
  const before = {wasChamp: c.champ, tier: c.tier, fights: c.record[0] + c.record[1] + c.record[2], wins: c.record[0], losses: c.record[1], settled: false};
  let purse = camp.purse + (won ? camp.winBonus : 0);
  if (camp.missedWeight) purse = Math.round(purse * .8);           // 20% of the purse to the other corner
  // the cut: your manager and your gym take theirs off the top, like real fighters' purses
  const manager = Math.round(purse * .1), gymCut = Math.round(purse * .1);
  c.money += purse - manager - gymCut;
  c.earnings = (c.earnings ?? 0) + purse; c.yearPurses = (c.yearPurses ?? 0) + purse;
  c.lastPayout = {gross: purse, manager, gym: gymCut, camp: campPrice(c, camp.level ?? 0), net: purse - manager - gymCut, bonus: 0};
  c.streak = won ? Math.max(1, (c.streak ?? 0) + 1) : lost ? Math.min(-1, (c.streak ?? 0) - 1) : 0;
  if (won) { c.record[0] += 1; opp.record[1] += 1; c.tierWins += 1; if (out.method === 'KO/TKO') c.finishes.ko += 1; else if (out.method === 'SUB') c.finishes.sub += 1; else c.finishes.dec += 1; }
  else if (lost) { c.record[1] += 1; opp.record[0] += 1; } else c.record[2] += 1;
  c.hype = clamp(c.hype + (won ? (out.method === 'DEC' || out.method === 'SPLIT DEC' ? 8 : 15) + (camp.title ? 15 : 0) : lost ? -12 : 2), 0, 100);
  c.health = Math.max(10, c.health - out.damageTaken * .6);
  c.energy = 55;
  if ((out.tale?.cut ?? 0) >= 20) { c.cut = Math.max(c.cut ?? 0, Math.min(90, out.tale!.cut!)); const st = Math.round(c.cut / 4); c.log.unshift({week: c.week, text: `${st} stitches over the eye. ${c.cut >= 45 ? 'Stay out of hard sparring or it will split again.' : 'Give it a couple of weeks.'}`, tone: 'bad'}); }
  if (out.how === 'Doctor stoppage') c.log.unshift({week: c.week, text: lost ? `The doctor stopped it on your cut. ${c.cast?.coach.short ?? 'Your coach'} is furious: "You were still in that fight."` : `The doctor stopped it on ${opp.name}'s cut. A win is a win, but nobody's celebrating that one.`, tone: lost ? 'bad' : undefined});
  if (out.damageTaken > 60 && r() < .5) { c.injuryWeeks = 3 + Math.floor(r() * 4); c.log.unshift({week: c.week, text: `Medical suspension: ${c.injuryWeeks} weeks.`, tone: 'bad'}); }
  for (const k of STAT_KEYS) gain(c, k, .3);
  c.history.unshift({week: c.week, age: c.age, opponent: opp.name, opponentId: opp.id, result: won ? 'W' : lost ? 'L' : 'D', method: out.method, round: out.round, tier: camp.tier, title: camp.title, purse});
  const res = won ? 'beats' : lost ? 'loses to' : 'draws with';
  c.log.unshift({week: c.week, text: `${camp.event ? camp.event + ': ' : ''}${c.name} ${res} ${opp.name} by ${out.method} in round ${out.round}. Purse $${purse.toLocaleString()}.`, tone: won ? 'good' : lost ? 'bad' : undefined});
  { const hr = c.history[0]; hr.how = out.how; hr.dmg = Math.round(out.damageTaken); if (out.tale) hr.kd = [out.tale.kdFor, out.tale.kdAgainst]; }
  // post-fight bonuses, like the real thing
  const finish = out.method === 'KO/TKO' || out.method === 'SUB';
  const bonus = [2000, 12000, 50000][camp.tier];
  if (won && finish && r() < .45) { c.money += bonus; c.lastPayout!.bonus = bonus; c.hype = clamp(c.hype + 4, 0, 100); c.bonuses!.potn += 1; c.history[0].bonus = 'potn'; c.log.unshift({week: c.week, text: `Performance of the Night! +$${bonus.toLocaleString()}.`, tone: 'big'}); }
  else if (out.damageTaken > 35 && (won || out.method !== 'KO/TKO') && r() < .3) { c.money += bonus; c.lastPayout!.bonus = bonus; c.bonuses!.fotn += 1; c.history[0].bonus = 'fotn'; c.log.unshift({week: c.week, text: `Fight of the Night with ${opp.name}. Both of you take home +$${bonus.toLocaleString()}.`, tone: 'big'}); }
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
  // storylines: losses breed rivals, close split decisions breed rematches, wins over rivals settle them
  const heatBefore = heatOf(c, opp.id);
  if (won && heatBefore >= 40) { before.settled = true; setHeat(c, opp.id, 0, ''); c.hype = clamp(c.hype + 8, 0, 100); c.log.unshift({week: c.week, text: `Rivalry settled. ${c.name} gets the last word over ${opp.name}.`, tone: 'big'}); }
  else if (lost) addHeat(c, opp.id, 40, `beat you at ${camp.event ?? 'their last meeting'}`);
  if (out.method === 'SPLIT DEC') { addHeat(c, opp.id, 25, 'a disputed split decision'); c.log.unshift({week: c.week, text: `Fans are split on the scorecards. Talk of a rematch already.`}); }
  if (won && camp.tag === 'eliminator' && c.tier === 2 && !c.champ) { c.rankings = c.rankings.filter(id => id !== 'you'); c.rankings.unshift('you'); c.log.unshift({week: c.week, text: `Eliminator won. ${c.name} is the #1 contender.`, tone: 'big'}); }

  if (c.tier === 2) {
    if (camp.title) {
      if (won && !c.champ) { const old = c.champion!; c.champ = true; c.champion = 'you'; c.defenses = 0; c.lineage!.unshift({week: c.week, name: c.name, how: `beat ${opp.name}`}); c.rankings = c.rankings.filter(id => id !== 'you'); c.rankings.unshift(old); c.rankings = c.rankings.slice(0, 15); c.log.unshift({week: c.week, text: `AND NEW! ${c.name} is the VERSUS ${c.division} champion.`, tone: 'big'}); }
      else if (won && c.champ) { c.defenses += 1; c.log.unshift({week: c.week, text: `Title defense number ${c.defenses}.`, tone: 'big'}); }
      else if (lost && c.champ) { c.champ = false; c.defenses = 0; c.champion = opp.id; c.lineage!.unshift({week: c.week, name: opp.name, how: `beat ${c.name}`}); c.rankings = c.rankings.filter(id => id !== opp.id); c.rankings.unshift('you'); c.rankings = c.rankings.slice(0, 15); c.log.unshift({week: c.week, text: `The belt changes hands. ${opp.name} is the new champion.`, tone: 'bad'}); }
    } else if (!c.champ) {
      const me = c.rankings.indexOf('you'), them = c.rankings.indexOf(opp.id);
      c.rankings = c.rankings.filter(id => id !== 'you');
      let to = me < 0 ? c.rankings.length : me;
      if (won && them >= 0 && (me < 0 || them < me)) to = them; else if (won) to = Math.max(0, (me < 0 ? 14 : me) - (out.method === 'KO/TKO' || out.method === 'SUB' ? 2 : 1)); else if (lost) to = Math.min(c.rankings.length, (me < 0 ? 15 : me) + 2);
      if (!(lost && me < 0)) c.rankings.splice(Math.min(to, 14), 0, 'you');
      c.rankings = c.rankings.slice(0, 15);
    }
    syncRank(c);
  }
  // promotions up the ladder
  const reachWin = won && camp.tier > c.tier;   // beat someone from the league above: straight call-up
  if (lost && camp.tier > c.tier) { c.hype = clamp(c.hype - 8, 0, 100); c.log.unshift({week: c.week, text: `The ${TIERS[camp.tier].short} scouts saw it. The call-up talk goes quiet for now.`, tone: 'bad'}); }
  const ready = overall(c.stats) >= READY[c.tier] - (reachWin ? 3 : 0);
  if (c.tier < 2 && won && !ready && (reachWin || (c.tierWins >= (c.tier === 0 ? 3 : 2) && c.hype >= (c.tier === 0 ? 20 : 35)))) c.log.unshift({week: c.week, text: `The ${TIERS[c.tier + 1].short} scouts like the record, but want you stronger first (OVR ${READY[c.tier]} or better, you're ${overall(c.stats)}).`});
  if (c.tier < 2 && won && ready && (reachWin || (c.tierWins >= (c.tier === 0 ? 3 : 2) && c.hype >= (c.tier === 0 ? 20 : 35)))) {
    c.tier += 1; c.tierWins = 0;
    milestone(c, c.tier === 2 ? `Signs with the VERSUS Championship, the big show, at ${c.age}.` : `Called up to the ${TIERS[c.tier].name}.`);
    if (c.tier === 2) { c.rankings = c.rankings.slice(0, 14); c.rankings.push('you'); syncRank(c); }
    c.log.unshift({week: c.week, text: `Contract offer accepted: ${c.name} moves up to the ${TIERS[c.tier].name}!`, tone: 'big'});
  }
  if (c.rank && c.rank <= 15 && !(c.milestones ?? []).some(m => m.text.startsWith('Ranked'))) milestone(c, `Ranked #${c.rank} in the ${c.division} division for the first time.`);
  extrasAfterFight(c, r, opp, out);
  reporterTake(c, r, opp, out);
  afterFight(c, r, camp, opp, out, before);
  c.camp = null;
  c.nextOfferWeek = c.week + Math.max(1, 3 - Math.floor(c.hype / 34)) + Math.round(out.damageTaken / 20) + c.injuryWeeks;   // hyped fighters get the phone call sooner
  if (c.dual) c.nextOfferWeek = c.week;                 // no time off with two belts to defend
  return withOffers(c, r);
}

export function retire(prev: Career): Career {
  const c: Career = migrate(structuredClone(prev)); forceRetire(c, 'choice');
  return c;
}
function forceRetire(c: Career, why: NonNullable<Career['retireReason']>) {
  c.retired = true; c.retireReason = why; c.camp = null; c.offers = []; c.choice = null; c.scenes = [];
  c.log.unshift({week: c.week, text: `${c.name} retires at ${c.age} with a ${c.record.join('-')} record.`, tone: 'big'});
  milestone(c, `Retires at ${c.age}, ${c.record.join('-')}.`);
  hallOfFame(c, legacy(c));
}

export function legacy(c: Career) {
  const titleWins = c.history.filter(h => h.title && h.result === 'W').length;
  return Math.round(c.record[0] * 10 - c.record[1] * 4 + (c.finishes.ko + c.finishes.sub) * 4 + titleWins * 60 + c.tier * 40 + c.hype + Math.max(0, (c.divisionTitles?.length ?? 0) - 1) * 250);
}

/* ============================================================ storylines */
// The division lives on without you: title fights, retirements, new prospects, callouts and bad blood.
const TAX_RATE = .25, MAX_AGE = 42, KO_LIMIT = 12;
/** how good you need to be for a call-up to each next league (overall) */
const READY = [52, 64];

/** fill in storyline fields on saves from before they existed */
export function migrate(c: Career): Career {
  c.rivals ??= []; c.choice ??= null; c.eventNo ??= [112, 38, 207]; c.bonuses ??= {potn: 0, fotn: 0};
  c.lineage ??= []; c.coachWeeks ??= 0;
  c.owned ??= []; c.team ??= {}; c.fitness ??= 55; c.followers ??= 200 + c.record[0] * 900; c.feed ??= []; c.milestones ??= [];
  c.earnings ??= c.history.reduce((s, h) => s + h.purse, 0); c.lastPayout ??= null; c.payBump ??= 1; c.streak ??= 0;
  c.cast ??= makeCast(c.seed, c.gym); c.bonds ??= startBonds(); c.flags ??= []; c.storySeen ??= {}; c.arcWeek ??= {}; c.scenes ??= []; c.threads ??= [];
  c.koLosses ??= c.history.filter(h => h.result === 'L' && h.method === 'KO/TKO').length; c.yearPurses ??= 0; c.peakTier ??= c.tier;
  c.contract ??= newContract(c); c.natural ??= c.division; c.divisionTitles ??= c.champ ? [c.division] : []; c.worlds ??= {}; c.superfight ??= null; c.nemesis ??= null;
  c.targets ??= newTargets(c);
  if (!c.lineage.length && c.champion && c.champion !== 'you') { const ch = npc(c, c.champion); if (ch) c.lineage.push({week: c.week, name: ch.name, how: 'reigning champion'}); }
  return c;
}
export const heatOf = (c: Career, id: string) => (c.rivals ?? []).find(x => x.id === id)?.heat ?? 0;
function post(c: Career, handle: string, text: string, likes: number, you = false) {
  c.feed ??= [];
  c.feed.unshift({week: c.week, handle, text, likes: Math.max(3, Math.round(likes * (.7 + ((c.week * 7 + text.length) % 60) / 100))), you});
  c.feed = c.feed.slice(0, 40);
}
function milestone(c: Career, text: string) { c.milestones ??= []; c.milestones.unshift({week: c.week, age: c.age, text}); }
function addScene(c: Career, s: Scene | null) { if (s) (c.scenes ??= []).push(s); }
/** the player has finished reading the scene on screen */
export function dismissScene(prev: Career): Career { const c: Career = migrate(structuredClone(prev)); c.scenes!.shift(); return c; }
function addThread(c: Career, t: Omit<Thread, 'week'>) { c.threads = [...(c.threads ?? []), {week: c.week, ...t}].slice(-40); }
function bond(c: Career, k: CastKey, n: number) { c.bonds![k] = Math.max(0, Math.min(100, c.bonds![k] + n)); }
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

const TRASH_NEW = ['I already beat guys like you in the gym. You are a warm-up.', 'Enjoy the hype while it lasts. I am taking it.', 'He has never been hit by someone like me.', 'Tell him to bring a mouthguard and a backup plan.', 'I watched his tape. I fell asleep twice.', 'This is my division. He is visiting.'];
const TRASH_BEAT_YOU = ['I already beat him once. I can do it in my sleep.', 'He knows exactly how this ends. He was there.', 'Nothing has changed except his excuses.', 'Ask him what the canvas looks like up close.'];
const TRASH_LOST_TO_YOU = ['Last time was a fluke. This time I finish it.', 'I have thought about that night every single day.', 'He got lucky once. Nobody gets lucky twice.', 'I was hurt last time. Now he gets the real me.'];
const CALLOUTS = ['I want {you}. Nobody else.', '{you} is ducking me. Sign the paper.', 'Everyone keeps asking about {you}. Let us settle it.', '{you} is overrated and I will prove it.'];

/** every 4 weeks: the division moves (called from worldTurns) */
function livingDivision(c: Career, r: () => number) {
  const tierPool = c.roster.filter(n => n.tier === c.tier);
  // the title gets fought for while you climb: belts change hands, challengers come and go
  const inTitleCamp = !!c.camp?.title;
  if (c.tier === 2 && !c.champ && !inTitleCamp && c.champion && c.week % 16 === 0) {
    const champ = npc(c, c.champion)!;
    const chalId = c.rankings.find(id => id !== 'you');
    const chal = chalId ? npc(c, chalId) : undefined;
    if (champ && chal) {
      const chalWins = r() < .36 + (overall(chal.stats) - overall(champ.stats)) / 50;
      const ev = c.camp && c.camp.tier === 2 ? 'a VERSUS Fight Night' : `VERSUS ${++c.eventNo![2]}`;
      if (chalWins) {
        c.champion = chal.id; chal.record[0] += 1; champ.record[1] += 1;
        c.rankings = c.rankings.filter(id => id !== chal.id); c.rankings.splice(1, 0, champ.id); c.rankings = c.rankings.slice(0, 15); syncRank(c);
        c.lineage!.unshift({week: c.week, name: chal.name, how: `beat ${champ.name} at ${ev}`});
        c.log.unshift({week: c.week, text: `${ev}: AND NEW! ${chal.name} dethrones ${champ.name} by ${pick(r, ['knockout', 'submission', 'split decision', 'unanimous decision'])}.`, tone: 'big'});
        chal.streak = Math.max(0, chal.streak ?? 0) + 1; champ.streak = -1; chal.yw = (chal.yw ?? 0) + 1;
        post(c, REPORTER.handle, `AND NEW. ${chal.name} is the ${c.division} champion. ${champ.name}'s reign ends at ${ev}.`, 9000);
      } else {
        champ.record[0] += 1; chal.record[1] += 1;
        const ci = c.rankings.indexOf(chal.id); if (ci >= 0) { c.rankings.splice(ci, 1); c.rankings.splice(Math.min(c.rankings.length, ci + 2), 0, chal.id); syncRank(c); }
        c.log.unshift({week: c.week, text: `${ev}: ${champ.name} defends the belt against ${chal.name}.`, tone: 'big'});
        champ.streak = Math.max(0, champ.streak ?? 0) + 1; champ.yw = (champ.yw ?? 0) + 1; chal.streak = Math.min(0, chal.streak ?? 0) - 1;
        post(c, REPORTER.handle, `${champ.name} is still the champ. Turned back ${chal.name} at ${ev}. Who's left for him?`, 6000);
      }
    }
  }
  // careers end: old veterans retire and hungry prospects take their place
  for (const n of [...c.roster]) {
    if (n.age < 35 || r() > .12 || n.id === c.champion || n.id === c.camp?.opponentId || n.id === c.nemesis || n.id === c.partnerId || c.offers.some(o => o.opponentId === n.id)) continue;
    const idx = c.roster.indexOf(n);
    const fresh = makeNPC(r, n.tier, Math.floor(r() * 16)); fresh.age = 21 + Math.floor(r() * 4); fresh.record = [3 + Math.floor(r() * 5) + n.tier * 3, 0];
    c.roster[idx] = fresh;
    const ri = c.rankings.indexOf(n.id); if (ri >= 0) c.rankings[ri] = fresh.id;
    c.rivals = (c.rivals ?? []).filter(x => x.id !== n.id);
    if (n.tier === c.tier) c.log.unshift({week: c.week, text: `${n.name} retires at ${n.age} (${n.record.join('-')}). Unbeaten prospect ${fresh.name} "${fresh.nickname}" signs in his place.`});
    break;
  }
  // old feuds cool off and only the hottest six stay live, but the one who hurt you most never goes away
  c.rivals = (c.rivals ?? []).map(x => ({...x, heat: x.id === c.nemesis ? Math.max(45, x.heat - 3) : x.heat - 3})).filter(x => x.heat > 0).sort((a, b) => b.heat - a.heat).slice(0, 6);
  // someone wants your name in their mouth
  if (c.record[0] >= 2 && r() < .2) {
    const near = c.tier === 2 && c.rank ? c.rankings.slice(Math.max(0, c.rank - 4), c.rank + 4).filter(id => id !== 'you') : tierPool.map(n => n.id);
    const n = npc(c, pick(r, near) ?? '');
    if (n && n.id !== c.camp?.opponentId) {
      addHeat(c, n.id, 22, 'called you out');
      c.log.unshift({week: c.week, text: `${n.name} on a podcast: "${pick(r, CALLOUTS).replace('{you}', c.name)}"`});
    }
  }
}

/** fighters climb the leagues too, so the people from your past can catch up with you */
function promoteNPC(c: Career, r: () => number, n: NPC, to: number) {
  const base = [44, 58, 70], from = n.tier;
  for (const k of STAT_KEYS) n.stats[k] = clamp(Math.round(n.stats[k] + (base[to] - base[from]) * .85), 15, 97);
  n.tier = to; c.roster.push(makeNPC(r, from, Math.floor(r() * 16)));
  if (to === 2 && !c.rankings.includes(n.id)) {
    for (let i = c.rankings.length - 1; i >= 0 && c.rankings.length >= 15; i--) if (c.rankings[i] !== 'you') { c.rankings.splice(i, 1); break; }
    c.rankings.splice(Math.min(c.rankings.length, 11), 0, n.id); syncRank(c);
  }
}
function climbWorld(c: Career, r: () => number) {
  const nem = c.nemesis ? npc(c, c.nemesis) : undefined;
  if (nem && nem.tier < c.tier && c.week >= (c.nemesisDue ?? 0) && c.camp?.opponentId !== nem.id) {
    while (nem.tier < c.tier) promoteNPC(c, r, nem, nem.tier + 1);
    setHeat(c, nem.id, Math.max(heatOf(c, nem.id), 60), 'beat you on the way up');
    if (!has(c, 'nemesis-scene-' + nem.id + '-' + c.tier)) { c.flags!.push('nemesis-scene-' + nem.id + '-' + c.tier); addScene(c, nemesisScene(c, nem.name, TIERS[c.tier].name)); }
    c.log.unshift({week: c.week, text: `${nem.name} has been signed by the ${TIERS[c.tier].name}. He says he came for you.`, tone: 'big'});
  }
  if (c.week % 24 !== 0) return;
  for (const t of [0, 1]) {
    const best = c.roster.filter(n => n.tier === t && n.id !== c.camp?.opponentId && n.id !== c.nemesis && !c.offers.some(o => o.opponentId === n.id)).sort((x, y) => (y.record[0] - y.record[1]) - (x.record[0] - x.record[1]))[0];
    if (!best) continue;
    promoteNPC(c, r, best, t + 1);
    if (t + 1 === c.tier) c.log.unshift({week: c.week, text: `${best.name} (${best.record.join('-')}) has been called up to the ${TIERS[c.tier].short} ranks.`});
  }
  // keep the top league from growing forever
  const spare = c.roster.filter(n => n.tier === 2 && n.id !== c.champion && !c.rankings.includes(n.id) && n.id !== c.nemesis && n.id !== c.partnerId && n.id !== c.camp?.opponentId && !c.offers.some(o => o.opponentId === n.id) && !heatOf(c, n.id));
  if (c.roster.filter(n => n.tier === 2).length > 22 && spare[0]) c.roster = c.roster.filter(n => n.id !== spare[0].id);
}

/** every week: life outside the cage, and fight-week beats */
function storyWeek(c: Career, r: () => number) {
  if ((c.coachWeeks ?? 0) > 0) c.coachWeeks! -= 1;
  const camp = c.camp;
  if (camp) {
    const n = npc(c, camp.opponentId)!;
    // opponent pulls out: a replacement steps in on short notice
    if (!camp.title && camp.weeksLeft >= 2 && camp.weeksLeft <= 5 && n.id !== c.partnerId && n.id !== c.nemesis && r() < .05) {
      const pool = c.roster.filter(x => x.tier === camp.tier && x.id !== n.id && x.id !== c.champion);
      const sub = pick(r, pool);
      if (sub) {
        const tougher = overall(sub.stats) - overall(n.stats);
        camp.opponentId = sub.id; camp.tag = 'short'; camp.purse = Math.round(camp.purse * 1.25 / 50) * 50; camp.note = 'Short-notice replacement';
        c.log.unshift({week: c.week, text: `${n.name} is out with an injury. ${sub.name} "${sub.nickname}" (OVR ${overall(sub.stats)}) steps in on short notice at ${camp.event}.${camp.scouted ? ' Your film study was on the wrong man.' : ''}`, tone: 'bad'});
        camp.scouted = false;
        if (tougher > 5 && !c.choice) c.choice = {kind: 'event', id: 'replacement', from: c.cast?.manager.short ?? 'Your manager', week: c.week, title: 'A tougher replacement', text: `"${sub.name} is ${tougher} points better than the guy we trained for. The promotion bumped the purse 25%. You can still pull out with no penalty from them."`, options: [
          {id: 'take', label: 'Take the fight', hint: 'Bigger purse, bigger risk. The fans love it.'}, {id: 'pull', label: 'Pull out', hint: 'No fight, no purse. A small hit to your hype.'}]};
      }
    }
    // camp life: decisions still land on your phone in the early weeks
    if (!c.choice && camp.weeksLeft >= 2 && r() < .16) { const ch = lifeEvent(c, r); if (ch) c.choice = ch; }
    // the week before: the media (a basement fight gets a local radio slot, a title fight gets the world's press)
    if (camp.weeksLeft === 1 && !camp.pressDone && !c.choice) {
      const big = camp.title || camp.tag === 'grudge' || heatOf(c, camp.opponentId) >= 60;
      if (big || r() < .35) c.choice = pressChoice(c, npc(c, camp.opponentId)!, camp);
      else { camp.pressDone = true; c.log.unshift({week: c.week, text: pick(r, ['A quiet fight week. A few phone interviews, nothing more.', 'Open workouts in a shopping centre. Twelve people watch. One of them is your mum.', 'The media day is short and polite. Nobody says anything stupid.'])}); }
    }
    // fight week: the weight cut (how it goes depends on fitness, and money can make it easy)
    if (camp.weeksLeft === 0 && !camp.cutDone) {
      if (c.choice?.kind === 'press') resolvePress(c, r, 'respect');
      camp.cutDone = true;
      const over = Math.max(0, Math.round(4.6 - (c.fitness ?? 55) / 20 + r() * 2.2 - (has(c, 'cutman') ? .5 : 0)));
      if (over < 3) c.log.unshift({week: c.week, text: over <= 1 ? pick(r, ['The weight comes off easy this time. You eat a proper breakfast on weigh-in day.', 'A clean cut. You walk onto the scale feeling strong.', 'Good camp, easy cut. The nutrition plan worked.']) : pick(r, ['A couple of pounds in the sauna and you\'re on weight.', 'A long night in a hot bath, but you make it with room to spare.'])});
      if (over >= 3 && !c.choice) {
        c.choice = {kind: 'event', id: 'cut', from: c.cast?.coach.short ?? 'Coach', week: c.week, title: `Fight week: ${over} lb over`, text: `It's the night before weigh-ins and you're ${over} pounds over the ${c.division.toLowerCase()} limit. ${(c.fitness ?? 55) < 45 ? '"Your conditioning in camp wasn\'t where it needed to be, and now we pay for it."' : '"We\'ve done harder than this. What do you want to do?"'}`,
          options: [
            {id: 'sauna', label: 'Sauna all night', hint: 'Usually works. Leaves you drained (fitness down).'},
            {id: 'nutri', label: `Hire a cut specialist ($${[300, 1500, 6000][c.tier].toLocaleString()})`, hint: 'Makes weight clean and recovers well.'},
            {id: 'fine', label: 'Miss weight, pay the fine', hint: 'Lose 20% of your purse. You fight fresh, but the crowd boos.'},
          ]};
      } else weighIn(c, r);   // the scale only happens once the cut is settled
    }
    return;
  }
  if (c.injuryWeeks > 0) return;
  // life between fights: messages land when something is actually happening in your story
  if (!c.choice && r() < .24) { const ch = lifeEvent(c, r); if (ch) { c.choice = ch; return; } }
  if (r() > .08) return;
  const e = r();
  if (e < .3 && c.hype >= 20) { const cash = [300, 1800, 7000][c.tier]; c.money += cash; c.log.unshift({week: c.week, text: `${pick(r, ['Ironclad Nutrition', 'Riptide Energy', 'Apex Gloves', 'Halo Apparel'])} signs ${c.name} to a sponsorship deal (+$${cash.toLocaleString()}).`, tone: 'good'}); }
  else if (e < .55) { c.hype = clamp(c.hype + 5, 0, 100); c.log.unshift({week: c.week, text: pick(r, ['A training clip of yours goes viral overnight (+5 hype).', 'You go viral for a fan meet-and-greet (+5 hype).', 'A big podcast clips your best moments (+5 hype).']), tone: 'good'}); }
  else if (e < .75) { c.coachWeeks = 6; c.log.unshift({week: c.week, text: `${pick(r, ['A former champion', 'An Olympic wrestling coach', 'A Muay Thai legend'])} joins your camp. Training gains are up for 6 weeks.`, tone: 'good'}); }
  else if (e < .88 && !c.offers.some(o => o.tag === 'short')) {
    const pool = c.roster.filter(x => x.tier === c.tier && x.id !== c.champion);
    const n = pick(r, pool);
    if (n) { c.offers = [...c.offers, offer(c, r, n.id, false, c.tier, 'short')]; c.log.unshift({week: c.week, text: `Short-notice call: a fighter pulled out of a card. ${n.name} needs an opponent in 2-3 weeks. Big money.`, tone: 'big'}); }
  } else { c.hype = clamp(c.hype - 3, 0, 100); c.log.unshift({week: c.week, text: 'An old interview resurfaces and goes badly (-3 hype).', tone: 'bad'}); }
}

/** the scale: reported only after any weight-cut decision has been made */
function weighIn(c: Career, r: () => number) {
  const camp = c.camp; if (!camp) return;
  const n = npc(c, camp.opponentId)!;
  if (camp.missedWeight) { c.log.unshift({week: c.week, text: `Weigh-ins: ${n.name} makes weight and stares you down while the crowd jeers.`, tone: 'bad'}); return; }
  if (r() < .1) { const fine = Math.round(camp.purse * .2 / 50) * 50; c.money += fine; c.log.unshift({week: c.week, text: `Weigh-ins: you make weight. ${n.name} misses by 1.5 lb and forfeits 20% of his purse to you (+$${fine.toLocaleString()}).`, tone: 'good'}); }
  else c.log.unshift({week: c.week, text: `Weigh-ins: both fighters make weight. The face-off ${heatOf(c, n.id) >= 40 ? 'has to be separated by security' : 'is intense'}.`});
}

function pressChoice(c: Career, n: NPC, camp: Camp): Choice {
  const last = c.history.find(h => h.opponentId === n.id);
  const why = n.id === c.partnerId ? `${n.name} used to hold pads for you. He won't look at you.` : last ? (last.note ? `Last time ${last.note}. ${n.name} hasn't forgotten.` : last.result === 'L' ? `${n.name} beat you last time, and he's smiling about it.` : last.result === 'W' ? `${n.name} lost to you last time and he hasn't forgotten.` : `Your last fight with ${n.name} settled nothing.`) : heatOf(c, n.id) >= 40 ? `${n.name} is right there, and there is real bad blood.` : `${n.name} is across from you.`;
  const title = camp.title ? `${camp.event}: world press` : c.tier === 0 ? 'Local radio, fight week' : `${camp.event} media day`;
  const room = camp.title ? 'Every camera in the sport is on you.' : pick(rng(c.seed + c.week * 37), c.tier === 0 ? ['It\'s a tiny studio and the host keeps getting your name wrong.', 'The local paper sent a work-experience kid with a phone.', 'A community radio show. The host asks more about your mum than the fight.', 'A podcast recorded in someone\'s garage. The mic keeps cutting out.'] : ['The cameras are on you.', 'A packed press room, and the questions are all about him.', 'The host asks the question everyone is thinking: are you ready for this one?', 'A sit-down interview, both of you in the same room, nobody blinking.']);
  return {kind: 'press', title, text: `${why} ${room}`, week: c.week, options: [
    {id: 'trash', label: 'Trash talk', hint: '+8 hype, but he comes in fired up'},
    {id: 'respect', label: 'Stay respectful', hint: '+3 hype, he relaxes a little'},
    {id: 'mind', label: 'Mind games', hint: 'Coin flip: rattle him, or it backfires'},
  ]};
}

function resolvePress(c: Career, r: () => number, choice: 'trash' | 'respect' | 'mind') {
  const camp = c.camp; if (!camp) { c.choice = null; return; }
  const n = npc(c, camp.opponentId)!;
  camp.pressDone = true; c.choice = null;
  if (choice === 'trash') {
    c.hype = clamp(c.hype + 8, 0, 100); camp.edge = (camp.edge ?? 0) + .05; addHeat(c, n.id, 15, 'trash talk before the fight');
    c.log.unshift({week: c.week, text: `${c.name} goes off on ${n.name}. The clip is everywhere (+8 hype). He looks furious.`, tone: 'big'});
  } else if (choice === 'respect') {
    c.hype = clamp(c.hype + 3, 0, 100); camp.edge = (camp.edge ?? 0) - .02;
    c.log.unshift({week: c.week, text: `${c.name} keeps it classy with ${n.name}. Respect from the fans (+3 hype).`});
  } else if (r() < .5) {
    c.hype = clamp(c.hype + 6, 0, 100); camp.edge = (camp.edge ?? 0) - .05;
    c.log.unshift({week: c.week, text: `Your mind games get under ${n.name}'s skin. He looks rattled (+6 hype).`, tone: 'good'});
  } else {
    c.hype = clamp(c.hype - 3, 0, 100); camp.edge = (camp.edge ?? 0) + .03;
    c.log.unshift({week: c.week, text: `The mind games backfire. ${n.name} laughs it off and the room is with him (-3 hype).`, tone: 'bad'});
  }
}
/** the player's answer to a story choice (press, a life event, the weight cut, the mic); the conversation stays on the phone */
export function resolveChoice(prev: Career, option: string): Career {
  const c: Career = migrate(structuredClone(prev));
  const r = rng(c.seed + c.week * 613 + option.length * 31);
  const ch = c.choice; if (!ch) return c;
  const label = ch.options.find(o => o.id === option)?.label;
  if (ch.kind === 'press') resolvePress(c, r, option as 'trash' | 'respect' | 'mind');
  else resolveEvent(c, r, ch, option);
  addThread(c, {from: ch.kind === 'press' ? 'Fight week media' : ch.from ?? 'Message', title: ch.title, text: ch.text, answer: label, result: c.log[0]?.text});
  return c;
}
/** you let the week go by without answering */
function expireChoice(c: Career) {
  const ch = c.choice!; c.choice = null;
  if (ch.id === 'mic') { c.log.unshift({week: c.week, text: 'You keep it short on the mic and head to the back.'}); return; }
  if (ch.id === 'crossroads' || ch.id === 'rock-bottom') { c.log.unshift({week: c.week, text: 'You don\'t answer. You just turn up at the gym the next morning.'}); return; }
  if (ch.id === 'superfight') return;   // the offer stays open on the Division tab
  const beat = BEATS.find(b => b.id === ch.id);
  if (beat && (CAST_KEYS as string[]).includes(beat.from)) bond(c, beat.from as CastKey, -4);
  addThread(c, {from: ch.from ?? 'Message', title: ch.title, text: ch.text, result: 'You never replied.'});
  c.log.unshift({week: c.week, text: `You never got back to ${ch.from ?? 'them'} about "${ch.title}".`, tone: 'bad'});
}

/* ================================================================ life events */
function lifeEvent(c: Career, r: () => number): Choice | null {
  const b = nextBeat(c, r); if (!b) return null;
  const built = b.build(c, r);
  c.storySeen![b.id] = c.week; c.arcWeek![b.arc] = c.week;
  return {kind: 'event', id: b.id, from: fromName(c, b.from), title: built.title, text: built.text, target: built.target, week: c.week, options: built.options.map(o => ({id: o.id, label: o.label, hint: o.hint}))};
}

function applyEff(c: Career, r: () => number, e: Eff, target?: string) {
  if (e.hype) c.hype = clamp(c.hype + e.hype, 0, 100);
  if (e.money) c.money += Math.round(e.money);
  if (e.energy) c.energy = Math.max(0, Math.min(100, c.energy + e.energy));
  if (e.health) c.health = Math.max(5, Math.min(100, c.health + e.health));
  if (e.fitness) c.fitness = Math.max(0, Math.min(100, (c.fitness ?? 55) + e.fitness));
  if (e.followers) c.followers = Math.max(0, (c.followers ?? 0) + e.followers * (1 + c.tier));
  if (e.stat) for (const [k, v] of e.stat) gain(c, k, v);
  if (e.coach) c.coachWeeks = Math.max(c.coachWeeks ?? 0, e.coach);
  if (e.bond) for (const [k, v] of Object.entries(e.bond)) bond(c, k as CastKey, v ?? 0);
  if (e.flag && !c.flags!.includes(e.flag)) c.flags!.push(e.flag);
  if (e.pay) c.payBump = Math.min(1.4, (c.payBump ?? 1) * e.pay);
  if (e.freeze) c.nextOfferWeek = c.week + e.freeze;
  if (e.heat && target && npc(c, target)) addHeat(c, target, e.heat, 'a war of words online');
  if (e.partnerFight) signPartner(c, r);
  if (e.brokenHand && c.camp) c.camp.story = brokenHandFight(c);
  if (e.pullOut) { c.camp = null; c.offers = []; c.nextOfferWeek = c.week + 2; }
  if (e.injury) { c.injuryWeeks = Math.max(c.injuryWeeks, e.injury); if (c.camp && c.camp.weeksLeft <= e.injury) { c.log.unshift({week: c.week, text: 'The injury costs you the fight. The bout is off.', tone: 'bad'}); c.camp = null; } }
  c.log.unshift({week: c.week, text: e.text, tone: e.tone});
  if (e.post) post(c, e.post[0], e.post[1], e.post[2]);
}
/** your old training partner becomes a real fighter in your league, about as good as you are */
function signPartner(c: Career, r: () => number) {
  const p = makeNPC(r, c.tier, 15); const who = c.cast!.partner;
  p.id = `partner-${c.seed}`; p.name = who.name; p.nickname = 'The Sparring Partner'; p.country = c.country; p.age = c.age + 1; p.record = [Math.max(4, c.record[0] - 1), Math.max(1, c.record[1])];
  for (const k of STAT_KEYS) p.stats[k] = clamp(c.stats[k] + (r() - .5) * 6, 15, 97);
  c.roster = c.roster.filter(n => n.id !== p.id); c.roster.push(p); c.partnerId = p.id;
  setHeat(c, p.id, 70, 'your old training partner');
  if (!c.camp) c.offers = [offer(c, r, p.id, false, c.tier, 'grudge'), ...c.offers.filter(o => o.opponentId !== p.id)];
}

function resolveEvent(c: Career, r: () => number, ch: Choice, option: string) {
  c.choice = null;
  if (ch.id === 'replacement') {
    if (option === 'pull') { c.camp = null; c.hype = clamp(c.hype - 3, 0, 100); c.nextOfferWeek = c.week + 1; c.log.unshift({week: c.week, text: 'You pull out. The promotion understands. Your manager is already looking for the next one.'}); }
    else { c.hype = clamp(c.hype + 4, 0, 100); c.log.unshift({week: c.week, text: 'You take the fight. The promotion owes you one.', tone: 'good'}); }
    return;
  }
  if (ch.id === 'cut') {
    const camp = c.camp; if (!camp) return;
    const n = npc(c, camp.opponentId)!;
    if (option === 'nutri') { c.money -= [300, 1500, 6000][c.tier]; c.log.unshift({week: c.week, text: `The cut specialist gets you on weight with an hour to spare. You rehydrate perfectly.`, tone: 'good'}); }
    else if (option === 'sauna') {
      if (r() < .82) { c.fitness = Math.max(0, (c.fitness ?? 55) - 12); c.log.unshift({week: c.week, text: 'Four hours in the sauna. You make weight on the last try, but you feel flat.'}); }
      else { camp.missedWeight = true; c.fitness = Math.max(0, (c.fitness ?? 55) - 8); c.hype = clamp(c.hype - 6, 0, 100); c.log.unshift({week: c.week, text: `You come in a pound and a half heavy anyway. 20% of your purse goes to ${n.name}, and you're drained.`, tone: 'bad'}); }
    } else { camp.missedWeight = true; c.fitness = Math.min(100, (c.fitness ?? 55) + 5); c.hype = clamp(c.hype - 8, 0, 100); c.log.unshift({week: c.week, text: `You miss weight on purpose. The crowd boos at the weigh-ins and 20% of your purse goes to ${n.name}.`, tone: 'bad'}); post(c, '@CageSideNews', `${c.name} misses weight. Unprofessional.`, 3000); }
    weighIn(c, r);
    return;
  }
  if (ch.id === 'mic') {
    const n = ch.target ? npc(c, ch.target) : undefined;
    const coach = c.cast!.coach.short, bro = c.cast!.brother.short;
    if (option === 'champ' && c.champion && c.champion !== 'you') { const champ = npc(c, c.champion)!; addHeat(c, champ.id, 30, 'called him out on the mic'); c.hype = clamp(c.hype + 7, 0, 100); c.log.unshift({week: c.week, text: `On the mic: "${champ.name.split(' ')[0]}, I'm coming for that belt." The arena erupts.`, tone: 'big'}); post(c, '@MMAWire', `${c.name} calls out champion ${champ.name} after his win!`, 6000); }
    else if (option === 'rival' && n) { addHeat(c, n.id, 30, 'called out after your win'); c.hype = clamp(c.hype + 5, 0, 100); c.log.unshift({week: c.week, text: `On the mic: "${n.name}, you've been talking. Sign the contract."`, tone: 'big'}); post(c, '@' + handleOf(n.name), `Say less. 🖊️`, 4000); }
    else if (option === 'money') { c.payBump = Math.min(1.4, (c.payBump ?? 1) * 1.05); c.log.unshift({week: c.week, text: 'On the mic: "Pay me!" The crowd loves it. So does your manager. Purses up a little.', tone: 'good'}); }
    else if (option === 'coach') { bond(c, 'coach', 10); c.hype = clamp(c.hype + 3, 0, 100); c.log.unshift({week: c.week, text: `You put the belt around ${coach}'s neck in front of the whole arena.`, tone: 'big'}); }
    else if (option === 'family') { bond(c, 'brother', 10); c.hype = clamp(c.hype + 3, 0, 100); c.log.unshift({week: c.week, text: `You look straight down the camera: "${bro}, Mum, this is yours."`, tone: 'big'}); }
    else if (option === 'anyone') { c.hype = clamp(c.hype + 8, 0, 100); c.log.unshift({week: c.week, text: 'On the mic: "Anybody. Line them up." The arena loses its mind.', tone: 'big'}); }
    else { c.hype = clamp(c.hype + 2, 0, 100); c.log.unshift({week: c.week, text: `On the mic you thank ${coach}, your family and the fans. Classy.`}); }
    return;
  }
  if (ch.id === 'crossroads' || ch.id === 'rock-bottom') {
    if (option === 'stop') forceRetire(c, 'choice');
    else { bond(c, 'coach', 3); c.log.unshift({week: c.week, text: `"Then we go again," says ${c.cast!.coach.short}.`}); }
    return;
  }
  if (ch.id === 'superfight') { if (option !== 'wait') doMove(c, r, option as Division); else c.log.unshift({week: c.week, text: 'You tell the promotion to ask again later. The offer stands.'}); return; }
  if (ch.id === 'belts') {
    const sf = c.superfight; if (!sf) return;
    if (option === 'both') {
      c.dual = {belts: [sf.from, c.division], due: {[sf.from]: c.week + DUAL_CLOCK, [c.division]: c.week + DUAL_CLOCK}};
      c.superfight = null; if (!has(c, 'held-both')) c.flags!.push('held-both');
      addScene(c, bothBeltsScene(c, sf.from, c.division, DUAL_CLOCK)); milestone(c, `Refuses to give up a belt: defends ${sf.from} and ${c.division} at the same time.`);
      c.log.unshift({week: c.week, text: `${c.name} will defend both the ${sf.from} and ${c.division} titles.`, tone: 'big'});
      c.offers = []; c.nextOfferWeek = c.week; withOffers(c, r);
      return;
    }
    if (option === 'new') {
      const old = c.worlds![sf.from]; if (old) { const top = old.rankings.shift() ?? null; old.champion = top; if (top) old.lineage.unshift({week: c.week, name: old.roster.find(n => n.id === top)?.name ?? 'A new champion', how: `won the belt ${c.name} vacated`}); }
      c.superfight = null; c.log.unshift({week: c.week, text: `${c.name} vacates the ${sf.from} title and stays at ${c.division}.`, tone: 'big'});
    } else {
      const here = c.division, top = c.rankings.find(id => id !== 'you') ?? null;
      c.champion = top; c.rankings = c.rankings.filter(id => id !== 'you' && id !== top); c.champ = false;
      if (top) c.lineage!.unshift({week: c.week, name: npc(c, top)?.name ?? 'A new champion', how: `won the belt ${c.name} vacated`});
      returnHome(c); c.offers = []; withOffers(c, r);
      c.log.unshift({week: c.week, text: `${c.name} vacates the ${here} title and goes home to ${c.division}.`, tone: 'big'});
    }
    return;
  }
  const ev = BEATS.find(e => e.id === ch.id); if (!ev) return;
  const opt = ev.build(c, r, ch.target).options.find(o => o.id === option);
  if (!opt) return;
  applyEff(c, r, 'eff' in opt ? opt.eff : r() < opt.roll ? opt.win : opt.lose, ch.target);
  if (ch.id === 'home-card' && option === 'yes') c.homecoming = true;
  if (ch.id === 'fame-nick' && option === 'yes' && ch.target) c.nickname = ch.target;
}

/** after a win: the cage interview, written for what just happened */
function micChoice(c: Career, opp: NPC, wasChamp: boolean, title: boolean): Choice {
  const base = {kind: 'event' as const, id: 'mic', from: 'Cage interview', week: c.week};
  if (title && !wasChamp) return {...base, title: 'The belt is around your waist', text: `The interviewer has to shout over the crowd: "Champion! You just beat ${opp.name}. Who is this for?"`, options: [
    {id: 'coach', label: `This is for ${c.cast!.coach.short}`, hint: 'Your coach will never forget it.'}, {id: 'family', label: `This is for ${c.cast!.brother.short} and Mum`, hint: 'Family first.'}, {id: 'anyone', label: '"Line them all up"', hint: 'Big hype.'}]};
  if (title) return {...base, title: 'Still the champion', text: `"That's defense number ${c.defenses}. ${opp.name} couldn't take it from you. Who can?"`, options: [
    {id: 'anyone', label: '"Nobody. Line them up."', hint: 'Big hype.'}, {id: 'money', label: '"Pay me!"', hint: 'Purses up a little.'}, {id: 'thanks', label: 'Thank the team', hint: 'Small hype bump.'}]};
  const rival = (c.rivals ?? []).map(x => npc(c, x.id)).find(n => n && n.id !== opp.id && n.tier === c.tier);
  const opts: Choice['options'] = [];
  const champ = c.tier === 2 && !c.champ && c.champion && c.champion !== 'you' ? npc(c, c.champion) : undefined;
  if (champ) opts.push({id: 'champ', label: `Call out champion ${champ.name}`, hint: 'Big hype, makes an enemy of the champion.'});
  if (rival) opts.push({id: 'rival', label: `Call out ${rival.name}`, hint: 'Sets up a grudge match.'});
  opts.push({id: 'money', label: '"Pay me!"', hint: 'Purses up a little.'}, {id: 'thanks', label: 'Thank the team', hint: 'Small hype bump.'});
  return {...base, title: 'The mic is yours', text: `You just beat ${opp.name}. The interviewer puts the microphone in your face: "What's next?"`, options: opts.slice(0, 3), target: rival?.id};
}

/** everything the fight changes in your life: scenes, rivals, your contract, your health */
function afterFight(c: Career, r: () => number, camp: Camp, opp: NPC, out: FightOutcome, before: {wasChamp: boolean; tier: number; fights: number; wins: number; losses: number; settled: boolean}) {
  const won = out.winner === 'you', lost = out.winner === 'opp';
  const knockedOut = lost && out.method === 'KO/TKO';
  if (knockedOut) { c.noSparUntil = c.week + 6; c.koLosses = (c.koLosses ?? 0) + 1; c.stats.chin = clamp(Math.round((c.stats.chin - .8) * 10) / 10); }   // chins do not grow back
  if (lost && !c.nemesis) c.nemesis = opp.id;
  const settled = before.settled || (won && c.nemesis === opp.id);
  if (won && c.nemesis === opp.id) c.nemesis = null;
  const x: FightStory = {opp: opp.name, method: out.method, how: out.how, round: out.round, event: camp.event ?? TIERS[camp.tier].name, won, lost, title: camp.title, wasChamp: before.wasChamp, nowChamp: c.champ, firstFight: before.fights === 0, firstWin: won && before.wins === 0, firstLoss: lost && before.losses === 0, firstKOLoss: knockedOut && c.koLosses === 1, streak: c.streak ?? 0, settled, vsPartner: opp.id === c.partnerId, defenses: c.defenses, tale: out.tale};
  c.history[0].note = taleNote(x);
  const buzz = talePost(c.name, x); if (buzz) post(c, '@CageSideNews', buzz, 3000 + c.hype * 80);
  let scene = fightScene(c, x);
  const told = taleLine(x); if (scene && told && !camp.title) scene.lines.splice(Math.max(1, scene.lines.length - 1), 0, {who: c.cast!.coach.short, text: told});
  // the story's goal for this fight
  const goal = camp.story;
  if (goal) {
    const hit = goalMet(goal.goal, won, out.method, out.tale), pay = Math.round(goal.bonus);
    if (hit) { c.money += pay; c.hype = clamp(c.hype + 5, 0, 100); bond(c, 'coach', 4); c.log.unshift({week: c.week, text: `${goal.title}: goal complete. ${goal.goal.label}. +$${pay.toLocaleString()}.`, tone: 'big'}); }
    else c.log.unshift({week: c.week, text: `${goal.title}: you missed the goal (${goal.goal.label.toLowerCase()}).`, tone: 'bad'});
    addThread(c, {from: c.cast!.coach.short, title: goal.title, text: goal.goal.label, result: hit ? `Done. Bonus: $${pay.toLocaleString()}.` : 'Not this time.'});
  }
  // two belts: a defense resets that belt's clock, a loss leaves you with the other one
  if (c.dual && camp.title) {
    if (lost) { const gone = c.division, kept = c.dual.belts.find(b => b !== gone)!; c.dual = null; goToBelt(c, r, kept); scene = dualLostScene(c, gone, kept); milestone(c, `Loses the ${gone} title. Still ${kept} champion.`); }
    else c.dual.due[c.division] = c.week + DUAL_CLOCK;
  }
  // a superfight either makes history or sends you home with the belt you already had
  const sf = c.superfight;
  if (sf && camp.title) {
    if (won) {
      if (!c.divisionTitles!.includes(c.division)) c.divisionTitles!.push(c.division);
      scene = doubleScene(c, c.division); milestone(c, `Two-division champion: wins the ${c.division} title.`);
      c.choice = {kind: 'event', id: 'belts', from: c.cast!.manager.short, week: c.week, title: 'What happens to the belts?', text: `"Give one up and life stays sane. Or keep both, and they'll make you pay for it: short camps, no time off, and if either belt goes ${DUAL_CLOCK} weeks without a defense, they strip you."`, options: [
        {id: 'both', label: 'Defend both belts', hint: `Fight about every ${DUAL_CAMP} weeks. Miss a deadline and you lose that belt.`},
        {id: 'new', label: `Keep ${c.division} only`, hint: `Stay here. The ${sf.from} title is vacated.`}, {id: 'home', label: `Go home to ${sf.from}`, hint: `Keep your first belt. The ${c.division} title is vacated.`}]};
    } else { const home = sf.from; returnHome(c); scene = superLossScene(c, home); }
  } else if (won && camp.title && !before.wasChamp && !c.divisionTitles!.includes(c.division)) c.divisionTitles!.push(c.division);
  addScene(c, scene);
  // your contract: keep losing and the promotion lets you go
  const limit = c.tier === 1 ? 3 : c.divisionTitles!.length ? 5 : 4;
  if (lost && !c.champ && c.tier > 0 && camp.tier === c.tier) {
    if ((c.streak ?? 0) <= -limit) {
      const league = TIERS[c.tier].name, down = TIERS[c.tier - 1].name;
      c.rankings = c.rankings.filter(id => id !== 'you'); c.rank = null; c.tier -= 1; c.tierWins = 0; c.streak = 0; c.payBump = Math.max(1, (c.payBump ?? 1) * .85); c.hype = clamp(c.hype - 10, 0, 100);
      addScene(c, cutScene(c, league, down)); milestone(c, `Released by the ${league}.`); c.log.unshift({week: c.week, text: `${c.name} has been released by the ${league}.`, tone: 'bad'});
    } else if ((c.streak ?? 0) === -(limit - 1)) addScene(c, warningScene(c));
  }
  if (c.tier > before.tier) { addScene(c, promotedScene(c, TIERS[c.tier].name, c.tier, (c.peakTier ?? 0) >= c.tier)); c.nemesisDue = c.week + 12 + Math.floor(r() * 24); }
  // the contract: a few fights, clear targets, and your pay rides on them
  const deal = c.contract!;
  if (deal.tier !== c.tier) c.contract = newContract(c);
  else {
    deal.left -= 1; if (won) deal.wins += 1; if (won && (out.method === 'KO/TKO' || out.method === 'SUB')) deal.finishes += 1;
    if (deal.left <= 0) {
      const w = deal.wins >= deal.needWins, f = deal.finishes >= deal.needFinishes, cash = contractBonus(c.tier);
      if (w && f) { c.money += cash; c.payBump = Math.min(1.4, (c.payBump ?? 1) * 1.1); bond(c, 'manager', 5); addScene(c, contractScene(c, 'won', cash)); c.log.unshift({week: c.week, text: `Contract targets hit: +$${cash.toLocaleString()} and a 10% raise.`, tone: 'big'}); }
      else if (!w && !f) { c.payBump = Math.max(.7, (c.payBump ?? 1) * .9); addScene(c, contractScene(c, 'lost', 0)); c.log.unshift({week: c.week, text: 'Contract targets missed: purses cut by 10%.', tone: 'bad'}); }
      else addScene(c, contractScene(c, 'even', 0));
      c.contract = newContract(c);
    }
  }
  c.peakTier = Math.max(c.peakTier ?? 0, c.tier);
  // every fight gets a word from your corner, even the ones nobody will remember
  if (!scene) addThread(c, {from: c.cast!.coach.short, text: lockerNote(c, x)});
  // the mic, or for the very best, the offer almost nobody ever gets
  if (won && !c.choice) {
    if (c.champ && legendReady(c) && !has(c, 'legend-called') && !c.superfight && !c.dual) {
      c.flags!.push('legend-called'); addScene(c, legendScene(c)); milestone(c, 'Offered a shot at a second weight class.');
      const {up, down} = adjacentDivisions(c);
      c.choice = {kind: 'event', id: 'superfight', from: c.cast!.manager.short, week: c.week, title: 'A second belt', text: `"You've cleared out ${c.division}. Pick a direction and they'll put you straight in with that division's champion."`, options: [
        ...(up ? [{id: up, label: `Move up to ${up}`, hint: 'More power and chin. Slower, less cardio.'}] : []), ...(down ? [{id: down, label: `Drop to ${down}`, hint: 'Much faster. Weaker chin and a brutal cut.'}] : []), {id: 'wait', label: 'Not yet', hint: 'The offer stays open on your Division tab.'}]};
    } else if (camp.title || heatOf(c, opp.id) >= 40 || ((out.method === 'KO/TKO' || out.method === 'SUB') && r() < .55) || r() < .2) c.choice = micChoice(c, opp, before.wasChamp, camp.title);
    else { c.hype = clamp(c.hype + 2, 0, 100); c.log.unshift({week: c.week, text: pick(r, ['A short post-fight interview: you thank your team and head to the back.', 'No mic tonight. You raise a fist to the crowd and walk off.', 'You keep the interview short. The win says enough.'])}); }
  }
  // the things that end careers
  if ((c.koLosses ?? 0) >= KO_LIMIT) { forceRetire(c, 'medical'); return; }
  if (lost && c.tier === 0 && (c.streak ?? 0) <= -5 && !c.choice) c.choice = {kind: 'event', id: 'rock-bottom', from: c.cast!.coach.short, week: c.week, title: 'Be honest with me', text: `"That's ${Math.abs(c.streak ?? 0)} in a row. I'll be in your corner as long as you want me there. But do you still want this?"`, options: [{id: 'go', label: 'I still want it', hint: 'Keep fighting.'}, {id: 'stop', label: 'I think I\'m done', hint: 'Your career ends here.'}]};
}

/* ============================================================== legends only */
// Changing weight class is the rarest thing in the game: only a dominant, long-reigning, near-perfect champion is ever asked.
export const LEGEND = {defenses: 8, streak: 15, overall: 84, maxLosses: 6, dropAge: 33} as const;
export function legendChecks(c: Career) {
  return [
    {label: 'Reigning champion', have: c.champ ? 1 : 0, need: 1, done: c.champ},
    {label: 'Title defenses in a row', have: c.defenses, need: LEGEND.defenses, done: c.defenses >= LEGEND.defenses},
    {label: 'Fight win streak', have: Math.max(0, c.streak ?? 0), need: LEGEND.streak, done: (c.streak ?? 0) >= LEGEND.streak},
    {label: 'Overall rating', have: overall(c.stats), need: LEGEND.overall, done: overall(c.stats) >= LEGEND.overall},
    {label: 'Career losses (6 at most)', have: c.record[1], need: LEGEND.maxLosses, done: c.record[1] <= LEGEND.maxLosses, most: true},
  ];
}
export const legendReady = (c: Career) => legendChecks(c).every(x => x.done);
export function adjacentDivisions(c: Career): {up?: Division; down?: Division} {
  const i = DIVISIONS.indexOf(c.division);
  return {up: DIVISIONS[i + 1], down: c.age <= LEGEND.dropAge ? DIVISIONS[i - 1] : undefined};
}
function stashWorld(c: Career) {
  c.worlds![c.division] = {roster: c.roster.filter(n => n.tier === 2), rankings: c.rankings.filter(id => id !== 'you'), champion: c.champion, lineage: c.lineage ?? [], defenses: c.defenses};
  c.roster = c.roster.filter(n => n.tier !== 2);
}
function openWorld(c: Career, r: () => number, division: Division) {
  let w = c.worlds![division];
  if (!w) {
    const roster: NPC[] = []; for (let i = 0; i < 16; i++) roster.push(makeNPC(r, 2, i));
    roster.sort((a, b) => overall(b.stats) - overall(a.stats));
    for (const k of STAT_KEYS) roster[0].stats[k] = clamp(roster[0].stats[k] + 4, 15, 97);   // the man at the top of another division is a real problem
    w = {roster, rankings: roster.slice(1).map(n => n.id), champion: roster[0].id, lineage: [{week: c.week, name: roster[0].name, how: 'reigning champion'}], defenses: 0};
  }
  delete c.worlds![division];
  c.roster.push(...w.roster); c.rankings = [...w.rankings]; c.champion = w.champion; c.lineage = w.lineage; c.defenses = w.defenses; c.division = division;
}
function superOffer(c: Career, r: () => number): Offer {
  const o = offer(c, r, c.champion!, true); o.note = 'Superfight'; o.purse *= 2; o.winBonus *= 2; o.weeksOut = 12; return o;
}
function doMove(c: Career, r: () => number, target: Division) {
  const from = c.division, up = DIVISIONS.indexOf(target) > DIVISIONS.indexOf(from);
  stashWorld(c); openWorld(c, r, target);
  c.superfight = {from}; c.champ = false; c.defenses = 0; c.rankings = ['you', ...c.rankings].slice(0, 15); syncRank(c);
  c.nextOfferWeek = c.week; c.offers = [superOffer(c, r)];
  addScene(c, superfightScene({...c, division: from}, target, up));
  milestone(c, `${up ? 'Moves up' : 'Drops down'} to ${target} to chase a second belt.`);
  c.log.unshift({week: c.week, text: `${c.name} ${up ? 'moves up' : 'drops down'} to ${target}. The ${from} belt waits at home.`, tone: 'big'});
}
/** go back to the division where the belt is waiting */
function returnHome(c: Career) {
  const sf = c.superfight; if (!sf) return;
  const r = rng(c.seed + c.week);
  stashWorld(c); openWorld(c, r, sf.from);
  c.superfight = null; c.champ = true; c.champion = 'you'; c.rankings = c.rankings.filter(id => id !== 'you'); syncRank(c);
}
/* ------------------------------------------------- holding two belts at once */
const DUAL_CLOCK = 14, DUAL_CAMP = 6;
export const DUAL_RULES = {clock: DUAL_CLOCK, camp: DUAL_CAMP} as const;
/** walk into the other division as its champion */
function goToBelt(c: Career, r: () => number, belt: Division) {
  if (c.division !== belt) { stashWorld(c); openWorld(c, r, belt); }
  c.champ = true; c.champion = 'you'; c.rankings = c.rankings.filter(id => id !== 'you'); c.offers = []; syncRank(c);
}
/** line up the belt that needs defending soonest */
function focusBelt(c: Career, r: () => number) {
  const d = c.dual!, next = [...d.belts].sort((a, b) => (d.due[a] ?? 0) - (d.due[b] ?? 0))[0];
  if (next !== c.division) goToBelt(c, r, next);
}
/** give a belt up: the top contender in that division becomes champion */
function vacateBelt(c: Career, r: () => number, belt: Division) {
  const kept = c.dual!.belts.find(b => b !== belt)!; c.dual = null;
  if (c.division === belt) {
    const top = c.rankings.find(id => id !== 'you') ?? null;
    c.champion = top; c.rankings = c.rankings.filter(id => id !== 'you' && id !== top); c.champ = false;
    if (top) c.lineage!.unshift({week: c.week, name: npc(c, top)?.name ?? 'A new champion', how: `won the belt ${c.name} gave up`});
    goToBelt(c, r, kept);
  } else {
    const w = c.worlds![belt];
    if (w) { const top = w.rankings.shift() ?? null; w.champion = top; if (top) w.lineage.unshift({week: c.week, name: w.roster.find(n => n.id === top)?.name ?? 'A new champion', how: `won the belt ${c.name} gave up`}); }
  }
  c.offers = [];
}
/** every week: the clocks on both belts */
function checkBelts(c: Career, r: () => number) {
  const d = c.dual!;
  if (!c.camp) c.offers = [];                           // offers always follow the belt that is due next
  for (const b of d.belts) {
    if (c.camp?.title && c.division === b) continue;    // a signed defense stops this belt's clock
    const left = (d.due[b] ?? 0) - c.week;
    if (left < 0) {
      const kept = d.belts.find(x => x !== b)!; vacateBelt(c, r, b);
      addScene(c, strippedScene(c, b, kept)); milestone(c, `Stripped of the ${b} title after missing the deadline.`);
      c.log.unshift({week: c.week, text: `${c.name} is stripped of the ${b} title for failing to defend it in time.`, tone: 'bad'});
      return;
    }
    if (left === 4) c.log.unshift({week: c.week, text: `Four weeks left to sign a ${b} title defense, or they strip you.`, tone: 'bad'});
  }
}
/** how long each belt has left, for the hub */
export function beltClocks(c: Career) {
  const d = c.dual; if (!d) return [];
  return d.belts.map(division => ({division, weeks: Math.max(0, (d.due[division] ?? 0) - c.week), booked: !!c.camp?.title && c.division === division}));
}
/** the double champion decides the schedule is too much */
export function relinquishBelt(prev: Career, belt: Division): Career {
  const c: Career = migrate(structuredClone(prev));
  if (!c.dual || c.camp || !c.dual.belts.includes(belt)) return c;
  vacateBelt(c, rng(c.seed + c.week * 19), belt);
  c.log.unshift({week: c.week, text: `${c.name} gives up the ${belt} title and focuses on ${c.division}.`, tone: 'big'});
  c.nextOfferWeek = c.week;
  return withOffers(c, rng(c.seed + c.week * 23));
}
/** the Division tab's button */
export function moveDivision(prev: Career, target: Division): Career {
  const c: Career = migrate(structuredClone(prev));
  const {up, down} = adjacentDivisions(c);
  if (!legendReady(c) || c.camp || c.injuryWeeks > 0 || c.superfight || c.dual || (target !== up && target !== down)) return c;
  if (!has(c, 'legend-called')) c.flags!.push('legend-called');
  if (c.choice?.id === 'superfight') c.choice = null;
  doMove(c, rng(c.seed + c.week * 17), target);
  return c;
}
