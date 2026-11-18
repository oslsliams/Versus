// VERSUS broadcast voice: two (fictional) commentators call the fight live, the corners talk between
// rounds, the announcer introduces the fighters, and the post-fight package writes the headline and quotes.
// Pure functions over the fight state so it stays testable.
import type {FightEvent, LiveFight} from './engine';
import type {FightCard} from './tape';

export const VOICES = {pbp: 'ROWAN', color: 'VEGA'} as const;
export type Line = {who: keyof typeof VOICES; text: string};

const last = (n: string) => n.trim().split(/\s+/).pop()!;
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

const L = {
  hit: ['Clean shot from {a}!', '{a} lands flush.', 'That one snapped {d}\'s head back.', '{a} finds a home for that.', 'Good counter from {a}.', '{d} ate that one.'],
  bigHit: ['OH! {a} rocks {d}!', 'HUGE shot from {a}!', '{d} felt that all the way down to his toes!', 'Massive right hand from {a}!'],
  hurt: ['{a} HURTS HIM! {d} is on wobbly legs!', 'He\'s rocked! {d} is in serious trouble here!', '{d} is out on his feet! Can {a} finish it?', 'OH, {d} is HURT! Grabbing, covering, anything to survive!'],
  body: ['Thudding shot to the body from {a}.', '{a} digs one into the liver. You hear that one.', 'Investing in the body, {a}. That pays off late.', 'Right to the ribs! {d} didn\'t like that.'],
  legs: ['Chopping leg kick from {a}.', '{d}\'s lead leg is turning red.', '{a} keeps going back to that leg.', 'Calf kick lands. Watch {d}\'s stance now.'],
  check: ['{d} checks it! Shin on shin, that hurt {a} more.', 'Checked! {a} won\'t be throwing many more of those.'],
  combo: ['{a} putting it together now, {n} in a row!', 'Beautiful combination from {a}!', '{a} is stringing them together!', '{n} shots in a row, textbook stuff from {a}.'],
  block: ['{d} takes it on the arms.', 'Good defence from {d}.', '{d} with the high guard, nothing clean there.'],
  whiff: ['{a} swings and misses.', 'Just short from {a}.', '{d} slips it.', 'Too slow, {d} saw that coming.'],
  kd: ['DOWN GOES {D}!', '{a} DROPS HIM!', 'KNOCKDOWN! {d} is hurt!'],
  ko: ['IT IS ALL OVER! {A} PUTS {D} AWAY!', 'GOODNIGHT! {a} with the knockout!', 'THE REFEREE WAVES IT OFF! {A}!'],
  td: ['{a} changes levels... TAKEDOWN!', 'And {a} gets him down!', 'Double leg from {a}, beautiful timing.', '{a} drags it to the mat.'],
  sprawl: ['{d} reads the shot and sprawls!', 'Great takedown defence from {d}.', '{d} stuffs it! {a} is left on his knees.'],
  sub: ['{a} is hunting for the finish! {s}', 'Oh, this is deep! {s}', '{s} {d} is in trouble!'],
  escape: ['{d} fights out of it!', 'What a scramble from {d}!', '{d} is back to his feet. The crowd loves it.'],
  tap: ['HE TAPS! {A} WINS BY SUBMISSION!', 'IT\'S OVER! {a} gets the tap!'],
  tired: ['{d} is breathing heavy. The gas tank is running low.', 'You can see it, {d} is fading.', '{d}\'s hands are dropping. He\'s exhausted.'],
  quiet: ['Both men feeling each other out.', 'Lots of feints, not much landing.', 'Measuring distance in the centre of the cage.', 'Somebody has to let their hands go here.', 'The crowd wants more action.'],
  pressure: ['{a} walking him down, {d} looking for an exit.', '{a} has {d} on the back foot.', '{a} owning the centre of the octagon.'],
  roundStart: ['Round {r}. {lead}', 'Here we go, round {r}. {lead}', 'Round {r} underway. {lead}'],
  clock: ['One minute left in the round.', 'Thirty seconds to go!', 'Ten seconds! Big finish here!'],
};
const COLOR = {
  dominant: ['{a} is just a level above tonight.', 'This is a clinic from {a}.', '{d} needs something drastic.'],
  close: ['This is a close one. The judges have a job here.', 'Could go either way on the cards.'],
  grappling: ['{a} wants this on the ground, that\'s his world.', 'The wrestling is the story of this fight.'],
  limping: ['{d} is limping. Those leg kicks are adding up.', 'Look at {d}\'s lead leg. He can\'t plant on it.'],
  winded: ['{d} is breathing through his mouth. The body work is paying off.', 'The body shots are taking {d}\'s legs and his gas tank.'],
  worn: ['{d} has taken a lot of damage. One clean shot could end it.', 'You can see it on {d}\'s face. That\'s accumulated damage.'],
};

