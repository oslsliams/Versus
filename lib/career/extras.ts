// VERSUS career extras: the systems and story that make a career feel lived in.
//  - callouts, a signature move, fan nicknames, training trips abroad, ring rust, comeback bonuses,
//    the rumor mill, betting-line moves, fan mail, fighter of the month, a title countdown, career stats,
//    division records, the Hall of Fame
//  - 40 more story events (EXTRA_BEATS, merged into the story engine)
//  - 22 achievements
// Only types are imported from the engine and story modules, so there is no import cycle.
import type {Career, FightOutcome, NPC, StatKey} from './engine';
import type {Beat, Line, Scene} from './story';

/* ------------------------------------------------------------------ state */
export type CareerStats = {fights: number; landed: number; thrown: number; takedowns: number; kdFor: number; kdAgainst: number; ctrl: number; cutsOpened: number; firstRoundFinishes: number; comebacks: number};
export type Extras = {ach?: Record<string, number>; sig?: string; sigFrom?: string; stats?: CareerStats; trip?: {id: string; left: number}; callWeek?: number;
  rumorWeek?: number; declined?: number; oddsCamp?: string; rustCamp?: string; records?: string[]; hof?: boolean; month?: number};
const X = (c: Career): Extras => (c.extra ??= {});
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const log = (c: Career, text: string, tone?: 'good' | 'bad' | 'big') => c.log.unshift({week: c.week, text, tone});
const post = (c: Career, handle: string, text: string, likes: number) => { c.feed ??= []; c.feed.unshift({week: c.week, handle, text, likes: Math.max(3, Math.round(likes))}); c.feed = c.feed.slice(0, 40); };
const thread = (c: Career, from: string, text: string, title?: string) => { c.threads = [...(c.threads ?? []), {week: c.week, from, text, title}].slice(-40); };
const milestone = (c: Career, text: string) => { c.milestones ??= []; c.milestones.unshift({week: c.week, age: c.age, text}); };
const npcOf = (c: Career, id: string) => c.roster.find(n => n.id === id);
const ovr = (s: Career['stats']) => Math.round(Object.values(s).reduce((a, b) => a + b, 0) / 8);
const REPORTER = '@MaraQuinnMMA';
const last = (n: string) => n.split(' ').slice(-1)[0];

/* ---------------------------------------------------------- training trips */
/** a few weeks abroad: the stats that place is known for grow 60% faster */
export const TRIPS = [
  {id: 'thailand', label: 'Muay Thai camp, Thailand', blurb: 'Clinch, knees and kicks with fighters who have had 200 fights.', stats: ['striking', 'power'] as StatKey[]},
  {id: 'dagestan', label: 'Wrestling room, the mountains', blurb: 'Chain wrestling and a pace that breaks people.', stats: ['wrestling', 'cardio'] as StatKey[]},
  {id: 'brazil', label: 'Jiu-jitsu academy, Rio', blurb: 'Two sessions a day on the mat with black belts.', stats: ['grappling', 'iq'] as StatKey[]},
  {id: 'altitude', label: 'Altitude camp, 2,000 metres up', blurb: 'Thin air. Your lungs and legs come back stronger.', stats: ['cardio', 'speed'] as StatKey[]},
] as const;
export const tripPrice = (c: Career) => [700, 5000, 18000][c.tier];
export const TRIP_WEEKS = 4;
export function bookTrip(prev: Career, id: string): Career {
  const c: Career = structuredClone(prev), t = TRIPS.find(x => x.id === id);
  if (!t || X(c).trip || c.money < tripPrice(c) || c.injuryWeeks > 0) return prev;
  c.money -= tripPrice(c); X(c).trip = {id, left: TRIP_WEEKS};
  log(c, `Booked: ${t.label} for ${TRIP_WEEKS} weeks. ${t.stats.map(s => s[0].toUpperCase() + s.slice(1)).join(' and ')} grow faster while you're there.`, 'good');
  post(c, '@' + c.name.replace(/\s+/g, ''), pick(Math.random, ['New camp, new lessons. ✈️', 'Going where the work is.', 'Leaving my comfort zone at the airport.']), 800 + c.hype * 40);
  return c;
}
/** training multiplier from a trip (called by the engine on train weeks) */
export function tripBoost(c: Career, k: StatKey) { const t = c.extra?.trip; if (!t) return 1; return TRIPS.find(x => x.id === t.id)?.stats.includes(k) ? 1.6 : 1; }

/* ---------------------------------------------------------------- callouts */
export const canCallOut = (c: Career) => !c.camp && !c.retired && c.record[0] >= 1 && c.week >= (c.extra?.callWeek ?? 0);
/** call a fighter out by name: heat that the matchmakers notice, and a reaction on socials */
export function callOut(prev: Career, id: string): Career {
  const c: Career = structuredClone(prev), n = npcOf(c, id);
  if (!n || !canCallOut(c)) return prev;
  X(c).callWeek = c.week + 4;
  const mine = c.rank ?? 16, theirs = c.champion === id ? 0 : (c.rankings.indexOf(id) + 1 || 16);
  const reach = c.tier === 2 && mine - theirs > 6;
  c.rivals ??= []; const rv = c.rivals.find(x => x.id === id);
  if (rv) { rv.heat = Math.min(100, rv.heat + 30); rv.why = 'you called him out'; } else c.rivals.push({id, heat: reach ? 30 : 45, why: 'you called him out'});
  c.rivals.sort((a, b) => b.heat - a.heat);
  c.hype = Math.max(0, Math.min(100, c.hype + (reach ? -2 : 4)));
  log(c, reach ? `You call out ${n.name}. He laughs it off: "Get in the top five first."` : `You call out ${n.name} on camera. The matchmakers are listening.`, reach ? 'bad' : 'big');
  post(c, '@' + n.name.replace(/\s+/g, ''), reach ? `Who? Come back when you have a number next to your name, ${last(c.name)}.` : `Heard you, ${last(c.name)}. Tell them to send the contract.`, 1200 + c.hype * 50);
  return c;
}

