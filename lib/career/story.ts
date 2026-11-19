// VERSUS career mode: the people and the plot. Everything a player reads about their own life lives here:
// the named cast, story arcs that run for months and never repeat, the big-moment scenes and the ending.
// Only types come from the engine, so the engine can import this file without a cycle.
import type {Career, Division, LogEntry, StatKey, Stats, Style} from './engine';

/* ------------------------------------------------------------------ cast */
export type CastKey = 'coach' | 'manager' | 'brother' | 'friend' | 'partner';
export type Person = {name: string; short: string; role: string};
export type Cast = Record<CastKey, Person>;
export type Bonds = Record<CastKey, number>;
export const CAST_KEYS: CastKey[] = ['coach', 'manager', 'brother', 'friend', 'partner'];

const GYM_COACH: Record<string, [string, string]> = {
  ironside: ['Walt Brennan', 'Coach Brennan'], neon: ['Anan Srisuk', 'Kru Anan'],
  lockdown: ['Rafael Tavares', 'Professor Tavares'], apex: ['Imani Cole', 'Dr. Cole'],
};
const MANAGERS = ['Sal Moretti', 'Priya Raman', 'Deshawn Pike', 'Nadia Farouk', 'Gil Okonkwo'];
const BROTHERS = ['Mikey', 'Theo', 'Jonah', 'Nico', 'Eli', 'Sammy'];
const FRIENDS = ['Tariq', 'Deano', 'Rico', 'Big Lou', 'Marlon', 'Finn'];
const PARTNERS = ['Oskar Lund', 'Jamal Reed', 'Tevita Mahe', 'Lucas Prado', 'Ivan Dragomir', 'Callum Shaw'];

/** the same save always gets the same people */
export function makeCast(seed: number, gym?: string): Cast {
  const at = <T,>(xs: T[], salt: number) => xs[Math.abs(Math.imul(seed + salt, 2654435761) >> 7) % xs.length];
  const [coach, short] = GYM_COACH[gym ?? ''] ?? GYM_COACH.ironside;
  const manager = at(MANAGERS, 11), partner = at(PARTNERS, 41);
  return {
    coach: {name: coach, short, role: 'Head coach'},
    manager: {name: manager, short: manager.split(' ')[0], role: 'Manager'},
    brother: {name: at(BROTHERS, 23), short: at(BROTHERS, 23), role: 'Little brother'},
    friend: {name: at(FRIENDS, 31), short: at(FRIENDS, 31), role: 'Best friend'},
    partner: {name: partner, short: partner.split(' ')[0], role: 'Training partner'},
  };
}
export const startBonds = (): Bonds => ({coach: 55, manager: 50, brother: 65, friend: 60, partner: 50});

/* --------------------------------------------------------------- effects */
export type Eff = {hype?: number; money?: number; energy?: number; health?: number; fitness?: number; followers?: number; stat?: [StatKey, number][]; injury?: number; heat?: number; coach?: number;
  bond?: Partial<Bonds>; flag?: string; pay?: number; freeze?: number; partnerFight?: boolean; brokenHand?: boolean; pullOut?: boolean; text: string; tone?: LogEntry['tone']; post?: [string, string, number]};
export type Opt = {id: string; label: string; hint: string} & ({eff: Eff} | {roll: number; win: Eff; lose: Eff});
export type Built = {title: string; text: string; options: Opt[]; target?: string};
/** one message in a story. Beats in the same arc play in order, with `gap` weeks between them; `again` allows a repeat after that many weeks */
export type Beat = {id: string; arc: string; from: CastKey | string; gap?: number; again?: number; when: (c: Career) => boolean; build: (c: Career, r: () => number, target?: string) => Built};

export const has = (c: Career, f: string) => (c.flags ?? []).includes(f);
const P = (c: Career, k: CastKey) => (c.cast as Cast)[k];
const T = (c: Career, xs: [number, number, number]) => xs[c.tier];
const usd = (n: number) => '$' + Math.round(n).toLocaleString();
const firstName = (s: string) => s.split(' ')[0];
const fights = (c: Career) => c.record[0] + c.record[1] + c.record[2];
export const handleOf = (name: string) => name.replace(/[^A-Za-z]/g, '').slice(0, 14) + (name.length % 3 === 0 ? 'MMA' : name.length % 3 === 1 ? '_' + (10 + name.length * 7 % 89) : 'Official');