/** live play-by-play: call fight events (rate-limited) and fill quiet moments */
export class Commentator {
  private cool = 0; private quiet = 0; private lastRound = 0; private clockFlags = new Set<string>();
  private streak = [0, 0]; private streakT = [0, 0]; private tiredFlag = [false, false];
  private names: [string, string];
  constructor(names: [string, string]) { this.names = names; }
  private v(side: 0 | 1) { const a = this.names[side], d = this.names[side ? 0 : 1]; return {a: last(a), d: last(d), A: last(a).toUpperCase(), D: last(d).toUpperCase()}; }

  feed(g: LiveFight, events: FightEvent[], dt: number): Line | null {
    this.cool -= dt; this.quiet += dt; this.streakT[0] -= dt; this.streakT[1] -= dt;
    if (this.streakT[0] <= 0) this.streak[0] = 0; if (this.streakT[1] <= 0) this.streak[1] = 0;
    let best: {line: Line; pri: number} | null = null;
    const say = (pri: number, pool: string[], vars: Record<string, string>, who: Line['who'] = 'pbp') => { if (!best || pri > best.pri) best = {line: {who, text: fill(pick(pool), vars)}, pri}; };
    for (const e of events) {
      const s = e.side as 0 | 1, vv = this.v(s);
      if (e.type === 'hit') {
        this.streak[s] += 1; this.streakT[s] = 1.4; this.streak[s ? 0 : 1] = 0;
        if (this.streak[s] >= 3) say(5, L.combo, {...vv, n: String(this.streak[s])});
        else if (e.target === 'body') say(2.5, L.body, vv);
        else if (e.target === 'legs') say(2.5, L.legs, vv);
        else if (e.power > .75) say(6, L.bigHit, vv); else say(2, L.hit, vv);
      } else if (e.type === 'hurt') say(8.5, L.hurt, vv);
      else if (e.type === 'block' && e.target === 'legs') say(4, L.check, {...this.v(s ? 0 : 1)});
      else if (e.type === 'block') say(1, L.block, this.v(s ? 0 : 1));
      else if (e.type === 'whiff') say(.5, L.whiff, vv);
      else if (e.type === 'kd') say(9, L.kd, vv);
      else if (e.type === 'ko') say(10, L.ko, vv);
      else if (e.type === 'td') say(7, L.td, vv);
      else if (e.type === 'sprawl') say(6, L.sprawl, {...this.v(s ? 0 : 1)});
      else if (e.type === 'sub') say(8, L.sub, {...vv, s: e.text ?? ''});
      else if (e.type === 'escape') say(5, L.escape, {...vv, d: vv.a, D: vv.A});
      else if (e.type === 'tap') say(10, L.tap, vv);
    }
    // round starts, clock calls, fatigue, and filling the silence
    if (g.phase === 'fight' && g.round !== this.lastRound) {
      this.lastRound = g.round; this.clockFlags.clear();
      const [a, b] = g.f, diff = a.points - b.points;
      const lead = g.round === 1 ? 'Let\'s see who wants it more.' : Math.abs(diff) < 4 ? 'Dead even so far.' : `${last((diff > 0 ? a : b).name)} edged the last one.`;
      say(4, L.roundStart, {r: String(g.round), lead});
    }
    if (g.phase === 'fight') for (const [t, k] of [[60, '60'], [30, '30'], [10, '10']] as const) {
      if (g.clock <= t && g.clock > t - 1 && !this.clockFlags.has(k)) { this.clockFlags.add(k); say(3, [L.clock[k === '60' ? 0 : k === '30' ? 1 : 2]], {}); }
    }
    g.f.forEach((f, i) => { if (f.stamina < 22 && !this.tiredFlag[i]) { this.tiredFlag[i] = true; say(3, L.tired, this.v(i ? 0 : 1), 'color'); } if (f.stamina > 50) this.tiredFlag[i] = false; });
    if (!best && this.quiet > 7 && g.phase === 'fight') {
      const [a, b] = g.f, lead = a.landed - b.landed;
      const hurtSide = g.f.findIndex(f => f.legs < 45), wind = g.f.findIndex(f => f.body < 40), worn = g.f.findIndex(f => f.cap < 60);
      if (hurtSide >= 0 && Math.random() < .5) say(1.5, COLOR.limping, this.v(hurtSide ? 0 : 1), 'color');
      else if (wind >= 0 && Math.random() < .5) say(1.5, COLOR.winded, this.v(wind ? 0 : 1), 'color');
      else if (worn >= 0 && Math.random() < .5) say(1.5, COLOR.worn, this.v(worn ? 0 : 1), 'color');
      else if (Math.abs(lead) > 12) say(1, COLOR.dominant, this.v(lead > 0 ? 0 : 1), 'color');
      else if (a.takedowns + b.takedowns >= 2) say(1, COLOR.grappling, this.v(a.takedowns >= b.takedowns ? 0 : 1), 'color');
      else if (Math.random() < .5) say(1, L.pressure, this.v(Math.random() < .5 ? 0 : 1));
      else say(1, L.quiet, {}, Math.random() < .5 ? 'pbp' : 'color');
    }
    if (!best) return null;
    const b2 = best as {line: Line; pri: number};
    if (b2.pri < 5 && this.cool > 0) return null;      // big moments always get called
    this.cool = b2.pri >= 8 ? 2.5 : 1.8; this.quiet = 0;
    return b2.line;
  }
}

