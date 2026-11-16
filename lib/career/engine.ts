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
export type Offer = {id: string; opponentId: string; tier: number; purse: number; winBonus: number; weeksOut: number; rounds: 3 | 5; title: boolean; note: string};
export type Camp = Omit<Offer, 'weeksOut'> & {weeksLeft: number};
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
  return withOffers(c, r);
}

/* -------------------------------------------------------------- weekly */
export type Action = {type: 'train'; focus: StatKey} | {type: 'spar'} | {type: 'rest'} | {type: 'promote'};
export const ACTIONS = {
  train: {label: 'Train', energy: -18, blurb: 'Big gains in one stat. Tiring.'},
  spar: {label: 'Spar', energy: -12, blurb: 'Small gains in a few stats. Some injury risk.'},
  rest: {label: 'Rest', energy: +35, blurb: 'Recover energy and heal up.'},
  promote: {label: 'Promote', energy: -8, blurb: 'Interviews and socials. Hype and a little cash.'},
} as const;

const growth = (age: number) => age < 26 ? 1.25 : age < 30 ? 1 : age < 33 ? .7 : .4;
function gain(c: Career, k: StatKey, amount: number) {
  const room = Math.max(0, c.potential - c.stats[k]) / c.potential;
  const g = Math.max(0, Math.round(amount * growth(c.age) * (room > 0 ? .15 + room * 1.4 : .05) * 10) / 10);
  c.stats[k] = clamp(Math.round((c.stats[k] + g) * 10) / 10, 1, 99);
  return g;
}

export function takeAction(prev: Career, a: Action): Career {
  if (prev.retired) return prev;
  const c: Career = structuredClone(prev);
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
    injuryRoll(c, r, tired ? .15 : .05);
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

function injuryRoll(c: Career, r: () => number, chance: number) {
  if (r() < chance) {
    c.injuryWeeks = 2 + Math.floor(r() * 4); c.health = Math.max(20, c.health - 30);
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
  c.log.unshift({week: c.week, text: `Around the ${TIERS[c.tier].short.toLowerCase()} scene: ${w.name} beats ${l.name}.`});
}

/* --------------------------------------------------------------- offers */
export const npc = (c: Career, id: string) => c.roster.find(n => n.id === id);
function syncRank(c: Career) { const i = c.rankings.indexOf('you'); c.rank = c.tier === 2 && i >= 0 ? i + 1 : null; }

function withOffers(c: Career, r: () => number): Career {
  if (c.camp || c.injuryWeeks > 0 || c.retired || c.week < c.nextOfferWeek) return c;
  const pool = c.roster.filter(n => n.tier === c.tier);
  const offers: Offer[] = [];
  if (c.tier === 2 && !c.champ && c.rank != null && c.rank <= 3 && c.hype >= 45 && c.champion) {
    offers.push(offer(c, r, c.champion, true));
  }
  if (c.tier === 2 && c.champ) {
    const challenger = c.rankings.find(id => id !== 'you');
    if (challenger) offers.push(offer(c, r, challenger, true));
  } else {
    let near = pool;
    if (c.tier === 2 && c.rank != null) near = c.rankings.slice(Math.max(0, c.rank - 4), c.rank + 3).filter(id => id !== 'you').map(id => npc(c, id)!).filter(Boolean);
    const shuffled = [...near].sort(() => r() - .5).slice(0, 3 - offers.length);
    for (const n of shuffled) offers.push(offer(c, r, n.id, false));
  }
  c.offers = offers;
  return c;
}

function offer(c: Career, r: () => number, opponentId: string, title: boolean): Offer {
  const base = [800, 6000, 40000][c.tier] * (1 + c.hype / 100) * (title ? 3 : 1);
  const o = npc(c, opponentId)!;
  const gap = overall(o.stats) - overall(c.stats);
  const note = title ? (c.champ ? 'Title defense' : 'Title shot') : gap > 8 ? 'Big step up' : gap < -8 ? 'Tune-up fight' : 'Even matchup';
  return {id: `${opponentId}-${c.week}`, opponentId, tier: c.tier, purse: Math.round(base / 50) * 50, winBonus: Math.round(base / 50) * 50, weeksOut: title ? 10 : 6 + Math.floor(r() * 5), rounds: title ? 5 : 3, title, note};
}

export function acceptOffer(prev: Career, id: string): Career {
  const c: Career = structuredClone(prev);
  const o = c.offers.find(x => x.id === id); if (!o) return c;
  const {weeksOut, ...rest} = o;
  c.camp = {...rest, weeksLeft: weeksOut}; c.offers = [];
  c.log.unshift({week: c.week, text: `Signed: vs ${npc(c, o.opponentId)?.name} in ${weeksOut} weeks${o.title ? ' for the belt' : ''}.`, tone: 'big'});
  return c;
}
export function declineOffer(prev: Career, id: string): Career {
  const c: Career = structuredClone(prev);
  c.offers = c.offers.filter(o => o.id !== id); c.hype = Math.max(0, c.hype - 2);
  if (!c.offers.length) return withOffers(c, rng(c.seed + c.week * 31 + 7));
  return c;
}

/* --------------------------------------------------------- after a fight */
export type FightOutcome = {winner: 'you' | 'opp' | 'draw'; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; damageTaken: number};

export function applyResult(prev: Career, out: FightOutcome): Career {
  const c: Career = structuredClone(prev);
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
  c.log.unshift({week: c.week, text: `${c.name} ${res} ${opp.name} by ${out.method} in round ${out.round}. Purse $${purse.toLocaleString()}.`, tone: won ? 'good' : lost ? 'bad' : undefined});

  if (c.tier === 2) {
    if (camp.title) {
      if (won && !c.champ) { const old = c.champion!; c.champ = true; c.champion = 'you'; c.rankings = c.rankings.filter(id => id !== 'you'); c.rankings.unshift(old); c.rankings = c.rankings.slice(0, 15); c.log.unshift({week: c.week, text: `AND NEW! ${c.name} is the VERSUS ${c.division} champion.`, tone: 'big'}); }
      else if (won && c.champ) { c.defenses += 1; c.log.unshift({week: c.week, text: `Title defense number ${c.defenses}.`, tone: 'big'}); }
      else if (lost && c.champ) { c.champ = false; c.champion = opp.id; c.rankings = c.rankings.filter(id => id !== opp.id); c.rankings.unshift('you'); c.rankings = c.rankings.slice(0, 15); c.log.unshift({week: c.week, text: `The belt changes hands. ${opp.name} is the new champion.`, tone: 'bad'}); }
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
  if (c.tier < 2 && won && c.tierWins >= (c.tier === 0 ? 3 : 2) && c.hype >= (c.tier === 0 ? 20 : 35)) {
    c.tier += 1; c.tierWins = 0;
    if (c.tier === 2) { c.rankings = c.rankings.slice(0, 14); c.rankings.push('you'); syncRank(c); }
    c.log.unshift({week: c.week, text: `Contract offer accepted: ${c.name} moves up to the ${TIERS[c.tier].name}!`, tone: 'big'});
  }
  c.camp = null;
  c.nextOfferWeek = c.week + 3 + Math.round(out.damageTaken / 20) + c.injuryWeeks;
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