/* --------------------------------------------------------------- the week */
const RUMORS = ['Hearing {n}\'s camp has asked about {you}. Nothing signed.', 'Sources say the matchmakers like {you} vs {n} for the next card.', '{n} has been seen training southpaws. Make of that what you will, {you}.', 'Whispers: {you} turned down a fight last week. Their side says that\'s nonsense.'];
const FAN_MAIL = ['I started training because of your last fight. Lost 20 kilos so far.', 'My dad and I watch every fight together. You\'re his favourite.', 'I named my dog after you. He bites. Like you.', 'I was in the third row. That was the loudest I have ever screamed.', 'Please never stop doing that walkout.', 'Got your name on my gym bag. Keep winning, I need it to make sense.', 'I\'m a nurse on night shifts. Your fights get me through them.', 'Can you sign my gloves if I bring them to the next weigh-in?'];
/** every week, after the division moves */
export function extrasWeek(c: Career, r: () => number) {
  if (c.retired) return;
  const x = X(c);
  if (x.trip) { x.trip.left -= 1; if (x.trip.left <= 0) { const t = TRIPS.find(t => t.id === x.trip!.id); log(c, `Back from the ${t?.label ?? 'trip'}. The lessons come home with you.`, 'good'); x.trip = undefined; } }
  // the rumor mill, while you wait for a fight
  if (!c.camp && !c.offers.length && c.week >= (x.rumorWeek ?? 0) && r() < .35) {
    const pool = c.roster.filter(n => n.tier === c.tier && n.id !== c.champion);
    const n = pool[Math.floor(r() * pool.length)];
    const pool2 = c.week - (x.declined ?? -99) <= 2 ? RUMORS : RUMORS.filter(t => !t.includes('turned down'));
    if (n) { post(c, REPORTER, pick(r, pool2).replace('{n}', n.name).replace('{you}', c.name), 600 + c.hype * 30); x.rumorWeek = c.week + 3; }
  }
  // fight week: the betting line moves
  const camp = c.camp;
  if (camp && camp.weeksLeft === 1 && x.oddsCamp !== camp.opponentId + camp.event) {
    x.oddsCamp = camp.opponentId + camp.event; const n = npcOf(c, camp.opponentId);
    if (n && r() < .45) { const fav = ovr(c.stats) >= ovr(n.stats), moved = r() < .5;
      log(c, `Line movement: ${fav ? 'you' : n.name} opened as the favourite${moved ? `, and late money is coming in on ${fav ? n.name : 'you'}` : ' and the money keeps coming'}.`);
      if (moved) post(c, '@OddsWatchMMA', `${c.name} vs ${n.name}: ${moved ? 'sharp money moving the line' : 'line holding steady'} ahead of ${camp.event ?? 'fight night'}.`, 700); }
  }
  // ring rust: a long layoff, and your coach knows it
  if (camp && x.rustCamp !== camp.opponentId + camp.event && layoff(c) > 30) { x.rustCamp = camp.opponentId + camp.event; log(c, `${c.cast?.coach.short ?? 'Your coach'}: "${layoff(c)} weeks since your last fight. Ring rust is real. Expect to feel slow early."`, 'bad'); }
  // fan mail
  if (c.record[0] >= 2 && r() < .06) thread(c, 'Fan mail', pick(r, FAN_MAIL), 'A message from a fan');
  // fighter of the month
  if (c.week % 4 === 3 && r() < .5) {
    const recent = c.history.filter(h => h.week > c.week - 4 && h.result === 'W' && (h.method === 'KO/TKO' || h.method === 'SUB'));
    if (recent.length) { log(c, `${REPORTER}'s Fighter of the Month: ${c.name}.`, 'big'); post(c, REPORTER, `Fighter of the Month: ${c.name}. ${recent[0].opponent} found out the hard way.`, 2000 + c.hype * 60); x.month = (x.month ?? 0) + 1; }
    else { const hot = [...c.roster.filter(n => n.tier === c.tier)].sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0))[0]; if (hot && (hot.streak ?? 0) >= 4 && r() < .3) post(c, REPORTER, `Fighter of the Month: ${hot.name}, ${hot.streak} straight.`, 900); }
  }
  // a nickname the fans gave you (story flag nick:...)
  const nf = (c.flags ?? []).find(f => f.startsWith('nick:')); if (nf) { c.nickname = nf.slice(5); c.flags = c.flags!.filter(f => f !== nf); milestone(c, `Becomes "${c.nickname}" ${c.name}.`); }
  checkAchievements(c);
}
/** weeks since your last fight */
export const layoff = (c: Career) => c.history.length ? c.week - c.history[0].week : 0;
/** fight-night penalty for a long layoff (multiplies speed and fight IQ) */
export const rustMult = (c: Career) => c.camp && layoff(c) > 30 ? .95 : 1;

/* ------------------------------------------------------------ after a fight */
const RECORDS = [
  {id: 'wins', label: 'most wins in division history', n: 22, v: (c: Career) => c.record[0]},
  {id: 'finishes', label: 'most finishes in division history', n: 15, v: (c: Career) => c.finishes.ko + c.finishes.sub},
  {id: 'kos', label: 'most knockouts in division history', n: 12, v: (c: Career) => c.finishes.ko},
  {id: 'subs', label: 'most submissions in division history', n: 9, v: (c: Career) => c.finishes.sub},
  {id: 'defenses', label: 'most title defenses in division history', n: 11, v: (c: Career) => c.defenses},
  {id: 'streak', label: 'longest win streak in division history', n: 16, v: (c: Career) => c.streak ?? 0},
];
export const divisionRecords = (c: Career) => RECORDS.map(r => ({...r, mine: r.v(c), broken: (c.extra?.records ?? []).includes(r.id)}));
/** called by the engine once the result is in (history[0] is this fight) */
export function extrasAfterFight(c: Career, r: () => number, opp: NPC, out: FightOutcome) {
  const x = X(c), won = out.winner === 'you', t = out.tale, h = c.history[0];
  // career stats from the fights you played live
  const s = x.stats ??= {fights: 0, landed: 0, thrown: 0, takedowns: 0, kdFor: 0, kdAgainst: 0, ctrl: 0, cutsOpened: 0, firstRoundFinishes: 0, comebacks: 0};
  s.fights += 1;
  if (t) { s.landed += t.landed; s.thrown += t.thrown; s.takedowns += t.takedowns; s.kdFor += t.kdFor; s.kdAgainst += t.kdAgainst; s.ctrl += t.ctrl; if ((t.oppCut ?? 0) >= 20) s.cutsOpened += 1; }
  const fin = out.method === 'KO/TKO' || out.method === 'SUB';
  if (won && fin && out.round === 1) s.firstRoundFinishes += 1;
  // a cutman in your corner keeps the damage from carrying over
  if ((c.flags ?? []).includes('cutman') && c.cut) c.cut = Math.round(c.cut * .7);
  // comeback of the night
  if (won && t && t.kdAgainst >= 1) {
    s.comebacks += 1; const cash = [1000, 6000, 25000][c.tier]; c.money += cash; c.hype = Math.min(100, c.hype + 5);
    log(c, `Comeback of the Night! You got off the canvas to win. +$${cash.toLocaleString()}.`, 'big');
    post(c, REPORTER, `${c.name} was DOWN against ${opp.name} and still found a way. Comeback of the year contender.`, 3000 + c.hype * 80);
  }
  // a signature move: three wins the same way and it becomes yours
  if (won && fin && out.how && !x.sig) {
    const same = c.history.filter(f => f.result === 'W' && f.how === out.how).length;
    if (same >= 3) { x.sig = out.how; log(c, `Signature move: the ${out.how.toLowerCase()}. Commentators will be waiting for it.`, 'big'); milestone(c, `Earns a signature move: the ${out.how.toLowerCase()}.`); post(c, REPORTER, `Three wins by ${out.how.toLowerCase()} now. That's ${last(c.name)}'s signature, and everyone knows it.`, 2500); }
  }
  if (won && x.sig && out.how === x.sig) log(c, `There it is: the signature ${x.sig.toLowerCase()} again.`);
  // division records
  x.records ??= [];
  for (const rec of RECORDS) if (!x.records.includes(rec.id) && rec.v(c) > rec.n) {
    x.records.push(rec.id); log(c, `RECORD: ${c.name} now holds the ${rec.label} (${rec.v(c)}).`, 'big'); milestone(c, `Sets the ${c.division} record for ${rec.label.replace(' in division history', '')}.`);
    post(c, REPORTER, `History: ${c.name} owns the ${rec.label}. ${rec.v(c)} and counting.`, 6000 + c.hype * 100);
  }
  void h; void r;
  checkAchievements(c, out);
}