/* ----------------------------------------------------------------- beats */
export const BEATS: Beat[] = [
  /* your brother */
  {id: 'bro-debut', arc: 'brother', from: 'brother', when: c => c.week >= 5, build: c => { const b = P(c, 'brother').short; return {title: `${b}'s first fight`, text: `"It's Saturday, three hours away. I know you're busy. I just want you in my corner."`, options: [
    {id: 'yes', label: 'Be in his corner', hint: 'Costs energy. He will remember this.', eff: {energy: -14, hype: 3, health: 5, bond: {brother: 14}, flag: 'cornered-brother', text: `${b} wins in the second round. You cry more than he does.`, tone: 'good'}},
    {id: 'no', label: 'Stay and train', hint: 'Fitness up. He will remember this too.', eff: {fitness: 4, bond: {brother: -14}, flag: 'missed-brother', text: `${b} loses on points. You find out from Instagram.`, tone: 'bad'}}]}; }},
  {id: 'bro-crossroads', arc: 'brother', from: 'brother', gap: 30, when: () => true, build: c => { const b = P(c, 'brother').short; const cost = T(c, [500, 3000, 15000]);
    if (has(c, 'missed-brother')) return {title: `${b} has gone quiet`, text: `Your mum texts: "${b} still hasn't got over you missing that fight. Call him. Please."`, options: [
      {id: 'call', label: 'Call and apologise', hint: 'Swallow your pride.', eff: {energy: -4, bond: {brother: 18}, flag: 'made-up', text: `Two hours on the phone. By the end ${b} is laughing at you again.`, tone: 'good'}},
      {id: 'send', label: `Send him ${usd(cost)}`, hint: 'Money is easier than sorry.', eff: {money: -cost, bond: {brother: -5}, text: `${b} sends the money straight back. No message.`, tone: 'bad'}}]};
    return {title: `${b} wants to go full time`, text: `"I'm 3-0. I want to quit the warehouse and train properly. Mum says no. What do you say?"`, options: [
      {id: 'back', label: `Back him with ${usd(cost)}`, hint: 'He moves into your gym.', eff: {money: -cost, bond: {brother: 10}, flag: 'backed-brother', text: `${b} hands in his notice and turns up at the gym with one bag.`, tone: 'good'}},
      {id: 'job', label: 'Tell him to keep the job', hint: 'The sensible answer. He will not like it.', eff: {bond: {brother: -6}, flag: 'brother-job', text: `"Easy for you to say." ${b} keeps the job.`}}]}; }},
  {id: 'bro-injury', arc: 'brother', from: 'Mum', gap: 45, when: c => c.tier >= 1, build: c => { const b = P(c, 'brother').short; return {title: `${b} got knocked out`, text: `${b} was out cold for nearly a minute last night. The doctor says he should stop. He says he will only listen to you.`, options: [
    {id: 'stop', label: 'Tell him to stop', hint: 'Hardest call you have made.', eff: {energy: -8, bond: {brother: 6}, flag: 'brother-stopped', text: `${b} hangs up his gloves. He asks to work your corner instead.`, tone: 'big'}},
    {id: 'choice', label: 'Say it is his choice', hint: 'Respect him. Risk him.', roll: .5, win: {bond: {brother: 10}, flag: 'brother-fights', text: `${b} takes a year off and comes back healthy. The scans are clean.`, tone: 'good'}, lose: {bond: {brother: -4}, energy: -10, flag: 'brother-stopped', text: `${b} gets hurt again in sparring. This time he stops for good.`, tone: 'bad'}}]}; }},
  {id: 'bro-walk', arc: 'brother', from: 'brother', gap: 40, when: c => c.tier === 2, build: c => { const b = P(c, 'brother').short; const close = (c.bonds?.brother ?? 50) >= 45; return {title: close ? 'The big show' : 'A text out of nowhere', text: close ? `"You actually made it. Let me carry the flag on your walkout. Just once."` : `"Saw you made the big show. Proud of you. That's all."`, options: [
    {id: 'yes', label: close ? 'He walks out with you' : 'Invite him to the fight', hint: 'Family first.', eff: {hype: 4, bond: {brother: 16}, flag: 'brother-walks', text: `${b} is in your walkout crew from now on.`, tone: 'big'}},
    {id: 'no', label: close ? 'Keep the walkout tight' : 'Leave it on read', hint: 'Focus.', eff: {fitness: 3, bond: {brother: -10}, text: `${b} watches from home.`}}]}; }},

  /* your coach */
  {id: 'coach-hill', arc: 'coach', from: 'coach', when: c => c.week >= 3, build: c => ({title: '5am. The hill.', text: `"Every morning this week. Nobody is watching up there. That's the point."`, options: [
    {id: 'yes', label: 'Every morning', hint: 'Cardio up, tiring.', eff: {stat: [['cardio', 1.2]], energy: -15, fitness: 5, bond: {coach: 8}, flag: 'did-the-hill', text: `Seven sunrises. On the last one ${P(c, 'coach').short} brings you a coffee and says nothing.`, tone: 'good'}},
    {id: 'no', label: 'Sleep in', hint: 'Rested. Disappointing.', eff: {energy: 10, bond: {coach: -7}, text: `${P(c, 'coach').short} doesn't mention it. That's worse.`}}]})},
  {id: 'coach-plan', arc: 'coach', from: 'coach', gap: 26, when: c => fights(c) >= 3, build: c => ({title: '"Sit down. Watch this."', text: `${P(c, 'coach').short} pauses your last fight on the same mistake, four times. "You keep doing this. We fix it now, or someone better fixes it for us."`, options: [
    {id: 'listen', label: 'Rebuild the habit', hint: 'Fight IQ up. Slow, boring weeks.', eff: {stat: [['iq', 1.8]], energy: -8, bond: {coach: 10}, text: 'Three hundred reps a day until it is gone.', tone: 'good'}},
    {id: 'argue', label: '"It is working, isn\'t it?"', hint: 'Keep your style. Damage the trust.', eff: {hype: 2, bond: {coach: -10}, flag: 'argued-coach', text: `${P(c, 'coach').short} turns off the screen and leaves the room.`, tone: 'bad'}}]})},
  {id: 'coach-poached', arc: 'coach', from: 'manager', gap: 36, when: c => c.tier >= 1, build: c => { const cost = T(c, [800, 5000, 30000]); const co = P(c, 'coach').short; return {title: `They want ${co}`, text: `Titan Fight Lab has offered ${co} triple money to run their camp. Nobody has said no yet.`, options: [
    {id: 'pay', label: `Match it (${usd(cost)})`, hint: 'Keep your corner together.', eff: {money: -cost, bond: {coach: 14}, flag: 'kept-coach', text: `${co} tears up the offer in front of you and tells you to get back to work.`, tone: 'good'}},
    {id: 'ask', label: 'Ask as a friend', hint: 'Free, if you have earned it.', roll: .6, win: {bond: {coach: 8}, flag: 'kept-coach', text: `"You think I'd leave before we finish this?" ${co} stays.`, tone: 'good'}, lose: {bond: {coach: -14}, coach: 0, energy: -8, text: `${co} takes a month at Titan before coming back. Things are different now.`, tone: 'bad'}}]}; }},
  {id: 'coach-scare', arc: 'coach', from: 'manager', gap: 45, when: c => c.tier === 2, build: c => { const co = P(c, 'coach').short; return {title: `${co} is in hospital`, text: `${co} collapsed at the gym this morning. Stable, but the doctors are worried about the heart.`, options: [
    {id: 'go', label: 'Drop everything and go', hint: 'Lose a week of work.', eff: {energy: -10, fitness: -6, bond: {coach: 18}, flag: 'sat-with-coach', text: `You sleep in a plastic chair for three nights. "You've got a fight to train for," ${co} croaks. You stay anyway.`, tone: 'big'}},
    {id: 'train', label: 'Train. It is what they would want.', hint: 'Fitness up.', eff: {fitness: 6, bond: {coach: -12}, text: `You send flowers and hit the pads alone. The gym has never felt so quiet.`, tone: 'bad'}}]}; }},
  {id: 'coach-last', arc: 'coach', from: 'coach', gap: 30, when: c => c.age >= 33, build: c => ({title: '"How much is left?"', text: `${P(c, 'coach').short} shuts the office door. "I've watched you since you were 21. Be honest with me. How much is left?"`, options: [
    {id: 'more', label: '"Enough for one more run."', hint: 'Fight IQ up. All in.', eff: {stat: [['iq', 1.5]], bond: {coach: 8}, flag: 'one-more-run', text: '"Then we do it properly."', tone: 'big'}},
    {id: 'dunno', label: '"I don\'t know anymore."', hint: 'Honest. Rest and recover.', eff: {health: 15, energy: 15, bond: {coach: 12}, text: 'Neither of you says anything for a long time. It helps.'}}]})},

  /* your manager and your money */
  {id: 'mgr-ad', arc: 'manager', from: 'manager', when: c => c.hype >= 15, build: c => { const pay = T(c, [600, 4000, 25000]); return {title: 'Riptide Energy wants your face', text: `"Two days on set, ${usd(pay)}, and all you do is drink it and look angry. Say yes."`, options: [
    {id: 'yes', label: 'Do the shoot', hint: `+${usd(pay)}, followers. Costs fitness.`, eff: {money: pay, energy: -12, fitness: -4, followers: 3000, hype: 2, bond: {manager: 8}, text: 'The ad drops. Your mum has it as her ringtone.', tone: 'good'}},
    {id: 'no', label: 'Stay in the gym', hint: `${P(c, 'coach').short} approves.`, eff: {fitness: 3, bond: {coach: 5, manager: -5}, text: `${P(c, 'manager').short} sighs down the phone. ${P(c, 'coach').short} nods at you across the gym.`}}]}; }},
  {id: 'mgr-crypto', arc: 'manager', from: 'manager', gap: 20, when: c => c.hype >= 25, build: c => { const pay = T(c, [2500, 15000, 90000]); return {title: 'A sponsor nobody has heard of', text: `"CoinVault. ${usd(pay)} for a logo on your shorts. I looked into them. Sort of."`, options: [
    {id: 'take', label: 'Take the money', hint: 'Dice roll. It could come back on you.', roll: .55, win: {money: pay, flag: 'crypto-clean', text: 'The money clears. Nobody asks questions. Yet.', tone: 'good'}, lose: {money: pay / 2, hype: -9, flag: 'crypto-burned', text: 'CoinVault collapses within the month. Your shorts are in every article.', tone: 'bad'}},
    {id: 'no', label: 'Turn it down', hint: 'A little respect.', eff: {hype: 1, flag: 'crypto-refused', text: 'You turn it down.'}}]}; }},
  {id: 'mgr-crypto-after', arc: 'manager', from: 'manager', gap: 22, when: () => true, build: c => { const m = P(c, 'manager').short; const n = T(c, [1500, 9000, 50000]);
    if (has(c, 'crypto-burned')) return {title: `${m} wants to talk`, text: `"CoinVault was my call and it hurt you. I'll waive my cut on your next fight. Or tell me what you want."`, options: [
      {id: 'forgive', label: 'Forgive it', hint: 'Build trust.', eff: {money: Math.round(n / 3), bond: {manager: 14}, text: `${m} goes quiet, then says thanks. It is the first time you have heard that voice crack.`, tone: 'good'}},
      {id: 'pay', label: `Make ${m} pay ${usd(n)}`, hint: 'Take the cash. Lose the trust.', eff: {money: n, bond: {manager: -18}, text: 'The transfer lands. The phone calls get shorter.', tone: 'bad'}}]};
    if (has(c, 'crypto-clean')) return {title: 'Investigators are calling', text: `"CoinVault just went under. Investigators want the money it paid out, including yours."`, options: [
      {id: 'return', label: `Give back ${usd(n)}`, hint: 'Clean hands.', eff: {money: -n, hype: 3, bond: {manager: 5}, text: 'You return it publicly. The fans like that.', tone: 'good'}},
      {id: 'fight', label: 'Lawyer up', hint: 'Dice roll.', roll: .5, win: {text: 'The case goes nowhere. You keep it.', tone: 'good'}, lose: {money: -n * 1.5, hype: -6, text: 'You lose, and the legal bill is worse than the money.', tone: 'bad'}}]};
    return {title: 'You dodged one', text: `"Remember CoinVault? Gone. Every fighter who wore that logo is getting dragged. You were right."`, options: [
      {id: 'gloat', label: 'Screenshot it', hint: 'Small hype bump.', eff: {hype: 3, bond: {manager: 5}, text: `${m} frames the rejection email for the office.`, tone: 'good'}}]}; }},
  {id: 'mgr-contract', arc: 'contract', from: 'manager', again: 70, when: c => c.tier >= 1 && (c.streak ?? 0) >= 2 && (c.payBump ?? 1) < 1.4, build: c => ({title: 'Contract talks', text: `"You're on a streak, so they called me first. I can sign today, or we can make them sweat."`, options: [
    {id: 'sign', label: 'Sign the extension', hint: 'Purses +15% from now on.', eff: {pay: 1.15, bond: {manager: 4}, text: 'New deal signed. Purses up 15%.', tone: 'good'}},
    {id: 'hold', label: 'Hold out for more', hint: 'Dice roll: +35%, or no offers for a month.', roll: .5, win: {pay: 1.35, hype: 3, bond: {manager: 8}, text: 'They blink. Purses up 35%.', tone: 'big'}, lose: {freeze: 4, hype: -4, text: 'The promotion goes quiet. No offers for a while.', tone: 'bad'}}]})},
  {id: 'mgr-poach', arc: 'manager', from: 'A superagent', gap: 40, when: c => c.tier === 2, build: c => { const m = P(c, 'manager').short; return {title: 'A number on a napkin', text: `A superagent slides into your DMs. "${m} got you this far. I can get you 12% more. Think about it."`, options: [
    {id: 'loyal', label: `Stay with ${m}`, hint: 'Loyalty. No extra money.', eff: {bond: {manager: 16}, flag: 'loyal-manager', text: `You forward the message to ${m} with one word: "Funny."`, tone: 'good'}},
    {id: 'squeeze', label: `Make ${m} match it`, hint: 'Purses +10%. It costs you something else.', eff: {pay: 1.1, bond: {manager: -16}, text: `${m} matches it. Neither of you mentions it again.`}}]}; }},
  {id: 'money-house', arc: 'legacy', from: 'manager', when: c => c.tier === 2 && c.money >= 450000, build: c => ({title: 'The house on the hill', text: `"Your mum still works nights. There is a house near your brother. ${usd(350000)}, cash. Say the word."`, options: [
    {id: 'buy', label: 'Buy your parents the house', hint: `-${usd(350000)}. Worth it.`, eff: {money: -350000, bond: {brother: 14}, flag: 'bought-house', text: 'Your mum makes you carry her over the doorstep. Nobody in the family is okay for days.', tone: 'big'}},
    {id: 'wait', label: 'Not yet', hint: 'Keep the money working.', eff: {text: 'You tell yourself next year.'}}]})},
  {id: 'money-gym', arc: 'legacy', from: 'coach', gap: 30, when: c => c.tier === 2 && c.money >= 1600000, build: c => ({title: 'The gym is being sold', text: `${P(c, 'coach').short} sits you down. "The landlord wants ${usd(1200000)} or it becomes flats. This is where you learned everything."`, options: [
    {id: 'buy', label: 'Buy the gym', hint: `-${usd(1200000)}. All training gains +10% for life.`, eff: {money: -1200000, bond: {coach: 20}, flag: 'owns-gym', text: 'Your name goes on the deed. You keep the broken clock on the wall.', tone: 'big'}},
    {id: 'no', label: 'Let it go', hint: 'Keep your money.', eff: {bond: {coach: -16}, text: 'They start knocking it down in the spring. You drive the long way round.', tone: 'bad'}}]})},

  /* your best friend */
  {id: 'friend-birthday', arc: 'friend', from: 'friend', when: c => c.week >= 8, build: c => { const f = P(c, 'friend').short; return {title: `${f}'s birthday`, text: `"One drink. You never come out anymore. I'm starting to think you made up the whole fighting thing."`, options: [
    {id: 'go', label: 'Go out', hint: 'Dice roll: a good night, or photos leak.', roll: .65, win: {energy: 8, health: 4, bond: {friend: 12}, text: 'One drink turns into a great night. You needed that.', tone: 'good'}, lose: {hype: -5, fitness: -8, energy: -10, bond: {friend: 6, coach: -8}, text: `A photo of you at 3am gets to ${P(c, 'coach').short} before you wake up.`, tone: 'bad'}},
    {id: 'stay', label: 'Stay in', hint: 'Fitness up.', eff: {fitness: 3, bond: {friend: -8}, text: `You send a voice note and go to bed at nine. ${f} doesn't reply.`}}]}; }},
  {id: 'friend-loan', arc: 'friend', from: 'friend', gap: 28, when: c => c.money >= T(c, [1200, 5000, 25000]), build: c => { const f = P(c, 'friend').short; const n = T(c, [800, 4000, 20000]); return {title: `${f} needs a favour`, text: `"I found a food truck. ${usd(n)} and it's mine. I'll pay you back, swear on my life."`, options: [
    {id: 'lend', label: `Lend him ${usd(n)}`, hint: 'He has always been there for you.', eff: {money: -n, bond: {friend: 12}, flag: 'lent-friend', text: `${f} sends you forty photos of a dented van.`, tone: 'good'}},
    {id: 'no', label: 'Say no', hint: 'Keep the money.', eff: {bond: {friend: -12}, text: `"Yeah. No, I get it." You can hear that ${f} doesn't.`, tone: 'bad'}}]}; }},
  {id: 'friend-truck', arc: 'friend', from: 'friend', gap: 40, when: c => has(c, 'lent-friend'), build: c => { const f = P(c, 'friend').short; const n = T(c, [1600, 8000, 40000]); return {title: 'About that money', text: `"Come to the car park on Saturday. Bring your appetite."`, options: [
    {id: 'go', label: 'Go and see him', hint: 'Dice roll.', roll: .6, win: {money: n, bond: {friend: 14}, flag: 'truck-made-it', text: `There's a queue round the block, your face on the side of the van, and an envelope with double your money in it.`, tone: 'big'}, lose: {bond: {friend: 4}, energy: -3, flag: 'truck-failed', text: `The truck is gone. ${f} cooks you dinner at home and can't look at you. You tell him to forget the money.`, tone: 'bad'}}]}; }},

  /* your training partner */
  {id: 'partner-rounds', arc: 'partner', from: 'partner', when: c => c.week >= 7, build: c => { const p = P(c, 'partner').short; return {title: 'Thursday rounds', text: `"Five hard rounds. Don't you dare go easy on me this time."`, options: [
    {id: 'hard', label: 'Go to war', hint: 'Dice roll: big gains, or a week out.', roll: .62, win: {stat: [['striking', 1.3], ['iq', .8]], energy: -15, bond: {partner: 12}, text: `You and ${p} leave blood on the mat and share a bag of ice afterwards.`, tone: 'good'}, lose: {health: -16, injury: 1, energy: -15, bond: {partner: 6}, text: `${p} cracks your ribs and drives you to the hospital himself.`, tone: 'bad'}},
    {id: 'light', label: 'Drill technique', hint: 'Safe, small gain.', eff: {stat: [['iq', .5]], bond: {partner: -3}, text: `${p} rolls his eyes, then drills with you anyway.`}}]}; }},
  {id: 'partner-signed', arc: 'partner', from: 'manager', gap: 30, when: c => c.tier >= 1 && c.tier < 2 || (c.tier === 2 && !c.champ), build: c => { const p = P(c, 'partner'); return {title: `They want you to fight ${p.short}`, text: `${p.name} just signed with your league, and the matchmakers have noticed you share a gym. They will pay well for this one.`, options: [
    {id: 'refuse', label: 'Refuse. He is my brother.', hint: 'Loyalty. You will never fight him.', eff: {bond: {partner: 18}, flag: 'refused-partner', text: `You tell them no on the record. ${p.short} doesn't say anything. He just shows up early to hold pads.`, tone: 'good'}},
    {id: 'accept', label: 'Business is business', hint: 'He becomes a grudge fight. The gym will split.', eff: {hype: 7, bond: {partner: -30, coach: -6}, flag: 'fight-partner', partnerFight: true, text: `${p.short} clears out his locker. The fight is the biggest thing in your league.`, tone: 'big', post: ['@MMAWire', `Former training partners, now enemies. ${p.name} wants his fight.`, 6000]}}]}; }},
  {id: 'partner-end', arc: 'partner', from: 'partner', gap: 50, when: c => has(c, 'refused-partner') || c.history.some(h => h.opponentId === c.partnerId), build: c => { const p = P(c, 'partner').short;
    if (has(c, 'refused-partner')) return {title: 'Thank you', text: `"I never said it. When you turned that money down, I knew what this was. I'm retiring. Let me help you finish this."`, options: [
      {id: 'yes', label: 'Bring him into camp', hint: 'Training gains up for 10 weeks.', eff: {coach: 10, bond: {partner: 10}, flag: 'partner-in-camp', text: `${p} is your head sparring partner now, and he still doesn't go easy.`, tone: 'good'}}]};
    return {title: `${p} is at the door`, text: `${p} is outside your gym for the first time since the fight. "I'm not here to fight. Can we talk?"`, options: [
      {id: 'talk', label: 'Let him in', hint: 'Some things are bigger.', eff: {bond: {partner: 30}, flag: 'partner-forgiven', text: `Neither of you apologises. You both just wrap your hands.`, tone: 'big'}},
      {id: 'shut', label: 'Close the door', hint: 'It stays finished.', eff: {bond: {partner: -15}, text: `You watch him walk back to his car.`, tone: 'bad'}}]}; }},

  /* where you came from */
  {id: 'bs-w1', arc: 'backstory', from: 'Coach Hank', when: c => c.backstory === 'wrestler' && c.week >= 10, build: () => ({title: 'Your college wants you back', text: `"The team has a banquet. These kids watch your fights. Five minutes on stage is all I'm asking."`, options: [
    {id: 'go', label: 'Give the speech', hint: 'Hype up, a day lost.', eff: {hype: 4, energy: -5, flag: 'bs-1', text: 'You forget your speech and tell them about your first cut to make weight. They love it.', tone: 'good'}},
    {id: 'no', label: 'Stay in camp', hint: 'Wrestling up.', eff: {stat: [['wrestling', .8]], text: 'Coach Hank says he understands, in the voice that means he does not.'}}]})},
  {id: 'bs-w2', arc: 'backstory', from: 'Coach Hank', gap: 45, when: c => c.backstory === 'wrestler' && c.tier >= 1, build: () => ({title: 'The national trials', text: `"You still shoot better than anyone I've coached. Come and wrestle at the trials. One weekend."`, options: [
    {id: 'go', label: 'Go back to the mat', hint: 'Dice roll: big wrestling gains, or a tweaked knee.', roll: .65, win: {stat: [['wrestling', 2.2]], hype: 5, text: 'You take bronze against kids ten years fresher. Coach Hank cries in the bleachers.', tone: 'big'}, lose: {injury: 2, health: -12, text: 'Your knee goes in the second match.', tone: 'bad'}},
    {id: 'no', label: 'That chapter is closed', hint: 'Nothing changes.', eff: {text: 'You put the singlet back in the box.'}}]})},
  {id: 'bs-s1', arc: 'backstory', from: 'The old crew', when: c => c.backstory === 'street' && c.week >= 10, build: c => { const n = T(c, [900, 5000, 25000]); return {title: 'One more car park', text: `"There's a guy from across town talking about you. ${usd(n)} cash, Friday night, no ref. For old times."`, options: [
    {id: 'go', label: 'Show up', hint: 'Dice roll: cash and a legend, or a scandal.', roll: .6, win: {money: n, hype: 5, stat: [['power', .8]], text: 'It lasts nine seconds. Someone films it. Of course someone films it.', tone: 'good'}, lose: {hype: -7, health: -14, bond: {coach: -8}, text: 'The police arrive before the second punch. Your promotion is not amused.', tone: 'bad'}},
    {id: 'no', label: 'I left that behind', hint: `${P(c, 'coach').short} hears about it. Respect.`, eff: {bond: {coach: 8}, flag: 'left-streets', text: 'You delete the number.', tone: 'good'}}]}; }},
  {id: 'bs-s2', arc: 'backstory', from: 'A stranger', gap: 50, when: c => c.backstory === 'street' && c.tier >= 1, build: () => ({title: 'The guy from your knockout reel', text: `"You don't know my name. You knocked me out on that video when I was 19. I've got a son who wants to learn. Would you teach him?"`, options: [
    {id: 'yes', label: 'Teach the kid', hint: 'Hype up, heart full.', eff: {hype: 6, health: 6, flag: 'bs-2', text: 'The kid has a better jab than his dad. You tell them both.', tone: 'big'}},
    {id: 'no', label: 'Send him to the gym', hint: 'Keep your distance.', eff: {text: 'You send over the address and a free month.'}}]})},
  {id: 'bs-k1', arc: 'backstory', from: 'The federation', when: c => c.backstory === 'kickboxer' && c.week >= 10, build: c => { const n = T(c, [1000, 6000, 30000]); return {title: 'Defend your old title', text: `Your national kickboxing belt is still technically yours. They will pay ${usd(n)} for one last defence.`, options: [
    {id: 'go', label: 'One last time', hint: 'Dice roll.', roll: .65, win: {money: n, stat: [['striking', 1.4]], hype: 4, text: 'You retire the belt on your own terms, in front of your old team.', tone: 'big'}, lose: {money: n / 2, hype: -4, health: -10, text: 'Five rounds of pure kickboxing and you lose on points. You had forgotten how good they are.', tone: 'bad'}},
    {id: 'no', label: 'Vacate it', hint: 'Fully committed to MMA.', eff: {bond: {coach: 5}, text: 'You post the belt back with a thank-you note.'}}]}; }},
  {id: 'bs-k2', arc: 'backstory', from: 'Your first trainer', gap: 50, when: c => c.backstory === 'kickboxer' && c.tier >= 1, build: () => ({title: 'The old pads', text: `"I still have the pads from your first title. Twenty years I've held them for kids. Sign them before I retire?"`, options: [
    {id: 'yes', label: 'Go back and hold pads for him', hint: 'Striking up.', eff: {stat: [['striking', 1]], hype: 2, flag: 'bs-2', text: 'He makes you do the whole warm-up first.', tone: 'good'}},
    {id: 'no', label: 'Post them back signed', hint: 'A kind gesture.', eff: {text: 'He hangs them on the wall.'}}]})},
  {id: 'bs-b1', arc: 'backstory', from: 'Your professor', when: c => c.backstory === 'bjj' && c.week >= 10, build: () => ({title: '"You stopped coming."', text: `"Black belt at 20 and now you hit bags all day. Come to the mat on Sunday. Bring your ego so I can take it."`, options: [
    {id: 'go', label: 'Go on Sunday', hint: 'Grappling up.', eff: {stat: [['grappling', 1.5]], energy: -6, flag: 'bs-1', text: 'He submits you four times and buys you lunch.', tone: 'good'}},
    {id: 'no', label: 'Too busy', hint: 'He will not ask twice.', eff: {fitness: 2, text: 'He does not ask twice.'}}]})},
  {id: 'bs-b2', arc: 'backstory', from: 'Your professor', gap: 50, when: c => c.backstory === 'bjj' && c.tier >= 1, build: () => ({title: 'A new stripe', text: `"You have represented this art in front of the world. Kneel down. Everyone is waiting."`, options: [
    {id: 'yes', label: 'Take the stripe', hint: 'Grappling and Fight IQ up.', eff: {stat: [['grappling', 1], ['iq', 1]], hype: 3, flag: 'bs-2', text: 'The whole academy whips you down the line. It is an honour. It really hurts.', tone: 'big'}}]})},
  {id: 'bs-l1', arc: 'backstory', from: 'Your old boss', when: c => c.backstory === 'late' && c.week >= 12, build: c => ({title: 'Your old desk is open', text: `"Salary, pension, dental. You've had your adventure. Come home."${c.record[1] > c.record[0] ? ' It lands in your inbox on a bad week.' : ''}`, options: [
    {id: 'no', label: 'Frame the email', hint: 'Hype and fire.', eff: {hype: 3, stat: [['cardio', .6]], flag: 'bs-1', text: 'It goes on the gym wall, right above the speed bag.', tone: 'good'}},
    {id: 'think', label: 'Think about it for a night', hint: 'Rest. An honest night.', eff: {energy: 15, text: 'You do the maths at 2am. In the morning you go to the gym anyway.'}}]})},
  {id: 'bs-l2', arc: 'backstory', from: 'The office group chat', gap: 50, when: c => c.backstory === 'late' && c.tier >= 1, build: () => ({title: 'Watch party', text: `Forty people from accounts have booked a pub for your next fight. They are asking for a video message.`, options: [
    {id: 'yes', label: 'Record one', hint: 'Hype up.', eff: {hype: 4, followers: 3000, flag: 'bs-2', text: 'They play it on the big screen. Brenda from payroll cries.', tone: 'good'}},
    {id: 'surprise', label: 'Turn up in person', hint: 'A night off camp.', eff: {energy: -6, hype: 7, text: 'You walk into the pub unannounced. Nobody from accounts does any work the next day.', tone: 'big'}}]})},

  /* the kid on the ward */
  {id: 'kid-ward', arc: 'kid', from: 'A nurse', when: c => c.tier >= 1, build: () => ({title: 'A message from a hospital', text: `"Leo is nine and he has your poster above his bed. He has a long treatment ahead. Any chance you could visit?"`, options: [
    {id: 'visit', label: 'Visit Leo', hint: 'A day out of the gym.', eff: {energy: -6, hype: 6, followers: 9000, flag: 'met-leo', text: 'You spend the afternoon teaching Leo to jab. You leave him your gloves.', tone: 'good'}},
    {id: 'video', label: 'Send a video', hint: 'Small bump.', eff: {hype: 2, text: 'His mum says he watched it fifty times.'}}]})},
  {id: 'kid-back', arc: 'kid', from: 'Leo', gap: 70, when: c => has(c, 'met-leo'), build: () => ({title: 'Do you remember me?', text: `A photo of a taller boy holding old gloves. "The doctors say I'm clear. Mum says I can come to a fight now."`, options: [
    {id: 'yes', label: 'Put him cage-side', hint: 'Some fights matter more.', eff: {hype: 8, followers: 20000, flag: 'leo-cageside', text: 'Leo is cage-side at your next fight, with the gloves on.', tone: 'big', post: ['@VERSUSofficial', 'He promised him a seat. He kept it.', 12000]}}]})},

  /* being famous */
  {id: 'fame-pod', arc: 'fame', from: 'manager', when: c => fights(c) >= 2, build: c => ({title: 'The long-form podcast', text: `"Three hours. They like to push buttons. It could make you, or it could be the clip they play forever."`, options: [
    {id: 'go', label: 'Go on', hint: 'Dice roll: usually great for hype.', roll: .75, win: {hype: 7, followers: 7000, energy: -6, text: `You end up talking about ${P(c, 'brother').short} for twenty minutes. That is the clip that goes viral.`, tone: 'good'}, lose: {hype: -5, energy: -6, text: 'You say something stupid about another fighter\'s family. It does not go well.', tone: 'bad', post: ['@MMAWire', 'Backlash after controversial podcast comments.', 2000]}},
    {id: 'pass', label: 'Pass', hint: 'Nothing happens.', eff: {text: 'You pass on the podcast.'}}]})},
  {id: 'fame-stream', arc: 'fame', from: 'manager', gap: 30, when: c => c.hype >= 20, build: () => ({title: 'Streamer collab', text: 'A massive streamer wants you to teach him to fight, live, in front of 200,000 people.', options: [
    {id: 'yes', label: 'Go live', hint: 'Followers. He might clip you looking silly.', roll: .7, win: {followers: 25000, hype: 5, energy: -5, text: 'You catch him with a soft body shot and chat explodes.', tone: 'good'}, lose: {followers: 10000, hype: -2, energy: -5, text: 'He lands a lucky jab. "Streamer drops pro fighter" is everywhere.', tone: 'bad'}},
    {id: 'no', label: 'Not my thing', hint: 'Nothing happens.', eff: {text: 'You pass.'}}]})},
  {id: 'fame-doc', arc: 'fame', from: 'manager', gap: 40, when: c => c.tier >= 1 && !!c.camp, build: c => ({title: 'A documentary crew', text: `A streaming service wants to follow this whole camp. "${P(c, 'coach').short} is going to hate it," your manager admits.`, options: [
    {id: 'yes', label: 'Let them in', hint: 'Huge hype. Cameras cost energy.', eff: {hype: 10, followers: 15000, energy: -12, fitness: -3, bond: {coach: -6}, flag: 'documentary', text: 'The trailer is mostly you arguing with your coach. It is a hit.', tone: 'big'}},
    {id: 'no', label: 'Closed camp', hint: 'Focus.', eff: {fitness: 4, bond: {coach: 6}, text: 'Closed doors. All business.'}}]})},
  {id: 'fame-charity', arc: 'fame', from: 'manager', gap: 40, when: c => c.hype >= 10, build: c => { const n = T(c, [800, 5000, 20000]); return {title: 'Charity night', text: 'Three rounds in headgear for a children\'s hospital. Big gloves, good cause.', options: [
    {id: 'yes', label: 'Do it', hint: `+${usd(n)}, hype. Small knock risk.`, roll: .85, win: {money: n, hype: 4, energy: -10, text: 'Fun night, money raised.', tone: 'good'}, lose: {money: n, injury: 1, energy: -10, text: 'You tweak your hand on a headgear. A week off.', tone: 'bad'}},
    {id: 'no', label: 'Decline politely', hint: 'Nothing happens.', eff: {text: 'You send a signed pair of gloves instead.'}}]}; }},
  {id: 'fame-nick', arc: 'nick', from: 'The fans', when: c => !c.nickname && c.record[0] >= 2, build: (c, r, t) => { const n = t ?? ['The Problem', 'Hurricane', 'Iceman', 'The Reaper', 'Wolf', 'Lights Out', 'Smokey'][Math.floor(r() * 7)]; return {target: n, title: 'The fans picked a nickname', text: `After your last fight everyone is calling you "${n}". It's trending.`, options: [
    {id: 'yes', label: `Embrace "${n}"`, hint: 'It\'s yours now.', eff: {hype: 4, text: `"${n}" ${c.name}. It sticks.`, tone: 'good'}},
    {id: 'no', label: 'No nicknames', hint: 'Nothing happens.', eff: {text: 'You stay just your name.'}}]}; }},

  /* a crisis in camp that changes the fight itself */
  {id: 'camp-hand', arc: 'camp-hand', from: 'coach', again: 220, when: c => !!c.camp && !c.camp.story && c.camp.weeksLeft >= 2 && c.tier >= 1, build: c => ({title: 'Your right hand', text: `${P(c, 'coach').short} holds the X-ray up to the window. "Hairline fracture. You can fight, but that hand won't hit like it should. Your call."`, options: [
    {id: 'fight', label: 'Fight with the broken hand', hint: 'Less power. Win with your legs for a big bonus.', eff: {brokenHand: true, hype: 5, bond: {coach: 4}, text: 'You tell nobody outside the gym. The hand gets taped and the game plan changes.', tone: 'big'}},
    {id: 'out', label: 'Pull out of the fight', hint: 'Lose the purse. Keep the hand.', eff: {pullOut: true, hype: -6, health: 10, text: 'The bout is off. The fans are not kind about it.', tone: 'bad'}}]})},

  /* things that can come round again, because they are about right now */
  {id: 'rival-post', arc: 'rival-post', from: 'Rival', again: 30, when: c => c.record[0] + c.record[1] >= 1, build: (c, r, t) => { const pool = c.roster.filter(x => x.tier === c.tier && x.id !== c.camp?.opponentId); const hot = (c.rivals ?? []).map(x => x.id).find(id => pool.some(n => n.id === id)); const n = pool.find(x => x.id === t) ?? pool.find(x => x.id === hot) ?? pool[Math.floor(r() * pool.length)]; const last = c.history[0];
    const cap = last?.result === 'L' ? `caption: "${last.opponent} showed everyone how."` : last?.method === 'DEC' ? 'caption: "Fifteen minutes and nobody got hurt. Boring."' : last ? `caption: "Beat ${firstName(last.opponent)}. Who hasn't?"` : 'caption: "Who?"';
    return {target: n.id, title: `${n.name} is talking`, text: `${n.name} posts a clip of your last fight, ${cap}`, options: [
      {id: 'clap', label: 'Clap back', hint: 'Dice roll. Heats up the rivalry.', roll: .55, win: {hype: 8, followers: 6000, heat: 18, text: `Your reply to ${n.name} gets more likes than his post.`, tone: 'good'}, lose: {hype: -4, heat: 12, text: `Your reply to ${n.name} gets ratioed. Even your mum thought it was cringe.`, tone: 'bad'}},
      {id: 'call', label: 'Call him out', hint: 'He becomes an offer soon.', eff: {heat: 30, hype: 3, text: `"Sign the contract, ${firstName(n.name)}." The matchmakers noticed.`, tone: 'big'}},
      {id: 'ignore', label: 'Ignore it', hint: 'Classy.', eff: {hype: 2, text: 'You don\'t reply. The fans respect it.'}}]}; }},
  {id: 'camp-altitude', arc: 'camp-altitude', from: 'coach', again: 80, when: c => !!c.camp && (c.camp.level ?? 0) < 2 && c.money >= T(c, [600, 3500, 15000]), build: c => { const n = T(c, [600, 3500, 15000]); return {title: 'Altitude block', text: `"Two weeks in the mountains. ${usd(n)}. Your lungs will hate me, then thank me."`, options: [
    {id: 'yes', label: 'Go up the mountain', hint: 'Cardio up, fitness way up.', eff: {money: -n, stat: [['cardio', 1.5]], fitness: 12, energy: -8, bond: {coach: 4}, text: 'Two weeks at altitude. Your heart rate barely moves now.', tone: 'good'}},
    {id: 'no', label: 'Train at home', hint: 'Save the money.', eff: {text: 'You stay home.'}}]}; }},
  {id: 'recover-clinic', arc: 'recover-clinic', from: 'manager', again: 90, when: c => (c.health < 80 || c.energy < 50) && c.money >= T(c, [400, 2500, 12000]), build: c => { const n = T(c, [400, 2500, 12000]); return {title: 'A recovery clinic', text: `Cryo, hyperbaric chamber, IV drips. ${usd(n)} for the week.`, options: [
    {id: 'try', label: 'Try it', hint: 'Dice roll: works wonders, or makes you ill.', roll: .72, win: {money: -n, health: 30, energy: 25, text: 'You walk out feeling brand new.', tone: 'good'}, lose: {money: -n, energy: -20, text: 'You react badly to the IV and spend three days in bed.', tone: 'bad'}},
    {id: 'no', label: 'Ice bath and sleep', hint: 'The old way.', eff: {energy: 8, text: 'Ice bath, ten hours of sleep. The classics.'}}]}; }},
  {id: 'home-card', arc: 'home-card', from: 'manager', again: 100, when: c => !c.camp && c.tier >= 1 && !c.homecoming, build: c => ({title: 'Fight at home?', text: `The promotion is planning a card in ${c.country}. They want you on it.`, options: [
    {id: 'yes', label: 'Bring it home', hint: 'Your next fight: +20% purse and the crowd on your side.', eff: {hype: 5, text: 'Your next fight will be in front of your people.', tone: 'big'}},
    {id: 'no', label: 'Fight wherever', hint: 'No change.', eff: {text: 'You tell them to put you wherever the fight makes sense.'}}]})},
];