/** between rounds: what the corner tells you (side 0 = the player) */
export function cornerAdvice(g: LiveFight, roundStart: {landed: [number, number]; td: [number, number]}): string[] {
  const [me, them] = g.f;
  const myL = me.landed - roundStart.landed[0], thL = them.landed - roundStart.landed[1];
  const tips: string[] = [];
  if (myL > thL + 4) tips.push(`That round was yours, ${myL} to ${thL} in strikes. Keep doing exactly that.`);
  else if (thL > myL + 4) tips.push(`He's outlanding you ${thL} to ${myL}. Move your head and make him miss.`);
  else tips.push('Close round. You need to do more to win the next one clearly.');
  if (me.cap < 60) tips.push('You\'ve taken real damage. Hands up, circle out, don\'t trade with him. One more clean shot and it\'s over.');
  else if (them.cap < 60) tips.push('He\'s hurt and it\'s not going away. Hooks and head kicks now, he can\'t take many more.');
  if (them.legs < 55) tips.push('His lead leg is gone. Keep kicking it (S + L), he can\'t move.');
  else if (me.legs < 55) tips.push('Check those leg kicks! Block as he kicks low.');
  if (them.body < 55) tips.push('The body work is landing. Keep digging (S + punch), his tank is going.');
  if (them.takedowns - roundStart.td[1] >= 1) tips.push('He keeps taking you down. Tap Shift the moment he shoots and sprawl.');
  else if (them.style === 'Wrestler' || them.style === 'Grappler') tips.push('Watch the level change. When he drops, sprawl.');
  else if (me.style === 'Wrestler' || me.style === 'Grappler') tips.push('Shoot when he throws. Duck under the punch and take him down.');
  if (me.stamina < 40) tips.push('Breathe. Pick your shots, don\'t waste energy swinging.');
  if (them.stamina < 40) tips.push('He\'s tired. Push the pace now.');
  return tips.slice(0, 3);
}