/* ------------------------------------------------------- title countdown */
/** before a title fight: the build-up package (called by the engine when a title offer is signed) */
export function countdownScene(c: Career, opp: NPC, champ: boolean): Scene {
  const coach = c.cast?.coach.short ?? 'Coach', mgr = c.cast?.manager.short ?? 'Your manager';
  const lines: Line[] = [
    {who: 'Narrator', text: `${champ ? 'The champion' : 'The challenger'}: ${c.name}, ${c.record.join('-')}. ${opp.name}, ${opp.record.join('-')}, stands between ${champ ? 'him and another defense' : 'him and the belt'}.`},
    {who: coach, text: champ ? '"Everyone in that division wakes up thinking about taking what\'s yours. Make him regret it."' : '"Ten weeks. Every round you\'ve ever fought was for this camp."'},
    {who: mgr, text: '"Every camera in the sport is on this one. Don\'t say anything stupid at the press conference."'},
    {who: 'You', text: c.extra?.sig ? `You think about the ${c.extra.sig.toLowerCase()}. He's studied it. Good. Let him.` : 'You put the poster on the fridge and stare at it longer than you meant to.'},
  ];
  return {id: 'countdown', kicker: `${c.division} Championship · Countdown`, title: `${last(c.name)} vs ${last(opp.name)}`, tone: 'big', lines};
}

/* --------------------------------------------------------- Hall of Fame */
/** at retirement: a great career gets the call (score from the engine's legacy()) */
export function hallOfFame(c: Career, legacyScore: number) {
  const titles = c.history.filter(h => h.title && h.result === 'W').length;
  if (legacyScore < 520 && titles < 4) return;
  X(c).hof = true;
  log(c, `The VERSUS Hall of Fame calls. ${c.name} will be inducted next summer.`, 'big');
  milestone(c, 'Inducted into the VERSUS Hall of Fame.');
  post(c, REPORTER, `Hall of Famer: ${c.name}. ${c.record.join('-')}, ${titles} title wins. There will not be another one quite like that.`, 20000);
}

/* ------------------------------------------------------------ achievements */
type Ach = {id: string; label: string; hint: string; done: (c: Career, out?: FightOutcome) => boolean};
const W = (c: Career) => c.record[0];
export const ACHIEVEMENTS: Ach[] = [
  {id: 'first-win', label: 'First of many', hint: 'Win your first pro fight', done: c => W(c) >= 1},
  {id: 'first-ko', label: 'Lights out', hint: 'Win by knockout', done: c => c.finishes.ko >= 1},
  {id: 'first-sub', label: 'Tap, tap, tap', hint: 'Win by submission', done: c => c.finishes.sub >= 1},
  {id: 'ten-wins', label: 'Double digits', hint: 'Win 10 fights', done: c => W(c) >= 10},
  {id: 'twentyfive', label: 'Veteran', hint: 'Win 25 fights', done: c => W(c) >= 25},
  {id: 'fifty', label: 'Fifty', hint: 'Win 50 fights', done: c => W(c) >= 50},
  {id: 'streak5', label: 'On fire', hint: 'Win 5 in a row', done: c => (c.streak ?? 0) >= 5},
  {id: 'streak10', label: 'Unstoppable', hint: 'Win 10 in a row', done: c => (c.streak ?? 0) >= 10},
  {id: 'big-show', label: 'The big show', hint: 'Sign with the VERSUS Championship', done: c => c.tier === 2 || (c.peakTier ?? 0) === 2},
  {id: 'ranked', label: 'A number next to your name', hint: 'Break into the rankings', done: c => !!c.rank || c.champ},
  {id: 'champ', label: 'And new', hint: 'Win a world title', done: c => c.champ || c.history.some(h => h.title && h.result === 'W')},
  {id: 'defend3', label: 'Defender', hint: 'Defend a title 3 times', done: c => c.defenses >= 3},
  {id: 'defend5', label: 'Reign', hint: 'Defend a title 5 times', done: c => c.defenses >= 5},
  {id: 'two-div', label: 'Two-weight world champion', hint: 'Win belts in two divisions', done: c => (c.divisionTitles?.length ?? 0) >= 2},
  {id: 'comeback', label: 'Off the canvas', hint: 'Get knocked down and still win', done: (c, o) => (c.extra?.stats?.comebacks ?? 0) >= 1 || (!!o && o.winner === 'you' && (o.tale?.kdAgainst ?? 0) >= 1)},
  {id: 'doctor', label: 'Cut him open', hint: 'Win by doctor stoppage', done: (c, o) => (!!o && o.winner === 'you' && o.how === 'Doctor stoppage') || c.history.some(h => h.result === 'W' && h.how === 'Doctor stoppage')},
  {id: 'head-kick', label: 'Highlight reel', hint: 'Win with a head kick', done: c => c.history.some(h => h.result === 'W' && h.how === 'Head kick')},
  {id: 'quick', label: 'Early night', hint: 'Finish someone in round 1', done: c => c.history.some(h => h.result === 'W' && h.round === 1 && (h.method === 'KO/TKO' || h.method === 'SUB'))},
  {id: 'bleeder', label: 'Fought through it', hint: 'Win with a bad cut on your face', done: (c, o) => !!o && o.winner === 'you' && (o.tale?.cut ?? 0) >= 50},
  {id: 'award', label: 'Trophy cabinet', hint: 'Win a year-end award', done: c => (c.awards?.length ?? 0) >= 1},
  {id: 'million', label: 'Seven figures', hint: 'Earn $1,000,000 in purses', done: c => (c.earnings ?? 0) >= 1_000_000},
  {id: 'famous', label: 'Household name', hint: 'Reach 100,000 followers', done: c => (c.followers ?? 0) >= 100_000},
];
export function checkAchievements(c: Career, out?: FightOutcome) {
  const x = X(c); x.ach ??= {};
  for (const a of ACHIEVEMENTS) if (!x.ach[a.id] && a.done(c, out)) {
    x.ach[a.id] = c.week; log(c, `Achievement unlocked: ${a.label} (${a.hint.toLowerCase()}).`, 'good');
  }
}