/** the next message a player should get, or null if nothing is due */
export function nextBeat(c: Career, r: () => number): Beat | null {
  const seen = c.storySeen ?? {}, arcWeek = c.arcWeek ?? {};
  const due = BEATS.filter(b => {
    const at = seen[b.id];
    if (at != null && (b.again == null || c.week - at < b.again)) return false;
    const steps = BEATS.filter(x => x.arc === b.arc), i = steps.indexOf(b);
    if (steps.slice(0, i).some(x => seen[x.id] == null)) return false;
    if (i > 0 && c.week - (arcWeek[b.arc] ?? 0) < (b.gap ?? 20)) return false;
    return b.when(c);
  });
  if (!due.length) return null;
  // long stories come before one-off moments
  const weight = (b: Beat) => BEATS.filter(x => x.arc === b.arc).length > 1 ? 2 : 1;
  let x = r() * due.reduce((s, b) => s + weight(b), 0);
  return due.find(b => (x -= weight(b)) <= 0) ?? due[0];
}
export const fromName = (c: Career, from: CastKey | string) => (c.cast as Cast)[from as CastKey]?.short ?? from;

/* ---------------------------------------------------------------- scenes */
export type Line = {who: string; text: string};
export type Award = {label: string; winner: string; detail: string; you: boolean};
/** awards night: the trophies (revealed one by one after the lines), last year's targets checked off, and next year's */
export type Scene = {id: string; kicker: string; title: string; tone: 'win' | 'loss' | 'big' | 'quiet'; lines: Line[]; awards?: Award[]; review?: {last: {label: string; done: boolean}[]; next: string[]}};
/** what really happened in the cage, counted during the live fight */
export type FightTale = {kdFor: number; kdAgainst: number; rockedFor: number; rockedAgainst: number; landed: number; thrown: number; head: number; body: number; legs: number; takedowns: number; ctrl: number; gassed: boolean; legsGone: boolean; bodyGone: boolean; closeCards: boolean; /** the worst the cut on each face got */ cut?: number; oppCut?: number};
export type FightStory = {opp: string; method: string; how?: string; round: number; event: string; won: boolean; lost: boolean; title: boolean; wasChamp: boolean; nowChamp: boolean; firstFight: boolean; firstWin: boolean; firstLoss: boolean; firstKOLoss: boolean; streak: number; settled: boolean; vsPartner: boolean; defenses: number; tale?: FightTale};