/** the announcer's introduction for the tale of the tape */
export function announce(card: FightCard): string {
  const y = card.you, o = card.opp;
  const champ = y.rank === 'C' ? y : o.rank === 'C' ? o : null;
  const chal = champ === y ? o : y;
  if (champ) return `${card.event}. Five rounds for the belt. The champion, ${champ.name}, ${champ.record}, puts the title on the line against ${chal.rank ? `the ${chal.rank} ranked` : 'the hungry'} ${chal.nickname ? `"${chal.nickname}" ` : ''}${chal.name}.`;
  const fav = y.fav ? y : o, dog = fav === y ? o : y;
  return `${card.billing} of ${card.event}. ${fav.name} comes in the ${fav.odds} favourite, but ${dog.nickname ? `"${dog.nickname}" ` : ''}${dog.name} (${dog.record}) has other plans.`;
}

/** post-fight package: headline and the winner's / loser's words */
export function verdict(card: FightCard, r: {winner: 'you' | 'opp' | 'draw'; method: string; round: number; how?: string}): {headline: string; quotes: [string, string][]} {
  if (r.winner === 'draw') return {headline: 'A DRAW! Nobody leaves happy tonight.', quotes: [[card.you.name, 'I thought I did enough. We run it back.'], [card.opp.name, 'Give me the rematch. Next time there\'s no doubt.']]};
  const w = r.winner === 'you' ? card.you : card.opp, l = r.winner === 'you' ? card.opp : card.you;
  const upset = !w.fav;
  const with_ = r.how ? ` with a${/^[aeiou]/i.test(r.how) ? 'n' : ''} ${r.how.toLowerCase()}` : '';
  const how = r.method === 'KO/TKO' ? (r.how === 'Leg kicks' ? `chops down ${last(l.name)} with leg kicks in round ${r.round}` : r.how === 'Ground and pound' ? `pounds out ${last(l.name)} in round ${r.round}` : r.how === 'Body shot' ? `folds ${last(l.name)} with a body shot in round ${r.round}` : `knocks out ${last(l.name)}${with_} in round ${r.round}`)
    : r.method === 'SUB' ? `submits ${last(l.name)}${with_} in round ${r.round}` : r.method === 'SPLIT DEC' ? `edges ${last(l.name)} on a split decision` : `outworks ${last(l.name)} over ${r.round} rounds`;
  const titleWin = !!card.title && w.rank !== 'C';
  const headline = (titleWin ? 'AND NEW! ' : upset ? 'UPSET! ' : '') + `${w.name} ${how}` + (titleWin ? ' to become champion.' : card.title ? ' and keeps the belt.' : '.');
  const wq = titleWin ? pick(['They said I wasn\'t ready. Look what\'s around my waist now.', 'This belt is mine and I\'m not giving it back.'])
    : r.method === 'KO/TKO' ? pick(['I told you I\'d put him to sleep.', 'I felt it land and I knew. Lights out.', 'I trained eight weeks for that one shot.'])
    : r.method === 'SUB' ? pick(['Once I got the grip, it was over.', 'I\'ve been drilling that for months.'])
    : pick(['It wasn\'t pretty but a win is a win.', 'He was tough, credit to him. I\'ll be better next time.']);
  const call = card.title && !titleWin ? 'Line them up. Who\'s next?' : 'I want a ranked opponent next. Give me a top five guy.';
  const lq = r.method === 'KO/TKO' ? pick(['He caught me. That\'s MMA.', 'I got careless for one second and paid for it.']) : r.method === 'SUB' ? pick(['I should have defended that better.', 'He\'s slick on the ground. I\'ll be back.']) : pick(['I thought I won that fight.', 'I\'ll go back to the gym and fix it.']);
  return {headline, quotes: [[w.name, `${wq} ${call}`], [l.name, lq]]};
}