/* ------------------------------------------------------- 40 story events */
const P = (c: Career, k: 'coach' | 'manager' | 'brother' | 'friend' | 'partner') => c.cast?.[k]?.short ?? k;
const NICKS: Record<string, string[]> = {Striker: ['The Hammer', 'Lights Out', 'Sniper', 'Dynamite'], Wrestler: ['The Bulldozer', 'Anchor', 'Iron Lung', 'The Vise'], Grappler: ['The Python', 'Snake', 'Professor', 'Silk'], 'All-rounder': ['The Problem', 'Swiss Army', 'Chess', 'No Holes']};
export const EXTRA_BEATS: Beat[] = [
  /* the fans and the internet */
  {id: 'x-fan-nickname', arc: 'x-fans', from: 'manager', when: c => !c.nickname && c.finishes.ko + c.finishes.sub >= 2 && c.hype >= 18, build: c => { const list = NICKS[c.style] ?? NICKS['All-rounder'], n = list[(c.seed + c.record[0]) % list.length]; return {title: 'The fans picked a name', text: `"Everyone online is calling you '${n}'. It's on signs, it's on shirts. Do we run with it?"`, options: [
    {id: 'yes', label: `Become "${n}"`, hint: 'It goes on the posters.', eff: {hype: 5, followers: 3000, flag: 'nick:' + n, text: `"${n}" ${c.name}. It sticks.`, tone: 'good'}},
    {id: 'no', label: 'Keep your own name', hint: 'No nickname for now.', eff: {hype: -1, text: 'You tell the fans you\'d rather be known by your name. Some respect it.'}}]}; }},
  {id: 'x-viral-walkout', arc: 'x-fans', from: 'friend', again: 200, when: c => c.record[0] >= 3 && c.hype >= 25, build: c => ({title: 'Your walkout went viral', text: `${P(c, 'friend')}: "Someone cut your walkout to a song and it's got four million views. People want you to dance next time."`, options: [
    {id: 'dance', label: 'Dance next time', hint: 'Huge hype. Your coach hates it.', eff: {hype: 8, followers: 9000, bond: {coach: -4}, text: 'The next walkout is choreographed. The arena goes mad.', tone: 'good'}},
    {id: 'serious', label: 'Stay serious', hint: 'The killer walk.', eff: {hype: 2, bond: {coach: 3}, text: 'You walk out like it\'s a funeral. The clip still goes viral.'}}]})},
  {id: 'x-face-tattoo', arc: 'x-fans', from: 'Fan mail', when: c => c.hype >= 40, build: () => ({title: 'A fan got your face tattooed', text: 'A photo arrives: your face, on a stranger\'s calf, with your record underneath. He tagged you.', options: [
    {id: 'meet', label: 'Invite him to a fight', hint: 'A great story.', eff: {hype: 4, followers: 6000, text: 'He cries at the weigh-ins. The clip does numbers.', tone: 'good'}},
    {id: 'ignore', label: 'Leave it', hint: 'A bit much.', eff: {text: 'You leave him on read. He gets your next record updated anyway.'}}]})},
  {id: 'x-game-rating', arc: 'x-fans', from: 'friend', when: c => c.tier >= 1, build: c => ({title: 'Your video game rating', text: `${P(c, 'friend')}: "They put you in the new MMA game. They gave you a ${ovr(c.stats) - 6} overall. That's disrespectful."`, options: [
    {id: 'beef', label: 'Complain publicly', hint: 'Hype, but you look petty.', eff: {hype: 4, followers: 4000, text: 'The developers reply with a cry-laughing emoji. It becomes a whole thing.'}},
    {id: 'laugh', label: 'Laugh it off', hint: '"I\'ll earn a higher one."', eff: {hype: 2, bond: {coach: 2}, text: '"I\'ll earn the upgrade." The fans love that.', tone: 'good'}}]})},
  {id: 'x-kid-letter', arc: 'x-fans', from: 'Fan mail', when: c => c.record[0] >= 4, build: () => ({title: 'A letter in crayon', text: '"Dear fighter. I am 8. I got bullied and I did your jab. I am not getting bullied anymore. Please write back."', options: [
    {id: 'reply', label: 'Write back by hand', hint: 'Costs an evening.', eff: {energy: -4, hype: 3, health: 3, text: 'You write two pages and send a signed glove. You feel better than after most wins.', tone: 'good'}},
    {id: 'video', label: 'Send a quick video', hint: 'Easy and kind.', eff: {hype: 2, text: 'A thirty-second video. His mum says he watches it every morning.'}}]})},
  {id: 'x-merch', arc: 'x-money', from: 'manager', when: c => c.hype >= 35 && c.tier >= 1, build: c => ({title: 'Your own merch line', text: `${P(c, 'manager')}: "Hoodies, caps, your logo. We put up the money, we keep a cut of everything."`, options: [
    {id: 'yes', label: 'Launch it', hint: 'Costs money now, pays over time.', roll: .65, win: {money: [1200, 4000, 9000][c.tier], hype: 3, text: 'The first run sells out. Small, steady cheques after that.', tone: 'good'}, lose: {money: -[800, 2500, 6000][c.tier], text: 'Boxes of unsold hoodies in your garage.', tone: 'bad'}},
    {id: 'no', label: 'Not yet', hint: 'Win more first.', eff: {text: 'You decide the record should do the talking first.'}}]})},
  {id: 'x-cooking-show', arc: 'x-media', from: 'manager', when: c => c.hype >= 30 && !c.camp, build: c => ({title: 'A cooking show', text: `${P(c, 'manager')}: "Daytime TV. You make your fight-week meal, they ask about your mum. Easy money."`, options: [
    {id: 'yes', label: 'Do the show', hint: '+money, +hype, a lost day.', eff: {money: 800 * (c.tier + 1), hype: 4, energy: -6, text: 'You burn the rice live on air. People love you more for it.', tone: 'good'}},
    {id: 'no', label: 'Stay in the gym', hint: 'Your coach approves.', eff: {bond: {coach: 3}, text: 'Another day of rounds.'}}]})},
  {id: 'x-reality-show', arc: 'x-media', from: 'manager', when: c => c.tier >= 1 && c.hype >= 45, build: c => ({title: 'A reality show', text: `${P(c, 'manager')}: "Cameras in your house for a month. The money is stupid. The privacy is gone."`, options: [
    {id: 'yes', label: 'Sign it', hint: 'Big money and hype. Your partner is not happy.', eff: {money: 4000 * (c.tier + 1), hype: 10, followers: 20000, bond: {partner: -10}, text: 'Episode three is the one where you cry. It\'s the most-watched.', tone: 'big'}},
    {id: 'no', label: 'Keep your life private', hint: 'Your family stays out of it.', eff: {bond: {partner: 6}, text: 'You turn it down. At home, nobody says anything, but dinner is better.'}}]})},
  {id: 'x-podcast-beef', arc: 'x-media', from: 'coach', when: c => c.record[0] >= 3, build: c => ({title: 'A podcast insulted your coach', text: `A big podcast host called ${P(c, 'coach')} "a has-been running a daycare." The clip is everywhere.`, options: [
    {id: 'defend', label: 'Go on air and defend him', hint: 'Your coach will never forget it.', eff: {bond: {coach: 10}, hype: 4, text: 'You go on the same show and calmly take the host apart. Your coach watches it twice.', tone: 'good'}},
    {id: 'stay', label: 'Let it go', hint: 'Not worth it.', eff: {bond: {coach: -3}, text: 'Your coach says it doesn\'t bother him. It does.'}}]})},
  {id: 'x-legend-praise', arc: 'x-media', from: 'friend', when: c => c.tier === 2 && (c.streak ?? 0) >= 3, build: c => ({title: 'A legend said your name', text: `${P(c, 'friend')}: "A retired champion was on TV last night. He said you're the one he'd pay to watch. On live TV."`, options: [
    {id: 'thank', label: 'Thank him publicly', hint: 'Humble.', eff: {hype: 5, text: 'He replies: "Keep doing it, kid." You screenshot it.', tone: 'good'}},
    {id: 'more', label: '"He\'s right."', hint: 'Confident.', eff: {hype: 7, text: 'Half the internet loves the confidence. The other half wants you humbled.'}}]})},
  /* the gym and the craft */
  {id: 'x-old-gym', arc: 'x-gym', from: 'brother', when: c => c.tier >= 1 && c.money > 6000, build: c => ({title: 'Your first gym is closing', text: `${P(c, 'brother')}: "The basement gym where you started is shutting down. Rent went up. The owner asked if you could help."`, options: [
    {id: 'save', label: 'Pay the rent for a year', hint: 'Costs money. Earns respect forever.', eff: {money: -Math.round(Math.min(c.money * .3, 3000 * (c.tier + 1))), hype: 6, bond: {brother: 8, coach: 5}, text: 'They paint your name over the door. Kids train there every night.', tone: 'big'}},
    {id: 'no', label: 'You can\'t right now', hint: 'Keep the money.', eff: {bond: {brother: -5}, text: 'It closes in March. You drive past it once and don\'t stop.', tone: 'bad'}}]})},
  {id: 'x-rival-gym', arc: 'x-gym', from: 'manager', when: c => c.tier >= 1 && c.record[0] >= 5, build: c => ({title: 'Another gym wants you', text: `${P(c, 'manager')}: "The biggest team in the country wants you. Better partners, better coaches. ${P(c, 'coach')} would be finished with you."`, options: [
    {id: 'stay', label: 'Stay loyal', hint: 'Your coach is your coach.', eff: {bond: {coach: 12}, text: `${P(c, 'coach')} hears about the offer from someone else. He doesn't mention it. He's at the gym early every day after.`, tone: 'good'}},
    {id: 'visit', label: 'Spend a week there', hint: 'Better sparring. Your coach finds out.', eff: {stat: [['striking', 1], ['wrestling', 1], ['grappling', 1]], bond: {coach: -12}, text: 'The sparring is a level up. The drive home is quiet.'}}]})},
  {id: 'x-legend-week', arc: 'x-gym', from: 'coach', when: c => c.tier >= 1 && !c.camp, build: c => ({title: 'A week with a legend', text: `${P(c, 'coach')}: "An old friend of mine, two-weight champion back in the day, is in town. He'll work with you for a week. It isn't cheap."`, options: [
    {id: 'yes', label: 'Train with him', hint: '+Fight IQ, costs money.', eff: {money: -1200 * (c.tier + 1), stat: [['iq', 3], ['striking', 1]], energy: -10, text: 'He shows you one thing about distance you\'ll use for the rest of your career.', tone: 'good'}},
    {id: 'no', label: 'Save the money', hint: 'Maybe next time.', eff: {text: 'He leaves on Sunday. You watch his old fights instead.'}}]})},
  {id: 'x-sparring-leak', arc: 'x-gym', from: 'friend', when: c => c.record[0] >= 3 && c.hype >= 20, build: c => ({title: 'Sparring footage leaked', text: `${P(c, 'friend')}: "Someone posted you getting dropped in sparring last month. It's being called proof your chin is gone."`, options: [
    {id: 'post', label: 'Post the next round too', hint: 'You got up and won it.', eff: {hype: 4, text: 'You post the full footage. You get up and drop him. The narrative flips.', tone: 'good'}},
    {id: 'quiet', label: 'Say nothing', hint: 'Find the leaker.', eff: {hype: -3, bond: {coach: 4}, text: 'Your coach changes the gym rules: no phones in sparring.'}}]})},
  {id: 'x-rookie', arc: 'x-gym', from: 'Message', again: 150, when: c => c.tier >= 1 && c.record[0] >= 6, build: () => ({title: 'A rookie asks for help', text: '"I\'m 2-0 and fighting on the regional scene next month. You\'re the reason I started. Could you corner me?"', options: [
    {id: 'yes', label: 'Corner him', hint: 'Costs energy. Good for the soul.', eff: {energy: -10, hype: 3, stat: [['iq', 1]], text: 'He wins by decision. You were louder than his mum.', tone: 'good'}},
    {id: 'tips', label: 'Send him some tips', hint: 'Quick and kind.', eff: {hype: 1, text: 'You send a voice note about his jab. He says it saved him.'}}]})},
  {id: 'x-cutman', arc: 'x-gym', from: 'coach', when: c => (c.extra?.stats?.fights ?? 0) >= 3 && !(c.flags ?? []).includes('cutman'), build: c => ({title: 'A proper cutman', text: `${P(c, 'coach')}: "There's an old cutman who worked title fights for thirty years. He'd join our corner. Your cuts would close faster."`, options: [
    {id: 'hire', label: 'Hire him', hint: 'Cuts carry over less into the next camp.', eff: {money: -900 * (c.tier + 1), flag: 'cutman', text: 'He shows up with a tackle box and no small talk. You like him immediately.', tone: 'good'}},
    {id: 'no', label: 'We\'re fine', hint: 'Save the money.', eff: {text: 'You stick with the gym first-aid kit.'}}]})},
  {id: 'x-gym-flood', arc: 'x-gym', from: 'coach', when: c => !!c.camp && c.camp.weeksLeft >= 3, build: c => ({title: 'The gym flooded', text: `${P(c, 'coach')}: "Pipe burst overnight. The mats are ruined. We train in my garage until it's fixed."`, options: [
    {id: 'garage', label: 'Train in the garage', hint: 'Rough, but you keep going.', eff: {fitness: -3, bond: {coach: 5}, text: 'Hitting pads between a lawnmower and a freezer. It feels like the old days.'}},
    {id: 'rent', label: 'Rent a fancy gym', hint: 'Costs money, no lost work.', eff: {money: -700 * (c.tier + 1), fitness: 2, text: 'The new place has a juice bar. Your coach refuses to use it.'}}]})},
  {id: 'x-nutritionist', arc: 'x-gym', from: 'manager', when: c => c.tier >= 1 && !!c.camp, build: c => ({title: 'A real nutritionist', text: `${P(c, 'manager')}: "The nutritionist who works with the champions has an opening. Your weight cuts would stop being a horror show."`, options: [
    {id: 'hire', label: 'Hire her for this camp', hint: '+fitness, costs money.', eff: {money: -1000 * (c.tier + 1), fitness: 6, text: 'Weighed food, measured water. You make weight feeling human.', tone: 'good'}},
    {id: 'no', label: 'Do it yourself', hint: 'Chicken and rice it is.', eff: {text: 'Chicken, rice, misery.'}}]})},
  {id: 'x-heat-camp', arc: 'x-gym', from: 'coach', when: c => !!c.camp, build: c => ({title: 'Heat wave', text: `${P(c, 'coach')}: "It's 38 degrees in the gym. Some coaches would cancel. I'm not some coaches."`, options: [
    {id: 'go', label: 'Train in the heat', hint: '+Cardio, costs health.', eff: {stat: [['cardio', 2]], health: -8, text: 'You lose three litres of sweat and feel like a new engine.'}},
    {id: 'early', label: 'Train at 5 a.m. instead', hint: 'Safer.', eff: {energy: -5, text: 'Sunrise sessions. You see the city wake up every day.'}}]})},
  {id: 'x-drug-test', arc: 'x-gym', from: 'Commission', again: 120, when: c => c.tier >= 1, build: () => ({title: 'Random drug test', text: 'A testing officer knocks at 6:40 a.m. "Random out-of-competition test. Sorry for the hour."', options: [
    {id: 'comply', label: 'Make him a coffee', hint: 'Clean as a whistle.', eff: {hype: 1, text: 'Clean, as always. You post a photo of you and the tester. He looks thrilled.'}},
    {id: 'grumble', label: 'Complain online about the hour', hint: 'Fans side with you.', eff: {hype: 2, text: '"6:40 a.m.?!" The post gets more likes than your last win.'}}]})},
  /* money and temptation */
  {id: 'x-shady-agent', arc: 'x-money', from: 'Message', when: c => c.tier >= 1 && c.record[0] >= 4, build: c => ({title: 'An agent slides into your DMs', text: `"Your manager is robbing you. Sign with me and I'll get you 30% more per fight." ${P(c, 'manager')} has been with you since day one.`, options: [
    {id: 'stay', label: 'Stay with your manager', hint: 'Loyalty.', eff: {bond: {manager: 8}, text: `${P(c, 'manager')} finds out you said no. He takes you out for steak.`, tone: 'good'}},
    {id: 'switch', label: 'Listen to his pitch', hint: 'Better pay. Burns a bridge.', eff: {pay: 1.06, bond: {manager: -15}, text: 'The numbers are better. The phone calls with your manager are much shorter now.'}}]})},
  {id: 'x-fix-offer', arc: 'x-money', from: 'Unknown number', when: c => c.tier >= 1 && !!c.camp, build: () => ({title: 'A strange offer', text: '"Lose the first round on purpose. Nothing else. $20,000 cash." The number is blocked.', options: [
    {id: 'report', label: 'Report it to the commission', hint: 'The right thing.', eff: {hype: 4, flag: 'reported-fix', text: 'The commission thanks you. Two people are arrested months later.', tone: 'good'}},
    {id: 'block', label: 'Block the number', hint: 'Forget it happened.', eff: {text: 'You block it and don\'t sleep well that night.'}}]})},
  {id: 'x-sponsor-ban', arc: 'x-money', from: 'coach', when: c => c.tier >= 1, build: c => ({title: 'Your sponsor\'s supplement', text: `${P(c, 'coach')} reads the label of your sponsor's pre-workout. "This has something in it that could fail a test. Stop taking it."`, options: [
    {id: 'drop', label: 'Drop the sponsor', hint: 'Lose money. Stay clean.', eff: {money: -600 * (c.tier + 1), bond: {coach: 5}, text: 'You end the deal. A month later, another fighter on that brand fails a test.', tone: 'good'}},
    {id: 'keep', label: 'Keep the deal, stop the powder', hint: 'Risky if anyone finds out.', roll: .8, win: {text: 'Nobody notices you never post the product.'}, lose: {hype: -8, money: -800 * (c.tier + 1), text: 'A journalist digs it up. "Fighter promotes risky supplement." It\'s a bad week.', tone: 'bad'}}]})},
  {id: 'x-friend-loan', arc: 'x-money', from: 'friend', when: c => c.money > 4000, build: c => ({title: 'A loan', text: `${P(c, 'friend')}: "I hate asking. I'm behind on rent. $1,500 and I'll pay you back in two months. Swear."`, options: [
    {id: 'lend', label: 'Lend it', hint: 'He means it. Probably.', roll: .7, win: {money: 0, bond: {friend: 10}, text: 'He pays you back early, with a bottle of something nice.', tone: 'good'}, lose: {money: -1500, bond: {friend: 4}, text: 'The money never comes back. Neither does the topic.'}},
    {id: 'no', label: 'Say no', hint: 'Money and friends don\'t mix.', eff: {bond: {friend: -8}, text: 'He says he understands. He doesn\'t text for a while.'}}]})},
  {id: 'x-watch-deal', arc: 'x-money', from: 'manager', when: c => c.tier === 2 && c.hype >= 50, build: c => ({title: 'A luxury watch deal', text: `${P(c, 'manager')}: "A watch brand wants you as an ambassador. You wear it to every press conference. That's the job."`, options: [
    {id: 'yes', label: 'Sign it', hint: '+money, +hype.', eff: {money: 8000, hype: 5, text: 'The watch costs more than your first car. You check the time a lot now.', tone: 'good'}},
    {id: 'no', label: 'Not your style', hint: 'Keep it real.', eff: {hype: 1, text: 'You keep your cheap digital watch. The fans notice.'}}]})},
  /* family and life */
  {id: 'x-wedding', arc: 'x-life', from: 'brother', when: c => !!c.camp && c.camp.weeksLeft >= 2, build: c => ({title: 'A family wedding', text: `${P(c, 'brother')}: "Our cousin's wedding is Saturday. You're in the middle of camp, I know. Mum's asking."`, options: [
    {id: 'go', label: 'Go for the day', hint: 'Family first. A lost day.', eff: {fitness: -2, bond: {brother: 8}, health: 4, text: 'You dance with your gran and leave before the cake. Worth it.', tone: 'good'}},
    {id: 'skip', label: 'Stay in camp', hint: 'Fight first.', eff: {bond: {brother: -6}, fitness: 1, text: 'You watch the speeches on a video call from the gym car park.'}}]})},
  {id: 'x-anniversary', arc: 'x-life', from: 'partner', when: c => !!c.camp && c.camp.weeksLeft <= 2, build: c => ({title: 'Your anniversary', text: `${P(c, 'partner')}: "It's our anniversary on fight week. I'm not asking for much. Just one dinner."`, options: [
    {id: 'dinner', label: 'One dinner', hint: 'Off the diet for a night.', eff: {fitness: -2, bond: {partner: 10}, text: 'One plate of pasta. The best night you\'ve had in months.', tone: 'good'}},
    {id: 'after', label: 'After the fight', hint: '"I promise."', eff: {bond: {partner: -6}, text: '"After the fight." You\'ve said that before.'}}]})},
  {id: 'x-brother-card', arc: 'x-life', from: 'brother', when: c => c.tier >= 1 && (c.flags ?? []).includes('cornered-brother'), build: c => ({title: 'Your brother wants on the card', text: `${P(c, 'brother')}: "Can you ask them to put me on your undercard? Just once. Fighting on the same night as you."`, options: [
    {id: 'ask', label: 'Ask the promotion', hint: 'Spends some of your goodwill.', roll: .6, win: {hype: 6, bond: {brother: 15}, text: 'He gets the spot and wins. You watch from the locker room monitor and scream.', tone: 'big'}, lose: {hype: -2, bond: {brother: -4}, text: 'They say no. He tells you it\'s fine.'}},
    {id: 'earn', label: 'Tell him to earn it', hint: 'Tough love.', eff: {bond: {brother: -3}, text: '"Earn it like I did." He trains harder than ever. And he\'s annoyed.'}}]})},
  {id: 'x-retreat', arc: 'x-life', from: 'partner', when: c => !c.camp && c.health < 70, build: c => ({title: 'Get away for a week', text: `${P(c, 'partner')}: "No gym, no phone, a cabin by a lake. You look exhausted. Please."`, options: [
    {id: 'go', label: 'Go to the lake', hint: 'Big recovery. A week off.', eff: {health: 25, energy: 30, fitness: -4, bond: {partner: 8}, text: 'You sleep ten hours a night. You forgot what that felt like.', tone: 'good'}},
    {id: 'no', label: 'Stay and grind', hint: 'No days off.', eff: {bond: {partner: -5}, text: 'You stay. The cabin photos look nice.'}}]})},
  {id: 'x-car-accident', arc: 'x-life', from: 'friend', again: 300, when: c => c.week > 40, build: () => ({title: 'A fender bender', text: 'Someone runs a red light and clips your car. You\'re fine, mostly. Your neck is stiff.', options: [
    {id: 'physio', label: 'Get it checked properly', hint: 'Lose a little time, stay safe.', eff: {health: -5, injury: 1, text: 'Whiplash. A week of easy work.'}},
    {id: 'shrug', label: 'Shake it off', hint: 'Risky.', roll: .7, win: {text: 'It loosens up after a day.'}, lose: {injury: 3, health: -15, text: 'It\'s worse than you thought. Three weeks out.', tone: 'bad'}}]})},
  {id: 'x-detox', arc: 'x-life', from: 'coach', when: c => !!c.camp && c.camp.weeksLeft >= 4, build: c => ({title: 'Delete the apps', text: `${P(c, 'coach')}: "You're reading the comments again. Delete everything until fight night."`, options: [
    {id: 'yes', label: 'Go dark', hint: '+fitness, hype fades.', eff: {fitness: 4, hype: -4, bond: {coach: 4}, text: 'Six weeks with no comments section. Your head is clear.', tone: 'good'}},
    {id: 'no', label: 'Keep posting', hint: 'The fans need you.', eff: {hype: 3, text: 'You post daily camp vlogs. Your coach pretends not to see them.'}}]})},
  {id: 'x-stalker', arc: 'x-life', from: 'coach', when: c => c.hype >= 55, build: c => ({title: 'Someone keeps showing up', text: `${P(c, 'coach')}: "Same guy outside the gym every day this week, filming you. It's getting weird."`, options: [
    {id: 'security', label: 'Hire security', hint: 'Costs money. Peace of mind.', eff: {money: -1500, health: 3, text: 'A large, silent man now drives you to training.'}},
    {id: 'talk', label: 'Talk to him', hint: 'Probably just a big fan.', roll: .75, win: {hype: 2, text: 'He\'s a nervous fan making a documentary. You give him an interview.'}, lose: {health: -6, energy: -10, text: 'It does not go well. The police get involved.', tone: 'bad'}}]})},
  /* rivals and the business */
  {id: 'x-press-shove', arc: 'x-rival', from: 'manager', when: c => !!c.camp && c.camp.weeksLeft === 2, build: c => { const n = npcOf(c, c.camp!.opponentId)?.name ?? 'He'; return {target: c.camp!.opponentId, title: 'The face-off gets physical', text: `${n} shoves you at the press conference face-off. Cameras everywhere.`, options: [
    {id: 'shove', label: 'Shove him back', hint: 'Hype and a fine.', eff: {hype: 7, money: -500 * (c.tier + 1), heat: 15, text: 'Security pulls you apart. The clip is the lead story everywhere.', tone: 'big'}},
    {id: 'smile', label: 'Smile at him', hint: 'Get in his head.', eff: {hype: 3, text: 'You just smile. He looks rattled for the rest of the press conference.', tone: 'good'}}]}; }},
  {id: 'x-old-rival', arc: 'x-rival', from: 'manager', when: c => (c.rivals ?? []).length > 0 && c.week > 150, build: c => { const rv = npcOf(c, (c.rivals ?? [])[0]?.id ?? ''); return {title: 'An old rival is retiring', text: `${rv?.name ?? 'Your old rival'} is hanging up the gloves. His team asked if you'd say a few words at his last press conference.`, options: [
    {id: 'yes', label: 'Say a few words', hint: 'Class.', eff: {hype: 4, text: '"He made me better." You both mean it. You shake hands like old friends.', tone: 'good'}},
    {id: 'no', label: 'Decline', hint: 'Some things don\'t heal.', eff: {hype: -1, text: 'You stay home. Some of the comments are harsh.'}}]}; }},
  {id: 'x-ref-rant', arc: 'x-rival', from: 'manager', when: c => c.history[0]?.result === 'L' && c.history[0]?.method === 'SPLIT DEC', build: c => ({title: 'The scorecards', text: `${P(c, 'manager')}: "One judge gave him every round. Every round! Do you want to say something?"`, options: [
    {id: 'rant', label: 'Blast the judges', hint: 'The fans agree. The commission doesn\'t.', eff: {hype: 6, money: -400 * (c.tier + 1), text: 'Your post-fight rant becomes a meme. The commission sends a letter.'}},
    {id: 'calm', label: '"I didn\'t do enough."', hint: 'Own it.', eff: {hype: 2, bond: {coach: 4}, text: 'You blame yourself. Your coach respects that more than any win.', tone: 'good'}}]})},
  {id: 'x-commentary', arc: 'x-media', from: 'manager', again: 160, when: c => !c.camp && c.tier >= 1 && c.hype >= 30, build: c => ({title: 'A night on the commentary desk', text: `${P(c, 'manager')}: "Their analyst is sick. They want you on the desk for Saturday's card. Headset, suit, live TV."`, options: [
    {id: 'yes', label: 'Do the broadcast', hint: '+money, +hype, a lost weekend.', eff: {money: 700 * (c.tier + 1), hype: 5, energy: -6, text: 'You call a knockout live and your voice cracks. The clip is everywhere.', tone: 'good'}},
    {id: 'no', label: 'Stay a fighter', hint: 'Not your job.', eff: {bond: {coach: 2}, text: 'You watch the card from your couch and yell at the TV instead.'}}]})},
  {id: 'x-champ-parade', arc: 'x-rival', from: 'brother', when: c => c.champ, build: c => ({title: 'A parade at home', text: `${P(c, 'brother')}: "The town wants to do a parade for you. Open-top bus. Mum has already bought a hat."`, options: [
    {id: 'yes', label: 'Do the parade', hint: 'Huge hype. A lost week of training.', eff: {hype: 10, energy: -10, followers: 15000, bond: {brother: 6}, text: 'Thousands of people. A kid holds up a cardboard belt. You lose it.', tone: 'big'}},
    {id: 'later', label: 'After my next defense', hint: 'Stay focused.', eff: {bond: {brother: -3}, text: 'Mum keeps the hat in its box.'}}]})},
  {id: 'x-mentor-legend', arc: 'x-rival', from: 'Message', when: c => c.champ && c.defenses >= 2, build: () => ({title: 'A message from a former champ', text: '"I held that belt for four years. The hardest part isn\'t the fights. It\'s staying hungry when you have everything. Call me if you ever need to talk."', options: [
    {id: 'call', label: 'Call him', hint: 'Advice from someone who\'s been there.', eff: {stat: [['iq', 2]], health: 5, text: 'Two hours on the phone. He tells you about the fight he never got over.', tone: 'good'}},
    {id: 'thanks', label: 'Say thanks', hint: 'Maybe later.', eff: {text: 'You save his number. You think about the message a lot.'}}]})},
  {id: 'x-charity', arc: 'x-fans', from: 'manager', again: 180, when: c => c.record[0] >= 3, build: c => ({title: 'A charity clinic', text: `${P(c, 'manager')}: "A kids' charity wants you to run a free seminar. No money, a lot of goodwill."`, options: [
    {id: 'yes', label: 'Run the clinic', hint: '+hype, costs energy.', eff: {energy: -8, hype: 5, followers: 3000, text: 'Forty kids, one sweaty afternoon. Half of them sign up at a gym.', tone: 'good'}},
    {id: 'donate', label: 'Donate instead', hint: 'Costs money.', eff: {money: -500 * (c.tier + 1), hype: 2, text: 'You send a cheque and a signed glove for their auction.'}}]})},
  {id: 'x-lost-bag', arc: 'x-life', from: 'coach', when: c => !!c.camp && c.camp.weeksLeft <= 1, build: c => ({title: 'The airline lost your bag', text: `${P(c, 'coach')}: "Your gloves, your mouthguard, your lucky shorts. Gone. Fight's in four days."`, options: [
    {id: 'buy', label: 'Buy everything new', hint: 'Costs money.', eff: {money: -400 * (c.tier + 1), text: 'New gear, new mouthguard moulded in a hotel kettle. It works.'}},
    {id: 'borrow', label: 'Borrow from a teammate', hint: 'Superstitious? Hm.', roll: .7, win: {hype: 1, text: 'His shorts are a size too big. Nobody notices but you.'}, lose: {fitness: -3, text: 'His mouthguard doesn\'t fit. You don\'t sleep well.'}}]})},
];