/** the one thing your corner says about what actually happened tonight */
export function taleLine(x: FightStory): string | null {
  const t = x.tale; if (!t) return null; const opp = firstName(x.opp);
  if (x.won && t.kdAgainst >= 1) return `${opp} put you on the canvas and you got up and beat him. Nobody can teach that.`;
  if (x.lost && t.kdFor >= 1) return `You had ${opp} down and you let him back in. That's the part that will keep you awake.`;
  if (x.won && t.rockedAgainst >= 2) return `You got hurt ${t.rockedAgainst} times tonight. You won, but we're fixing that guard on Monday.`;
  if (t.gassed) return x.won ? `You won on an empty tank. Do that against someone better and you get stopped.` : `Your gas tank went and the fight went with it. We start with your conditioning.`;
  if (t.legsGone) return `Your lead leg is black and blue. If you don't check those kicks, they end your career.`;
  if (t.bodyGone) return `He took your wind with those body shots. Elbows down from now on.`;
  if (x.won && t.body >= 10) return `${t.body} shots to the body. That's what broke him, even if the crowd didn't see it.`;
  if (x.won && t.legs >= 7) return `${t.legs} leg kicks. By the end he couldn't plant his feet. Beautiful, boring work.`;
  if (x.won && t.takedowns >= 3) return `${t.takedowns} takedowns. He knew what was coming and still couldn't stop it.`;
  if (x.won && t.kdFor >= 2) return `You dropped him ${t.kdFor} times. When you hurt someone now, you finish them.`;
  if (x.lost && t.closeCards && /DEC/.test(x.method)) return `That could have gone either way. Don't leave it to three strangers next time.`;
  if (x.lost && t.landed < 15) return `You landed ${t.landed} strikes. Judges can't score what you don't throw.`;
  return null;
}
/** a short memory of the fight, so the next meeting can bring it up */
export function taleNote(x: FightStory): string | undefined {
  const t = x.tale; if (!t) return undefined;
  if (x.lost && t.kdAgainst >= 2) return `he dropped you ${t.kdAgainst} times`;
  if (x.lost && t.kdAgainst === 1) return 'he put you on the canvas';
  if (x.won && t.kdFor >= 2) return `you dropped him ${t.kdFor} times`;
  if (x.won && t.kdAgainst >= 1) return 'he dropped you and you came back to win';
  if (x.won && t.kdFor === 1) return 'you put him on the canvas';
  return undefined;
}
/** what the fans post about it */
export function talePost(name: string, x: FightStory): string | null {
  const t = x.tale; if (!t) return null;
  if (x.won && t.kdAgainst >= 1) return `${name} got DROPPED and still beat ${x.opp}. What a fight.`;
  if (x.lost && t.kdFor >= 1) return `${name} had ${x.opp} down and couldn't finish. That one's going to hurt.`;
  if (t.kdFor >= 1 && t.kdAgainst >= 1) return `${name} vs ${x.opp}: both men hit the canvas. Fight of the year stuff.`;
  if (x.won && t.landed >= 45) return `${t.landed} significant strikes for ${name} tonight. ${x.opp} never got going.`;
  return null;
}

