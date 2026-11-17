// VERSUS career mode: the rules. Pure functions over a plain save object so the
// game is easy to test and to store (localStorage now, an account later).

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
export type Camp = Omit<Offer, 'weeksOut'> & {weeksLeft: number; event?: string; billing?: string; edge?: number; pressDone?: boolean};
export type Rival = {id: string; heat: number; why: string};
export type Choice = {kind: 'press'; title: string; text: string; options: {id: 'trash' | 'respect' | 'mind'; label: string; hint: string}[]};
export type LogEntry = {week: number; text: string; tone?: 'good' | 'bad' | 'big'};
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
export function createCareer(input: {name: string; nickname: string; country: string; division: Division; style: Style; color: string}, seed = Date.now()): Career {
  const r = rng(seed);
  const roster: NPC[] = [];
  for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 16; i++) roster.push(makeNPC(r, tier, i));
  const major = roster.filter(n => n.tier === 2).sort((a, b) => overall(b.stats) - overall(a.stats));
  const c: Career = {
    version: 1, seed, ...input,
    stats: statsFor(r, 38, input.style), potential: 82 + Math.floor(r() * 14),
    record: [0, 0, 0], finishes: {ko: 0, sub: 0, dec: 0},
    week: 1, age: 21, energy: 100, health: 100, injuryWeeks: 0, hype: 5, money: 500,
    tier: 0, rank: null, champ: false, defenses: 0, tierWins: 0,
    roster, rankings: major.slice(1).map(n => n.id), champion: major[0].id,
    offers: [], camp: null, history: [], log: [], retired: false, nextOfferWeek: 1,
  };
  c.log.push({week: 1, text: `${input.name} signs with the ${TIERS[0].name}. Every legend starts in a basement.`, tone: 'big'});
  migrate(c);   // seeds the title lineage with the reigning champion
  return withOffers(c, r);
}

/* -------------------------------------------------------------- weekly */
export type Action = {type: 'train'; focus: StatKey} | {type: 'spar'} | {type: 'rest'} | {type: 'promote'};
export const ACTIONS = {
  train: {label: 'Train', energy: -18, blurb: 'Big gains in one stat. Tiring.'},
  spar: {label: 'Spar', energy: -12, blurb: 'Small gains in a few stats. Small knock risk.'},
  rest: {label: 'Rest', energy: +35, blurb: 'Recover energy and heal up.'},
  promote: {label: 'Promote', energy: -8, blurb: 'Interviews and socials. Hype = more offers, bigger names, reach fights.'},
} as const;

const growth = (age: number) => age < 26 ? 1.25 : age < 30 ? 1 : age < 33 ? .7 : .4;
function gain(c: Career, k: StatKey, amount: number) {
  const room = Math.max(0, c.potential - c.stats[k]) / c.potential;
  const coach = (c.coachWeeks ?? 0) > 0 ? 1.3 : 1;
  const g = Math.max(0, Math.round(amount * coach * growth(c.age) * (room > 0 ? .15 + room * 1.4 : .05) * 10) / 10);
  c.stats[k] = clamp(Math.round((c.stats[k] + g) * 10) / 10, 1, 99);
  return g;
}

export function takeAction(prev: Career, a: Action): Career {
  if (prev.retired) return prev;
  const c: Career = migrate(structuredClone(prev));
  const r = rng(c.seed + c.week * 7919);
  const tired = c.energy < 30;
  if (c.injuryWeeks > 0 && a.type !== 'rest' && a.type !== 'promote') {
    c.log.unshift({week: c.week, text: 'Still injured. The doctors say rest or promote only.', tone: 'bad'});
    return c;
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
    c.log.unshift({week: c.week, text: `Media day: +${h} hype, +$${cash.toLocaleString()}.`});
  }
  return advanceWeek(c, r);
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
  if (c.camp) c.camp.weeksLeft = Math.max(0, c.camp.weeksLeft - 1);
  c.offers = c.offers.map(o => ({...o, weeksOut: o.weeksOut})).filter(() => !c.camp);
  if (c.week % 52 === 0) ageUp(c, r);
  if (c.week % 4 === 0) worldTurns(c, r);
  storyWeek(c, r);
  return c.camp || c.offers.length ? c : withOffers(c, r);
}