/* ----------------------------------------------------------- story fights */
export type GoalKind = 'win' | 'finish' | 'body' | 'legs' | 'td' | 'landed' | 'nodrop';
export type StoryGoal = {kind: GoalKind; n: number; label: string};
export type StoryFight = {id: string; title: string; brief: string; goal: StoryGoal; mine?: Partial<Stats>; theirs?: Partial<Stats>; bonus: number};
/** how far along a goal is (the fight HUD and the result both read this) */
export function goalValue(g: StoryGoal, t: Pick<FightTale, 'body' | 'legs' | 'takedowns' | 'landed' | 'kdAgainst'>) {
  return g.kind === 'body' ? t.body : g.kind === 'legs' ? t.legs : g.kind === 'td' ? t.takedowns : g.kind === 'landed' ? t.landed : g.kind === 'nodrop' ? t.kdAgainst : 0;
}
export function goalMet(g: StoryGoal, won: boolean, method: string, t?: FightTale) {
  if (g.kind === 'win') return won;
  if (g.kind === 'finish') return won && (method === 'KO/TKO' || method === 'SUB');
  if (!t) return won;                                         // a simulated fight: a win is good enough
  return g.kind === 'nodrop' ? t.kdAgainst === 0 : goalValue(g, t) >= g.n;
}
const purseFor = (c: Career) => T(c, [1500, 9000, 60000]);
/** some fights are more than a fight: the story changes the rules and sets a goal inside the cage */
export function storyFightFor(c: Career, opp: {id: string; name: string; style: Style}, o: {title: boolean; tag?: string; note: string}): StoryFight | undefined {
  const co = P(c, 'coach').short, who = firstName(opp.name), pay = purseFor(c), fought = fights(c);
  const met = c.history.find(h => h.opponentId === opp.id);
  if (fought === 0) return {id: 'debut', title: 'Your pro debut', brief: `${co}: "Nerves are normal. Don't chase the knockout. Land your shots and get your hand raised."`, goal: {kind: 'landed', n: 10, label: 'Land 10 strikes'}, bonus: 500};
  if (opp.id === c.partnerId) return {id: 'partner', title: 'He knows everything', brief: `${who} has seen every habit you have. The leg kicks are the one weapon you never showed him.`, goal: {kind: 'legs', n: 6, label: 'Land 6 leg kicks'}, theirs: {iq: 7}, bonus: pay};
  if (c.superfight && o.title) return {id: 'superfight', title: 'History on the line', brief: `A new weight class and a champion who has never seen you. Make him respect you early.`, goal: {kind: 'landed', n: 30, label: 'Land 30 strikes'}, bonus: pay * 2};
  if (opp.id === c.nemesis) return {id: 'revenge', title: 'Unfinished business', brief: `${who} ${met?.note ?? 'beat you'}. A decision won't settle this.`, goal: {kind: 'finish', n: 1, label: 'Finish him'}, bonus: pay * 1.5};
  if (o.title && !c.champ && !c.history.some(h => h.title)) return {id: 'first-title', title: 'First title shot', brief: `Five rounds with the best in the world. Survive the storm early and don't get careless.`, goal: {kind: 'nodrop', n: 0, label: 'Never hit the canvas'}, mine: {cardio: -3}, bonus: pay * 2};
  if (o.note.includes('Hometown')) return {id: 'home', title: 'In front of your people', brief: `Everybody you grew up with is in the building. Send them home happy.`, goal: {kind: 'finish', n: 1, label: 'Finish him at home'}, mine: {power: 3}, bonus: pay};
  if ((c.peakTier ?? 0) > c.tier) return {id: 'last-chance', title: 'Earn your way back', brief: `They released you. Every fight down here is an audition.`, goal: {kind: 'win', n: 1, label: 'Win'}, bonus: pay};
  if (o.tag === 'short') return {id: 'short', title: 'Short notice', brief: `No camp and no time to cut properly. Your gas tank won't be full, so don't let this drag on.`, goal: {kind: 'finish', n: 1, label: 'Finish before you gas'}, mine: {cardio: -8}, bonus: pay};
  if ((fought + c.week) % 3 !== 0) return undefined;
  // otherwise your coach sometimes hands you a specific game plan for this opponent
  if (opp.style === 'Wrestler') return {id: 'plan', title: `${co}'s game plan`, brief: `"${who} needs his legs to shoot. Chop them out from under him."`, goal: {kind: 'legs', n: 5, label: 'Land 5 leg kicks'}, bonus: pay / 2};
  if (opp.style === 'Striker') return {id: 'plan', title: `${co}'s game plan`, brief: `"${who} wants a kickboxing match. Don't give him one. Put him on his back."`, goal: {kind: 'td', n: 2, label: 'Land 2 takedowns'}, bonus: pay / 2};
  if (opp.style === 'Grappler') return {id: 'plan', title: `${co}'s game plan`, brief: `"Make ${who} carry your weight, then go to the body. He'll fade."`, goal: {kind: 'body', n: 7, label: 'Land 7 body shots'}, bonus: pay / 2};
  return {id: 'plan', title: `${co}'s game plan`, brief: `"${who} has no holes, so make one. Pound the body from the first bell."`, goal: {kind: 'body', n: 8, label: 'Land 8 body shots'}, bonus: pay / 2};
}
export const brokenHandFight = (c: Career): StoryFight => ({id: 'broken-hand', title: 'Fighting with a broken hand', brief: `${P(c, 'coach').short}: "Your right can't win this. Your legs can."`, goal: {kind: 'legs', n: 6, label: 'Land 6 leg kicks'}, mine: {power: -8}, bonus: purseFor(c) * 1.5});

/* -------------------------------------------------------------- contracts */
export type Contract = {tier: number; fights: number; left: number; wins: number; finishes: number; needWins: number; needFinishes: number};
export function newContract(c: Pick<Career, 'tier' | 'champ'>): Contract {
  const d = c.champ ? [3, 2, 1] : c.tier === 0 ? [3, 2, 1] : c.tier === 1 ? [4, 3, 1] : [4, 3, 2];
  return {tier: c.tier, fights: d[0], left: d[0], wins: 0, finishes: 0, needWins: d[1], needFinishes: d[2]};
}
export const contractBonus = (tier: number) => [2000, 10000, 40000][tier];
export const contractScene = (c: Career, result: 'won' | 'even' | 'lost', cash: number): Scene => result === 'won' ? {id: 'contract-won', kicker: 'Contract', title: 'You beat the deal', tone: 'win', lines: [
  {who: P(c, 'manager').short, text: `Every target hit. They've paid the ${usd(cash)} bonus and raised your purses by 10%.`},
  {who: 'You', text: 'You read the new number twice, then you text your mum.'}]}
  : result === 'lost' ? {id: 'contract-lost', kicker: 'Contract', title: 'You missed your targets', tone: 'loss', lines: [
    {who: P(c, 'manager').short, text: `You didn't hit a single target on that deal, so they cut your purses by 10%. I fought them on it. I lost.`},
    {who: P(c, 'coach').short, text: `Good. Now you've got something to be angry about.`}]}
  : {id: 'contract-even', kicker: 'Contract', title: 'Same money, new deal', tone: 'quiet', lines: [{who: P(c, 'manager').short, text: `You did enough to get renewed, but not enough to get a raise. New targets are on your desk.`}]};