function ageUp(c: Career, r: () => number) {
  c.age += 1;
  if (c.age >= 32) for (const k of ['speed', 'cardio', 'chin', 'power'] as StatKey[]) c.stats[k] = clamp(c.stats[k] - (1 + Math.floor(r() * (c.age - 30))));
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
  const base = [800, 6000, 40000][tier] * (1 + c.hype / 100) * (title ? 3 : 1) * bump;
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
  c.camp = {...rest, weeksLeft: weeksOut, event, billing, edge: 0};
  const n = npc(c, o.opponentId)!;
  c.log.unshift({week: c.week, text: `Signed: ${c.name} vs ${n.name}, ${billing.toLowerCase()} of ${event}${o.title ? ' for the belt' : ''}.`, tone: 'big'});
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
export type FightOutcome = {winner: 'you' | 'opp' | 'draw'; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; damageTaken: number};

export function applyResult(prev: Career, out: FightOutcome): Career {
  const c: Career = migrate(structuredClone(prev));
  const camp = c.camp; if (!camp) return c;
  const opp = npc(c, camp.opponentId)!;
  const r = rng(c.seed + c.week * 104729);
  const won = out.winner === 'you', lost = out.winner === 'opp';
  const purse = camp.purse + (won ? camp.winBonus : 0);
  c.money += purse;
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
  if (won && finish && r() < .45) { c.money += bonus; c.hype = clamp(c.hype + 4, 0, 100); c.bonuses!.potn += 1; c.log.unshift({week: c.week, text: `Performance of the Night! +$${bonus.toLocaleString()}.`, tone: 'big'}); }
  else if (out.damageTaken > 35 && (won || out.method !== 'KO/TKO') && r() < .3) { c.money += bonus; c.bonuses!.fotn += 1; c.log.unshift({week: c.week, text: `Fight of the Night with ${opp.name}. Both of you take home +$${bonus.toLocaleString()}.`, tone: 'big'}); }
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
    if (c.tier === 2) { c.rankings = c.rankings.slice(0, 14); c.rankings.push('you'); syncRank(c); }
    c.log.unshift({week: c.week, text: `Contract offer accepted: ${c.name} moves up to the ${TIERS[c.tier].name}!`, tone: 'big'});
  }
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
  if (!c.lineage.length && c.champion && c.champion !== 'you') { const ch = npc(c, c.champion); if (ch) c.lineage.push({week: c.week, name: ch.name, how: 'reigning champion'}); }
  return c;
}
export const heatOf = (c: Career, id: string) => (c.rivals ?? []).find(x => x.id === id)?.heat ?? 0;
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
    // the week before: press conference (the player chooses how to play it)
    if (camp.weeksLeft === 1 && !camp.pressDone && !c.choice) {
      c.choice = {kind: 'press', title: `${camp.event} press conference`, text: `${n.name} is at the other podium${heatOf(c, n.id) >= 40 ? ' and there is real bad blood' : ''}. The cameras are on you.`,
        options: [
          {id: 'trash', label: 'Trash talk', hint: '+8 hype, but he comes in fired up'},
          {id: 'respect', label: 'Stay respectful', hint: '+3 hype, he relaxes a little'},
          {id: 'mind', label: 'Mind games', hint: 'Coin flip: rattle him, or it backfires'},
        ]};
    }
    // fight week: weigh-ins
    if (camp.weeksLeft === 0) {
      if (c.choice?.kind === 'press') resolvePress(c, r, 'respect');
      if (r() < .1) { const fine = Math.round(camp.purse * .2 / 50) * 50; c.money += fine; c.log.unshift({week: c.week, text: `Weigh-ins: ${n.name} misses weight by 1.5 lb and forfeits 20% of his purse to you (+$${fine.toLocaleString()}).`, tone: 'good'}); }
      else c.log.unshift({week: c.week, text: `Weigh-ins: both fighters make weight. The face-off ${heatOf(c, n.id) >= 40 ? 'has to be separated by security' : 'is intense'}.`});
    }
    return;
  }
  if (c.injuryWeeks > 0 || r() > .11) return;
  // occasional events between fights
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
/** the player's answer to a story choice (press conference) */
export function resolveChoice(prev: Career, option: 'trash' | 'respect' | 'mind'): Career {
  const c: Career = migrate(structuredClone(prev));
  if (c.choice?.kind === 'press') resolvePress(c, rng(c.seed + c.week * 613), option);
  return c;
}