export const debutNightScene = (c: Career, opp: string): Scene => ({id: 'debut-night', kicker: 'Basement Brawl 114', title: 'Tonight', tone: 'big', lines: [
  {who: 'You', text: `The changing room smells like bleach and old tape. Somewhere above you, ${c.backstory === 'street' ? 'people are shouting your name like it\'s still a car park' : 'a crowd you can\'t see is getting louder'}.`},
  {who: P(c, 'manager').short, text: `${opp}'s opponent pulled out this morning, so they called us. It's your debut. You walk in ten minutes.`},
  {who: P(c, 'brother').short, text: `I'm in the second row. If you lose, I never knew you. Good luck.`},
  {who: P(c, 'coach').short, text: `Everything you've done got you to this door. Hands up. Let's go to work.`}]});

const how = (x: FightStory) => x.how ? x.how.toLowerCase() : x.method === 'KO/TKO' ? 'that knockout' : x.method === 'SUB' ? 'that submission' : 'the scorecards';
const roots: Record<string, string> = {wrestler: 'the wrestling room', street: 'that car park', kickboxer: 'your first kickboxing gym', bjj: 'the mats', late: 'that desk'};
const fromRoots = (c: Career) => roots[c.backstory ?? ''] ?? 'the beginning';

export function fightScene(c: Career, x: FightStory): Scene | null {
  const co = P(c, 'coach').short, m = P(c, 'manager').short, b = P(c, 'brother').short, f = P(c, 'friend').short, p = P(c, 'partner').short;
  if (x.won && x.title && !x.wasChamp && x.nowChamp) return {id: 'title-win', kicker: x.event, title: `Champion of the world`, tone: 'big', lines: [
    {who: 'Announcer', text: `And NEW! The VERSUS ${c.division} champion of the world... ${c.name}!`},
    {who: co, text: has(c, 'did-the-hill') ? 'Remember that hill at 5am? Nobody was watching. Look how many are watching now.' : `All those years. I never told you this, but I knew. Since the first week, I knew.`},
    {who: b, text: (c.bonds?.brother ?? 50) >= 45 ? `You did it! Mum is screaming so loud the neighbours called the police!` : `I watched it. All of it. Congratulations. I mean it.`},
    {who: m, text: 'I need you to know your phone has just melted. Also, you are rich. Enjoy tonight.'},
    {who: 'You', text: `From ${fromRoots(c)} to this. Somebody take a picture, because nobody back home will believe it.`}]};
  if (x.lost && x.title && x.wasChamp) return {id: 'title-lost', kicker: x.event, title: 'The belt is gone', tone: 'loss', lines: [
    {who: 'Announcer', text: `And NEW... ${x.opp}.`},
    {who: 'You', text: 'They take it off your waist in front of everybody. It weighs nothing, and you feel the loss of it everywhere.'},
    {who: co, text: `It was on loan. It always is. We go home, we heal, and then we decide if you want it back.`}]};
  if (x.lost && x.title) return {id: 'title-miss', kicker: x.event, title: 'So close', tone: 'loss', lines: [
    {who: co, text: 'You were in there with the best in the world, and you belonged. Remember that when it stops hurting.'},
    {who: m, text: 'They will give you another shot, but you will have to earn it again. Take a week.'}]};
  if (x.vsPartner) return {id: 'partner-fight', kicker: x.event, title: x.won ? `You beat ${p}` : `${p} beat you`, tone: x.won ? 'quiet' : 'loss', lines: [
    {who: 'You', text: x.won ? `You have held pads for those hands for years. Tonight you knew every shot before it came. It doesn't feel the way you thought it would.` : `He knew everything. Every habit, every tell. He learned them next to you.`},
    {who: p, text: x.won ? 'Good fight. Don\'t call me.' : 'I told you not to go easy on me. You didn\'t. Respect.'}]};
  if (x.settled) return {id: 'settled', kicker: x.event, title: `Finally: ${x.opp}`, tone: 'win', lines: [
    {who: 'You', text: `You have been carrying this name around for a long time. Tonight you put it down.`},
    {who: co, text: `That one was for you, I know. Now let it go. There are bigger names than that.`}]};
  if (x.firstFight && x.won) return {id: 'debut-win', kicker: x.event, title: '1-0', tone: 'win', lines: [
    {who: co, text: `${how(x) === 'the scorecards' ? 'Fifteen minutes' : 'Round ' + x.round} and your hands didn't stop shaking until the bell. Everybody's do. That's your one and only debut.`},
    {who: f, text: `I lost my voice. I also lost my wallet. Worth it.`},
    {who: b, text: `Can I tell people you're my brother now, or do I have to wait until you're good?`},
    {who: m, text: `Your cut is in the bank. Don't spend it. Rent's due.`}]};
  if (x.firstFight && x.lost) return {id: 'debut-loss', kicker: x.event, title: '0-1', tone: 'loss', lines: [
    {who: 'You', text: `You sit in the changing room with the tape still on your hands. Nobody tells you what the first one feels like.`},
    {who: co, text: `Look at me. Look at me. Most of the people you'll ever admire lost at some point. You lost on the first day, so that is out of the way.`},
    {who: b, text: `Mum wants to know if you've eaten. That's all. She isn't going to ask about the fight.`},
    {who: co, text: `Monday. Six o'clock. Bring your hands.`}]};
  if (x.firstLoss) return {id: 'first-loss', kicker: x.event, title: 'The zero is gone', tone: 'loss', lines: [
    {who: 'You', text: `${x.opp}. You'll remember that name when you've forgotten your own phone number.`},
    {who: co, text: `An undefeated record only teaches you to protect it. Now you've got nothing to protect, so you can start learning.`},
    {who: m, text: `The phone will still ring. I'll make sure of it.`}]};
  if (x.firstKOLoss) return {id: 'ko-loss', kicker: x.event, title: 'Lights out', tone: 'loss', lines: [
    {who: 'You', text: `You remember the walk out. You remember the bell. Then the doctor is asking you what city you're in.`},
    {who: co, text: `You're not sparring for six weeks and that's not up for discussion. Your chin is a bank account. Tonight you made a withdrawal.`},
    {who: b, text: `I've watched it once. I'm never watching it again. Are you okay? Actually okay?`}]};
  if (x.won && x.wasChamp && x.title && x.defenses === 1) return {id: 'first-defense', kicker: x.event, title: 'Still champion', tone: 'win', lines: [
    {who: co, text: `Anyone can win it once. You've just proved it wasn't luck.`}, {who: m, text: `You're the one they build the cards around now.`}]};
  if (x.won && x.streak === 5) return {id: 'streak-5', kicker: x.event, title: 'Five straight', tone: 'win', lines: [
    {who: f, text: `People at the truck are asking if I really know you. I'm charging them for the answer.`}, {who: co, text: `Five in a row. Keep your head down. This is exactly when people stop listening.`}]};
  return null;
}

/** a short message from your corner after every other fight, so no result goes by in silence */
export function lockerNote(c: Career, x: FightStory) {
  const told = taleLine(x); if (told) return told;
  const opp = firstName(x.opp); const n = (c.week * 7 + x.round) % 3;
  if (x.lost) return [`We'll watch it Monday, not tonight. Eat something.`, `${opp} was better tonight. Tonight. Get some sleep.`, `You stopped doing what we drilled in round ${x.round}. We'll fix that. Ice the hands.`][n];
  if (!x.won) return [`A draw feels like nothing. Use that feeling in camp.`, `Nobody's happy with a draw. Good. Back on Monday.`, `Could have gone either way. Next time don't leave it to three strangers.`][n];
  if (x.method === 'KO/TKO') return [`${x.how ? x.how + '. ' : ''}We drilled that for weeks and you made it look like an accident.`, `Round ${x.round}. Clean. Now go and check ${opp} is all right. That's what we do.`, `I saw that opening before you did. Then you took it anyway. Good.`][n];
  if (x.method === 'SUB') return [`He had nowhere to go. That's how you do it.`, `You stayed patient on the mat. That's the part they can't teach.`, `Tap, tap, tap. Beautiful noise.`][n];
  return [`You won, but we both know where you got sloppy. Enjoy tonight anyway.`, `A win's a win. Tomorrow we talk about round ${Math.min(x.round, 2)}.`, `Three judges agreed with me. That's rare. Go home.`][n];
}

export const warningScene = (c: Career): Scene => ({id: 'warning', kicker: 'A phone call', title: 'They are talking about you', tone: 'loss', lines: [
  {who: P(c, 'manager').short, text: `I'll be straight with you. The promotion called. One more loss and they won't renew.`},
  {who: 'You', text: 'How long have they been saying that?'},
  {who: P(c, 'manager').short, text: `Long enough that I've stopped telling them you're just unlucky. Win the next one.`}]});
export const cutScene = (c: Career, league: string, down: string): Scene => ({id: 'cut', kicker: league, title: 'You have been released', tone: 'loss', lines: [
  {who: P(c, 'manager').short, text: `It's over at ${league}. The email came through an hour ago. I'm so sorry.`},
  {who: 'You', text: `You read it three times in the car park. It's four lines long.`},
  {who: P(c, 'coach').short, text: `So we go back to ${down}. Small rooms, bad lights, no money. That's where you learned to fight. Six o'clock tomorrow.`}]});
export const promotedScene = (c: Career, league: string, tier: number, back: boolean): Scene => back ? {id: 'comeback', kicker: league, title: 'They called back', tone: 'big', lines: [
  {who: P(c, 'manager').short, text: `Guess who just rang me, very politely, asking if you were available.`},
  {who: P(c, 'coach').short, text: `They threw you away and you made them come and get you. Don't you dare forget how that felt.`}]}
  : tier === 2 ? {id: 'big-show', kicker: league, title: 'The big show', tone: 'big', lines: [
    {who: P(c, 'manager').short, text: `Are you sitting down? It's VERSUS. The real one. The contract is on my desk and my hands are shaking.`},
    {who: P(c, 'coach').short, text: `Every person in that division was the best in their town. Now you find out what you are.`},
    {who: P(c, 'brother').short, text: `I've told everyone. I told the guy at the petrol station. He doesn't care, but I told him.`},
    {who: 'You', text: `${c.age} years old. You read your name on the contract and think about ${fromRoots(c)}.`}]}
  : {id: 'called-up', kicker: league, title: 'You got the call', tone: 'win', lines: [
    {who: P(c, 'manager').short, text: `Neon Contender Series. Real lights, real money, real cameras. They saw your last fight.`},
    {who: P(c, 'coach').short, text: `Everyone there can fight. The basement is over. Pack your bag.`},
    {who: P(c, 'friend').short, text: `Does this mean you can pay me back for that pizza from 2019?`}]};
export const nemesisScene = (c: Career, name: string, league: string): Scene => ({id: 'nemesis', kicker: league, title: `${name} is coming`, tone: 'quiet', lines: [
  {who: P(c, 'manager').short, text: `You'd better hear this from me. ${name} just signed with your league.`},
  {who: name, text: `I beat ${c.name} once on the way up. I'd love to do it again now that people are watching.`},
  {who: 'You', text: `You thought you left that name behind you. It turns out it was following you the whole way.`}]});
export const titleShotScene = (c: Career, champ: string): Scene => ({id: 'title-shot', kicker: 'The contract', title: 'The title shot', tone: 'big', lines: [
  {who: P(c, 'manager').short, text: `Five rounds. ${champ}. For the belt. I've wanted to say that to someone for my whole career.`},
  {who: P(c, 'coach').short, text: `Ten weeks. Nobody comes in, nobody goes out. Everything we've ever done was for this camp.`}]});
export const legendScene = (c: Career): Scene => ({id: 'legend', kicker: 'Greatness', title: 'Nobody is left', tone: 'big', lines: [
  {who: 'Commentator', text: `We have run out of ways to describe ${c.name}. The division has been cleaned out.`},
  {who: P(c, 'manager').short, text: `The promotion called. They are offering something they almost never offer: a shot at a second belt in another weight class.`},
  {who: P(c, 'coach').short, text: `Only the truly great even get asked. It's your call. Your body will pay either way.`}]});
export const superfightScene = (c: Career, to: Division, up: boolean): Scene => ({id: 'superfight', kicker: `${c.division} to ${to}`, title: up ? 'Moving up' : 'Dropping down', tone: 'big', lines: up ? [
  {who: P(c, 'coach').short, text: `They'll be bigger than anyone you've ever touched. You'll hit harder, and you'll be slower. We build for that starting today.`},
  {who: 'You', text: `Your belt stays at home. If you lose this, you go back and keep it. If you win, you make history.`}] : [
  {who: P(c, 'coach').short, text: `This cut is going to be the worst thing you've done to your body. You'll be the fastest man in that division, with less in the tank and a thinner chin.`},
  {who: 'You', text: `Your belt stays at home. If you lose this, you go back and keep it. If you win, you make history.`}]});
export const doubleScene = (c: Career, belt: Division): Scene => ({id: 'double', kicker: `${belt} champion`, title: 'Two-division champion', tone: 'big', lines: [
  {who: 'Announcer', text: `Ladies and gentlemen, your new ${belt} champion, and now a champion in two weight classes... ${c.name}!`},
  {who: P(c, 'coach').short, text: `I've got nothing to teach you tonight. Sit down. Let me look at you for a minute.`},
  {who: P(c, 'manager').short, text: `One problem: they won't let you keep both. You'll have to choose which belt stays.`}]});
export const bothBeltsScene = (c: Career, a: Division, b: Division, weeks: number): Scene => ({id: 'both-belts', kicker: `${a} and ${b}`, title: 'Nobody takes these', tone: 'big', lines: [
  {who: 'You', text: 'You put one belt on each shoulder and tell the promotion they can come and take them.'},
  {who: P(c, 'manager').short, text: `Then here's the deal. Every ${weeks} weeks, each belt gets defended or it's gone. Short camps. No holidays. I'll start booking.`},
  {who: P(c, 'coach').short, text: `I've seen this break better bodies than yours. So we eat right, we sleep, and we never miss a day.`}]});
export const dualLostScene = (c: Career, gone: Division, kept: Division): Scene => ({id: 'dual-lost', kicker: `${gone} title`, title: 'One belt left', tone: 'loss', lines: [
  {who: 'You', text: `The ${gone} belt is gone. Your shoulders feel uneven walking back.`},
  {who: P(c, 'coach').short, text: `You're still the ${kept} champion. Nobody ever held two for free.`}]});
export const strippedScene = (c: Career, gone: Division, kept: Division): Scene => ({id: 'stripped', kicker: `${gone} title`, title: 'Stripped', tone: 'loss', lines: [
  {who: P(c, 'manager').short, text: `I told you the clock was real. The ${gone} belt has been taken off you. They never even had to beat you for it.`},
  {who: 'You', text: `You still have ${kept}. You look at the empty space on the wall anyway.`}]});
export const superLossScene = (c: Career, home: Division): Scene => ({id: 'super-loss', kicker: 'The superfight', title: 'Back to where you rule', tone: 'loss', lines: [
  {who: P(c, 'coach').short, text: `You tried what almost nobody is ever allowed to try. There's no shame in that.`},
  {who: 'You', text: `You go home to ${home}. The belt there is still yours.`}]});

/* ------------------------------------------------------------- the ending */
export function epilogue(c: Career): {headline: string; lines: string[]} {
  const co = P(c, 'coach'), m = P(c, 'manager'), b = P(c, 'brother').short, f = P(c, 'friend').short, p = P(c, 'partner');
  const titles = c.history.filter(h => h.title && h.result === 'W').length, belts = c.divisionTitles?.length ?? 0;
  const headline = belts >= 2 ? 'The greatest there ever was' : c.defenses >= 5 || titles >= 6 ? 'An all-time great' : belts === 1 ? 'A world champion' : c.tier === 2 ? 'A big-show fighter' : c.record[0] > c.record[1] ? 'A respected pro' : 'A fighter who never quit';
  const reason = c.retireReason === 'medical' ? `The commission refused to renew your licence after ${c.koLosses} knockout losses. It was the right call, and you hated it.` : c.retireReason === 'age' ? `At ${c.age} there was no one left who would sign the medical. You took your gloves off in the middle of an empty gym.` : `You chose your own last day, at ${c.age}. Very few fighters ever get to do that.`;
  const lines = [reason];
  lines.push((c.bonds?.coach ?? 50) >= 65 ? `${co.short} still opens the gym at 6am, and still tells every new kid about you.${has(c, 'owns-gym') ? ' The building has your name on it now.' : ''}` : (c.bonds?.coach ?? 50) >= 40 ? `${co.short} still calls on your birthday, mostly to criticise your footwork.` : `You and ${co.short} never really talked again. You both meant to.`);
  lines.push(has(c, 'brother-stopped') ? `${b} never fought again. He works corners now, and he's better at it than you ever were at anything.` : (c.bonds?.brother ?? 50) >= 55 ? `${b} is at your house every Sunday, telling your kids stories that get more exaggerated each year.` : `${b} sends a text at Christmas. You always mean to call.`);
  lines.push(has(c, 'truck-made-it') ? `${f} owns eleven food trucks and has never once let you pay.` : has(c, 'truck-failed') ? `${f} paid you back in the end, ten years late and in cash, in an envelope marked "pizza".` : (c.bonds?.friend ?? 50) >= 55 ? `${f} is still your best friend. He still has no idea how fighting works.` : `You lost touch with ${f} somewhere around the second camp abroad.`);
  lines.push(has(c, 'refused-partner') || has(c, 'partner-forgiven') ? `${p.short} was the first person you called when it ended.` : has(c, 'fight-partner') ? `You see ${p.short} at events sometimes. You nod.` : `${p.short} still says he won those Thursday rounds.`);
  lines.push((c.bonds?.manager ?? 50) >= 60 ? `${m.short} negotiated one last deal for you: a seat at the commentary desk.` : `${m.short} sent a very professional email.`);
  if (has(c, 'held-both')) lines.push(`They still talk about the years you refused to give up either belt.`);
  if (has(c, 'bought-house')) lines.push(`Your mum still lives in the house on the hill.`);
  if (has(c, 'leo-cageside')) lines.push(`Leo is 19 now. He has a gym bag with a very old pair of gloves in it.`);
  return {headline, lines};
}
