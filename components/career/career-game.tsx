'use client';
// VERSUS career mode: create a fighter, run their weeks, take fights, climb to a belt.
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Dumbbell, Swords, BedDouble, Megaphone, Crown, Flame, HeartPulse, Zap, Wallet, ChevronRight, RotateCcw, Shield, X, Check, Film, Activity, Users, Smartphone, Shirt, Stethoscope, Trophy, UserRound, Share2, Target, FileSignature} from 'lucide-react';
import {
  ACTIONS, BACKSTORIES, CAMP_LEVELS, COACHES, DIVISIONS, FIGHTER_COLORS, GYMS, START_COUNTRIES, STAT_KEYS, STAT_LABEL, STYLES, TIERS,
  DUAL_RULES, acceptOffer, adjacentDivisions, applyResult, beltClocks, buy, campPrice, createCareer, declineOffer, dismissScene, epilogue, fightStats, fitnessLabel, heatOf, legacy, opponentStats, legendChecks, legendReady, migrate, moveDivision, npc, overall, physioPrice, prPrice, relinquishBelt, rng, takeAction, weeklyCost,
  setSkipDrills, targetProgress, type Career, type CoachKey, type Division, type NPC, type Plan, type StatKey, type Style,
} from '../../lib/career/engine';
import {DEFAULT_LOOK, lookFor, type Look} from '../../lib/cosmetics';
import {LookEditor} from './look-editor';
import {CareerPhone, money, yearWeek, type PhoneApp} from './career-phone';
import {StoryScene} from './story-scene';
import {Drill, drillFor} from './drills';
import {CallOutButton, CareerExtras, Trips} from './extras-ui';
import {shareCareer} from './share-card';
import {goalMet} from '../../lib/career/story';
import {sfx} from '../fight3d/sound';
import {PLANS, aiPlan, fightRound, startFight, type FightState} from '../../lib/career/fight';
import {competitors} from '../../lib/competitors';
import {StudioIntro} from './studio-intro';
import {QuickFight} from './quick-fight';
import {FightStats, LiveFightGame, type LiveResult} from '../fight3d/live-fight';
import {tape, type FightCard} from '../../lib/fight3d/tape';

const SAVE = 'versus-career-v1', FIGHT = 'versus-career-fight-v1';
const load = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; } };
const save = (k: string, v: unknown) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const initials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

function Avatar({name, color, size = 'md'}: {name: string; color: string; size?: 'sm' | 'md' | 'lg'}) {
  return <span className={`cg-avatar ${size}`} style={{'--c': color} as React.CSSProperties} aria-hidden="true">{initials(name)}</span>;
}

/* ================================================================= root */
export function CareerGame() {
  const [career, setCareer] = useState<Career | null>(null);
  const [fight, setFight] = useState<FightState | null>(null);
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState<'career' | 'quick'>('career');
  const [ready, setReady] = useState(false);
  useEffect(() => { const saved = load<Career>(SAVE); setCareer(saved ? migrate(saved) : null); setFight(load<FightState>(FIGHT)); setReady(true); const q = new URLSearchParams(location.search); if (q.get('watch') === '1' || q.get('mode') === 'quick') setMode('quick'); }, []);
  const update = (c: Career | null) => { setCareer(c); save(SAVE, c); };
  const updateFight = (f: FightState | null) => { setFight(f); save(FIGHT, f); };
  const inFight = live || (!!fight && !!career?.camp);
  // sound needs one touch of the page first; after that every button clicks
  useEffect(() => { const on = (e: PointerEvent) => { sfx.unlock(); if ((e.target as HTMLElement).closest?.('button')) sfx.click(); }; window.addEventListener('pointerdown', on); return () => window.removeEventListener('pointerdown', on); }, []);

  return <><StudioIntro/>
    {!inFight && <div className="cg-modes"><div className="bn-seg" role="group" aria-label="Game mode">
      <button type="button" aria-pressed={mode === 'career'} onClick={() => setMode('career')}>Career</button>
      <button type="button" aria-pressed={mode === 'quick'} onClick={() => setMode('quick')}>Quick fight</button>
    </div></div>}
    {mode === 'quick' && !inFight ? <QuickFight/>
    : !ready ? <div className="cg-loading">Loading your career…</div>
    : !career ? <CreateFighter onCreate={c => update(c)}/>
    : live && career.camp ? <LiveFightNight career={career} onDone={out => { setLive(false); update(applyResult(career, out)); }}/>
    : fight && career.camp ? <FightNight career={career} fight={fight} setFight={updateFight} onDone={out => { updateFight(null); update(applyResult(career, out)); }}/>
    : career.retired ? <Retired career={career} onNew={() => { update(null); updateFight(null); }}/>
    : <Hub career={career} update={update} startFightNight={() => setLive(true)}/>}</>;
}

/* ================================================== live career fight */
function simulate(c: Career): FightState['outcome'] {
  const o = npc(c, c.camp!.opponentId)!;
  let f = startFight({name: c.name, stats: c.stats, style: c.style}, o, c.camp!.rounds, c.seed + c.week * 31);
  const r = rng(c.seed + c.week);
  while (!f.done) f = fightRound(f, aiPlan(f.you, f.opp, r));
  return f.outcome;
}

function LiveFightNight({career: c, onDone}: {career: Career; onDone: (o: NonNullable<FightState['outcome']> & {how?: string; tale?: LiveResult['tale']}) => void}) {
  const opp = npc(c, c.camp!.opponentId)!;
  // fight-night numbers: your camp fitness (and a bad weight cut) change what you bring into the cage
  // a cut that hasn't healed from the last fight opens up again with the first hard shot
  const you = useMemo(() => ({name: c.name, color: c.color, style: c.style, stats: fightStats(c), look: c.look ?? {...DEFAULT_LOOK}, cut: Math.round((c.cut ?? 0) * .7)}), [c]);
  const them = useMemo(() => ({name: opp.name, color: opp.color, style: opp.style, stats: opponentStats(c, opp), look: lookFor(opp.name)}), [c, opp]);
  // the opponent's mood from the press conference (edge) nudges how sharp he fights; studying his tape makes him easier to read
  const difficulty = Math.max(.2, Math.min(.95, .35 + (overall(opp.stats) - overall(c.stats)) / 60 + c.tier * .12 + (c.camp!.edge ?? 0) - (c.camp!.scouted ? .05 : 0)));
  const [result, setResult] = useState<LiveResult | null>(null);
  const onEnd = useCallback((r: LiveResult) => setResult(r), []);
  // broadcast card: the real event, billing, records, ages, countries and rankings
  const card = useMemo<FightCard>(() => {
    const ri = c.rankings.indexOf(opp.id);
    const oppRank = c.champion === opp.id ? 'C' : c.tier === 2 && ri >= 0 ? `#${ri + 1}` : undefined;
    const myRank = c.champ ? 'C' : c.rank ? `#${c.rank}` : undefined;
    const me = {name: c.name, nickname: c.nickname || undefined, style: c.style, stats: fightStats(c), country: c.country, age: c.age, record: c.record[2] ? c.record.join('-') : `${c.record[0]}-${c.record[1]}`, rank: myRank, belts: c.dual ? 2 : c.champ ? 1 : 0};
    const them = {name: opp.name, nickname: opp.nickname, style: opp.style, stats: opp.stats, country: opp.country, age: opp.age, record: opp.record.join('-'), rank: oppRank};
    return {
      event: c.camp!.event ?? TIERS[c.camp!.tier].name.toUpperCase(), billing: c.camp!.billing ?? 'Main card',
      title: c.camp!.title ? `VERSUS ${c.division.toUpperCase()} CHAMPIONSHIP` : undefined,
      story: c.camp!.story ? {title: c.camp!.story.title, brief: c.camp!.story.brief, goal: c.camp!.story.goal} : undefined,
      you: tape(me, them, c.division), opp: tape(them, me, c.division),
    };
  }, [c, opp]);
  const sim = useCallback(() => { const o = simulate(c)!; setResult({...o, cards: []}); }, [c]);
  if (!result) return <div className="bn-page cg">
    <div className="cg-livehead"><span className="eyebrow">{c.camp!.event ? ` · ` : ''}{c.camp!.title ? (c.champ ? ' · Title defense' : ' · Title fight') : ''}</span><h1>{c.name} <span className="muted">vs</span> {opp.name}</h1></div>
    <LiveFightGame card={card} you={you} opp={them} rounds={c.camp!.rounds} difficulty={difficulty} onEnd={onEnd} onSim={sim} venue={c.camp!.tier}/>
  </div>;
  // the purse the way a fighter actually gets it: show + win money, minus the manager's and the gym's cut
  let gross = c.camp!.purse + (result.winner === 'you' ? c.camp!.winBonus : 0);
  if (c.camp!.missedWeight) gross = Math.round(gross * .8);
  const cut = Math.round(gross * .1);
  return <div className="bn-page cg">{result.stats && <FightStats card={card} stats={result.stats} result={result}/>}<section className={`panel cg-result ${result.winner}`}>
    <img src={result.winner === 'you' ? '/art/trophy.webp' : '/art/gem.webp'} alt="" width={130} height={130}/>
    <div>
      <span className="eyebrow">{result.winner === 'you' ? 'Victory' : result.winner === 'opp' ? 'Defeat' : 'Draw'}</span>
      <h2>{result.winner === 'you' ? `You win by ${result.method}` : result.winner === 'opp' ? `${opp.name} wins by ${result.method}` : 'Scored a draw'}{result.how ? ` (${result.how})` : ''} · R{result.round}</h2>
      {result.cards.length > 0 && ['DEC', 'SPLIT DEC', 'DRAW'].includes(result.method) && <p className="muted">Scorecards: {result.cards.map(([a, b]) => `${a}–${b}`).join(', ')}</p>}
      <dl className="cg-payout">
        <div><dt>Show{result.winner === 'you' ? ' + win' : ''} money</dt><dd>{money(gross)}</dd></div>
        <div><dt>Manager (10%)</dt><dd>−{money(cut)}</dd></div>
        <div><dt>Gym &amp; coaches (10%)</dt><dd>−{money(cut)}</dd></div>
        <div className="net"><dt>You take home</dt><dd>{money(gross - cut * 2)}</dd></div>
      </dl>
      {c.camp!.story && (() => { const g = c.camp!.story!, hit = goalMet(g.goal, result.winner === 'you', result.method, result.tale); return <p className={hit ? 'cg-goalhit' : 'cg-warn'}><Target size={15} aria-hidden="true"/> {g.title}: {g.goal.label} {hit ? `· bonus ${money(g.bonus)}` : '· missed'}</p>; })()}
      {result.damageTaken > 45 && <p className="cg-warn">You took a lot of damage tonight. Expect a medical suspension and time to heal.</p>}
      <button className="button primary" onClick={() => onDone({winner: result.winner, method: result.method, round: result.round, damageTaken: result.damageTaken, how: result.how, tale: result.tale})}>Back to camp <ChevronRight size={18} aria-hidden="true"/></button>
    </div>
  </section></div>;
}

/* ======================================================= create fighter */
function CreateFighter({onCreate}: {onCreate: (c: Career) => void}) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [country, setCountry] = useState(START_COUNTRIES[0]);
  const [division, setDivision] = useState<Division>('Lightweight');
  const [style, setStyle] = useState<Style>('All-rounder');
  const [color, setColor] = useState(FIGHTER_COLORS[0]);
  const [backstory, setBackstory] = useState('kickboxer');
  const [gym, setGym] = useState('neon');
  const [look, setLook] = useState<Look>({...DEFAULT_LOOK});
  const [step, setStep] = useState<'profile' | 'look'>('profile');
  const [err, setErr] = useState('');
  const preview = useMemo(() => createCareer({name: name || 'Your Name', nickname, country, division, style, color, backstory}, 42).stats, [style, name, nickname, country, division, color, backstory]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) { setErr('Give your fighter a name with at least 3 letters.'); setStep('profile'); return; }
    onCreate(createCareer({name: name.trim(), nickname: nickname.trim(), country, division, style, color, backstory, gym, look, coldOpen: true}));
  };
  return <div className="bn-page cg">
    <header className="bn-pagehead with-art">
      <div>
        <span className="ui-credit"><img src="/brand/unseen-interactive-logo-light.svg" alt="Unseen Interactive" width={123} height={30}/>presents</span>
        <h1>Build a <em>legend.</em></h1>
        <p>Start in the basement leagues at 21. Train, take fights, build hype and climb to the VERSUS Championship. Every choice is yours.</p>
      </div>
      <img className="bn-art float" src="/art/trophy.webp" alt="" width={260} height={260}/>
    </header>
    <div className="bn-seg cg-steps" role="tablist" aria-label="Create your fighter">
      <button type="button" role="tab" aria-selected={step === 'profile'} aria-pressed={step === 'profile'} onClick={() => setStep('profile')}>1 · Profile & story</button>
      <button type="button" role="tab" aria-selected={step === 'look'} aria-pressed={step === 'look'} onClick={() => setStep('look')}><Shirt size={15} aria-hidden="true"/> 2 · Customise look</button>
    </div>
    {step === 'look' && <section className="panel cg-look">
      <div className="section-heading"><h2>Customise your fighter</h2><span className="muted">Premium ink and walkout gear unlock with career money</span></div>
      <LookEditor look={look} onChange={setLook}/>
      <div className="bn-ctas"><button type="button" className="button outline" onClick={() => setStep('profile')}>Back to profile</button><button type="button" className="button primary" onClick={submit}>Start career <ChevronRight size={18} aria-hidden="true"/></button></div>
    </section>}
    <form className="cg-create" onSubmit={submit} noValidate hidden={step !== 'profile'}>
      <section className="panel cg-form">
        <h2>Your fighter</h2>
        <label htmlFor="cg-name">Fight name</label>
        <input id="cg-name" value={name} maxLength={28} placeholder="Mateo Varga" onChange={e => { setName(e.target.value); setErr(''); }} aria-invalid={!!err} aria-describedby={err ? 'cg-err' : undefined}/>
        {err && <p className="cg-err" id="cg-err" role="alert">{err}</p>}
        <label htmlFor="cg-nick">Nickname <span className="muted">(optional)</span></label>
        <input id="cg-nick" value={nickname} maxLength={22} placeholder="Night Shift" onChange={e => setNickname(e.target.value)}/>
        <div className="cg-two">
          <label>Division<select id="cg-div" value={division} onChange={e => setDivision(e.target.value as Division)}>{DIVISIONS.map(d => <option key={d}>{d}</option>)}</select></label>
          <label>Country<select id="cg-country" value={country} onChange={e => setCountry(e.target.value)}>{START_COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        <span className="cg-label">Fighting style</span>
        <div className="cg-styles" role="radiogroup" aria-label="Fighting style">
          {(Object.keys(STYLES) as Style[]).map(s => <button type="button" role="radio" aria-checked={style === s} key={s} className={style === s ? 'on' : ''} onClick={() => setStyle(s)}>
            <strong>{s}</strong><small>{STYLES[s].blurb}</small>
          </button>)}
        </div>
        <span className="cg-label">Where you came from</span>
        <div className="cg-styles" role="radiogroup" aria-label="Backstory">
          {Object.entries(BACKSTORIES).map(([k, b]) => <button type="button" role="radio" aria-checked={backstory === k} key={k} className={backstory === k ? 'on' : ''} onClick={() => setBackstory(k)}>
            <strong>{b.label}</strong><small>{b.blurb}</small>
          </button>)}
        </div>
        <span className="cg-label">Home gym</span>
        <div className="cg-styles" role="radiogroup" aria-label="Home gym">
          {Object.entries(GYMS).map(([k, g]) => <button type="button" role="radio" aria-checked={gym === k} key={k} className={gym === k ? 'on' : ''} onClick={() => setGym(k)}>
            <strong>{g.label}</strong><small>{g.blurb}</small>
          </button>)}
        </div>
        <span className="cg-label">Corner color</span>
        <div className="cg-colors" role="radiogroup" aria-label="Corner color">
          {FIGHTER_COLORS.map(c => <button type="button" role="radio" aria-checked={color === c} aria-label={c} key={c} className={color === c ? 'on' : ''} style={{background: c}} onClick={() => setColor(c)}/>)}
        </div>
        <button type="button" className="button outline cg-next" onClick={() => setStep('look')}><Shirt size={16} aria-hidden="true"/>Next: customise your look</button>
      </section>
      <aside className="panel cg-preview">
        <img className="cg-preview-body" src={`/fighters/${look.model}-stance.webp`} alt="" width={180} height={275}/>
        <strong className="cg-preview-name">{name || 'Your Name'}</strong>
        {nickname && <span className="sticker sky" style={{'--tilt': '-3deg'} as React.CSSProperties}>“{nickname}”</span>}
        <span className="muted">{division} · {style} · {country}</span>
        <div className="cg-statlist">{STAT_KEYS.map(k => <StatBar key={k} k={k} v={preview[k]}/>)}</div>
        <button className="button primary cg-go">Start career <ChevronRight size={18} aria-hidden="true"/></button>
        <p className="bn-footnote">Your career saves on this device.</p>
      </aside>
    </form>
  </div>;
}

function StatBar({k, v, cap}: {k: StatKey; v: number; cap?: number}) {
  const tone = v >= 80 ? 'lime' : v >= 60 ? 'sky' : v >= 45 ? 'sun' : 'pink';
  return <div className="cg-stat">
    <span>{STAT_LABEL[k]}</span>
    <span className="cg-stat-track" aria-hidden="true"><i className={`tone-${tone}`} style={{width: `${v}%`}}/>{cap != null && <b style={{left: `${cap}%`}}/>}</span>
    <strong>{Math.floor(v)}</strong>
  </div>;
}

/* ================================================================== hub */
// The hub is split so each screen does one job: four tabs for the career itself, and the phone for everything around it.
type HubTab = 'camp' | 'fighter' | 'team' | 'division';
const HUB_TABS: {id: HubTab; label: string; Icon: typeof Dumbbell}[] = [{id: 'camp', label: 'This week', Icon: Dumbbell}, {id: 'fighter', label: 'Fighter', Icon: UserRound}, {id: 'team', label: 'Team', Icon: Users}, {id: 'division', label: 'Division', Icon: Trophy}];
const TAB_KEY = 'versus-hub-tab';

function Hub({career: c, update, startFightNight}: {career: Career; update: (c: Career | null) => void; startFightNight: () => void}) {
  const [focus, setFocus] = useState<StatKey>('striking');
  const [tab, setTabState] = useState<HubTab>('camp');
  const [app, setApp] = useState<PhoneApp>(c.choice ? 'messages' : 'home');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [drill, setDrill] = useState<StatKey | 'spar' | null>(null);
  const [shared, setShared] = useState('');
  const lastChoice = useRef(c.choice?.title);
  useEffect(() => { if (c.choice?.title && c.choice.title !== lastChoice.current) sfx.ping(); lastChoice.current = c.choice?.title; }, [c.choice?.title]);
  const share = async () => { setShared('Making your card…'); const r = await shareCareer(c); setShared(r === 'saved' ? 'Card saved to your downloads.' : r === 'shared' ? 'Shared.' : ''); };
  // the first scene of a new career leads straight to the walkout
  const closeScene = () => { const n = dismissScene(c); update(n); if (!n.scenes?.length && n.camp?.story?.id === 'debut' && n.camp.weeksLeft === 0 && !n.history.length && !n.choice) startFightNight(); };
  useEffect(() => { const t = load<HubTab>(TAB_KEY); if (t && HUB_TABS.some(x => x.id === t)) setTabState(t); }, []);
  const setTab = (t: HubTab) => { setTabState(t); save(TAB_KEY, t); };
  // a new decision brings the phone to the conversation
  useEffect(() => { if (c.choice) setApp('messages'); }, [c.choice?.title, c.week]);
  const closePhone = useCallback(() => setPhoneOpen(false), []);
  const openMessages = () => { setApp('messages'); setPhoneOpen(true); };
  const tabKeys = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
    e.preventDefault(); const next = HUB_TABS[(i + d + HUB_TABS.length) % HUB_TABS.length]; setTab(next.id); document.getElementById(`hub-tab-${next.id}`)?.focus();
  };
  const opp = c.camp ? npc(c, c.camp.opponentId) : undefined;
  const fightWeek = !!c.camp && c.camp.weeksLeft === 0;
  const injured = c.injuryWeeks > 0;
  const act = (a: Parameters<typeof takeAction>[1]) => update(takeAction(c, a));
  const tier = TIERS[c.tier];
  const unread = (c.choice ? 1 : 0);
  const campAlert = fightWeek ? '!' : !c.camp && c.offers.length ? String(c.offers.length) : '';

  return <div className="bn-page cg cg-hub">
    <section className={`panel cg-head ${c.champ ? 'is-champ' : ''}`}>
      <Avatar name={c.name} color={c.color} size="md"/>
      <div className="cg-head-copy">
        <h1>{c.name}</h1>
        <p className="muted">{c.nickname ? `“${c.nickname}” · ` : ''}{c.division} · {c.style} · Age {c.age}</p>
      </div>
      <div className="bn-pills">
        <span className={`sticker ${tier.color}`} style={{'--tilt': '-2deg'} as React.CSSProperties}>{tier.short}</span>
        {c.champ ? <span className="sticker sun" style={{'--tilt': '2deg'} as React.CSSProperties}><Crown size={13} aria-hidden="true"/> Champion</span>
          : c.rank ? <span className="sticker lime" style={{'--tilt': '2deg'} as React.CSSProperties}>#{c.rank}</span> : null}
        {(c.divisionTitles?.length ?? 0) >= 2 && <span className="sticker violet" style={{'--tilt': '-2deg'} as React.CSSProperties}>{c.divisionTitles!.length}-division champ</span>}
        {injured && <span className="sticker pink">Injured · {c.injuryWeeks}w</span>}
        {(c.cut ?? 0) > 0 && <span className="sticker pink" title="A cut from your last fight. Rest heals it faster, sparring can split it open.">Cut · {c.cut}%</span>}
      </div>
      <div className="cg-record"><strong>{c.record.join('–')}</strong><span className="cg-ovr">OVR {overall(c.stats)}</span></div>
    </section>

    <section className="cg-meters" aria-label="Condition">
      <Meter icon={<Zap size={15}/>} label="Energy" v={c.energy} tone="lime"/>
      <Meter icon={<HeartPulse size={15}/>} label="Health" v={c.health} tone="pink"/>
      <Meter icon={<Flame size={15}/>} label="Hype" v={c.hype} tone="sun"/>
      <Meter icon={<Activity size={15}/>} label={fitnessLabel(c.fitness ?? 55)} v={c.fitness ?? 55} tone="sky"/>
      <button type="button" className="cg-meter bank" onClick={() => { setApp('bank'); setPhoneOpen(true); }} aria-label={`Bank: ${money(c.money)}. Open your bank`}><span><Wallet size={15} aria-hidden="true"/> Bank</span><strong className={c.money < 0 ? 'neg' : ''}>{money(c.money)}</strong></button>
    </section>

    <div className="cg-layout">
      <div className="cg-stage">
        <div className="cg-tabs" role="tablist" aria-label="Career">
          {HUB_TABS.map((t, i) => <button key={t.id} id={`hub-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls="hub-panel" tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)} onKeyDown={e => tabKeys(e, i)}>
            <t.Icon size={18} aria-hidden="true"/><span>{t.label}</span>{t.id === 'camp' && campAlert && tab !== 'camp' && <b>{campAlert}</b>}
          </button>)}
        </div>

        <div id="hub-panel" role="tabpanel" aria-labelledby={`hub-tab-${tab}`} className={`cg-pane ${tab}`} key={tab}>
          {tab === 'camp' && <>
            {c.choice && <button type="button" className="cg-msgbanner" onClick={openMessages}><Smartphone size={18} aria-hidden="true"/><span><strong>{c.choice.kind === 'press' ? 'Fight week media' : c.choice.from ?? 'New message'}</strong>{c.choice.title}</span><ChevronRight size={18} aria-hidden="true"/></button>}

            {c.dual && <BeltClocks c={c}/>}
            {c.contract && !c.retired && <ContractCard c={c}/>}

            {c.camp && opp && <section className={`panel cg-camp ${fightWeek ? 'fight-week' : ''}`}>
              <span className="eyebrow">{c.camp.event ? `${c.camp.event} · ${c.camp.billing} · ` : ''}{fightWeek ? 'Fight week' : `${c.camp.weeksLeft} week${c.camp.weeksLeft === 1 ? '' : 's'} out`}</span>
              <div className="cg-vs">
                <Avatar name={c.name} color={c.color}/><img src="/art/vs-badge.webp" alt="versus" width={64} height={64}/><Avatar name={opp.name} color={opp.color}/>
              </div>
              <h2>{c.camp.title ? (c.champ ? 'Title defense' : 'Title fight') : c.camp.note} vs {opp.name}</h2>
              {heatOf(c, opp.id) >= 40 && <span className="sticker pink" style={{'--tilt': '-2deg'} as React.CSSProperties}>Bad blood</span>}
              <p className="muted">“{opp.nickname}” · {opp.style} · {opp.record.join('–')} · OVR {overall(opp.stats)} · {c.camp.rounds} rounds · Purse {money(c.camp.purse)} + {money(c.camp.winBonus)} to win</p>
              {(c.camp.edge ?? 0) > .02 && <p className="cg-warn">{opp.name.split(' ')[0]} is fired up for this one. Expect his best.</p>}
              {(c.camp.edge ?? 0) < -.02 && <p className="muted">{opp.name.split(' ')[0]} looked rattled at fight week.</p>}
              {c.camp.story && <div className="cg-storyfight"><Target size={18} aria-hidden="true"/><span><strong>{c.camp.story.title}</strong><small>{c.camp.story.brief}</small><b>Bonus goal: {c.camp.story.goal.label} · {money(c.camp.story.bonus)}</b></span></div>}
              <div className="cg-campinfo">
                <span><Activity size={14} aria-hidden="true"/> Fight-night condition: <b className={`fit-${fitnessLabel(c.fitness ?? 55).split(' ')[0].toLowerCase()}`}>{fitnessLabel(c.fitness ?? 55)}</b> ({Math.round(c.fitness ?? 55)})</span>
                <span><Film size={14} aria-hidden="true"/> {c.camp.scouted ? 'Tape studied: you know his habits' : 'His tape: not studied yet'}</span>
                {c.camp.missedWeight && <span className="cg-warn">Missed weight: 20% of the purse goes to him, and you're drained.</span>}
                {(c.cut ?? 0) >= 15 && <span className="cg-warn">Cut over the eye ({c.cut}%): {c.camp.weeksLeft === 0 ? 'it will open with the first hard shot. Protect it.' : 'rest closes it faster, sparring can split it open.'}</span>}
              </div>
              {!fightWeek && <div className="cg-camplevel" role="group" aria-label="Fight camp">
                {CAMP_LEVELS.map((l, i) => { const cur = c.camp!.level ?? 0; const price = campPrice(c, i) - campPrice(c, cur);
                  return <button key={l.label} type="button" className={`button ${i === cur ? 'primary' : 'outline'}`} disabled={i <= cur || c.money < price} onClick={() => update(buy(c, {type: 'camp', level: i}))}>
                    <strong>{l.label}</strong><small>{i === cur ? 'Booked' : i < cur ? '' : `${money(price)} · fitness gains ×${l.mult}${i === 2 ? ', film team' : ''}`}</small></button>; })}
              </div>}
              {fightWeek && <button className="button primary cg-big" onClick={c.choice ? openMessages : startFightNight}>{c.choice ? <Smartphone size={18} aria-hidden="true"/> : <Swords size={18} aria-hidden="true"/>}{c.choice ? 'Answer your phone first' : 'Walk out to the cage'}</button>}
            </section>}

            {!fightWeek && <section className="panel cg-week">
              <div className="section-heading"><h2>This week</h2><span className="muted">{yearWeek(c.week)}</span></div>
              {c.energy < 30 && !injured && <p className="cg-warn" role="alert">Energy {Math.round(c.energy)}: you're exhausted. Training or sparring now carries a real injury risk{c.camp ? ', and an injury can cost you the fight' : ''}. Rest first.</p>}
              {c.week < (c.noSparUntil ?? 0) && <p className="cg-warn">Doctor's orders after the knockout: no sparring for {(c.noSparUntil ?? 0) - c.week} more week{(c.noSparUntil ?? 0) - c.week === 1 ? '' : 's'}.</p>}
              <div className="cg-actions">
                <div className={`cg-action train ${injured ? 'off' : ''}`}>
                  <Dumbbell size={22} aria-hidden="true"/><strong>{ACTIONS.train.label}</strong><small>{ACTIONS.train.blurb}</small>
                  <label className="sr-only" htmlFor="cg-focus">Training focus</label>
                  <select id="cg-focus" value={focus} onChange={e => setFocus(e.target.value as StatKey)}>{STAT_KEYS.map(k => <option key={k} value={k}>{STAT_LABEL[k]} ({Math.floor(c.stats[k])})</option>)}</select>
                  <button className="button primary" disabled={injured} onClick={() => c.skipDrills ? act({type: 'train', focus, skipped: true}) : setDrill(focus)}>Train {STAT_LABEL[focus].toLowerCase()}</button>
                </div>
                <ActionCard icon={<Swords size={22}/>} k="spar" off={injured} onClick={() => c.skipDrills ? act({type: 'spar', skipped: true}) : setDrill('spar')}/>
                <ActionCard icon={<BedDouble size={22}/>} k="rest" onClick={() => act({type: 'rest'})}/>
                <ActionCard icon={<Megaphone size={22}/>} k="promote" onClick={() => act({type: 'promote'})}/>
                <ActionCard icon={<Film size={22}/>} k="tape" onClick={() => act({type: 'tape'})}/>
              </div>
            </section>}

            {!c.camp && <section className="panel cg-offers">
              <div className="section-heading"><h2>Fight offers</h2><span className="muted">{TIERS[c.tier].short}</span></div>
              {!c.offers.length && <p className="muted">{injured ? 'No offers while you are injured.' : c.week < c.nextOfferWeek ? `Recovering from your last fight. Offers in ${c.nextOfferWeek - c.week} week(s).` : 'Your manager is working the phones. Check back next week.'}</p>}
              {c.offers.map(o => { const n = npc(c, o.opponentId)!; const gap = overall(n.stats) - overall(c.stats); return <article key={o.id} className={`cg-offer ${o.title ? 'title' : ''}`}>
                <Avatar name={n.name} color={n.color}/>
                <div className="cg-offer-body">
                  <span className="bn-pills">
                    <span className={`sticker ${o.title ? 'sun' : o.tag === 'rematch' || o.tag === 'grudge' ? 'pink' : o.tag === 'eliminator' ? 'violet' : o.tag === 'short' ? 'sky' : gap > 8 ? 'pink' : gap < -8 ? 'lime' : 'sky'}`} style={{'--tilt': '-2deg'} as React.CSSProperties}>{o.note}</span>
                    {heatOf(c, n.id) >= 40 && o.tag !== 'grudge' && <span className="sticker pink" style={{'--tilt': '2deg'} as React.CSSProperties}>Bad blood</span>}
                  </span>
                  <strong>{n.name}</strong>
                  <small>“{n.nickname}” · {n.style} · {n.record.join('–')} · OVR {overall(n.stats)}{c.tier === 2 ? rankText(c, n.id) : ''}</small>
                  <small>{o.rounds} rounds in {o.weeksOut} weeks · {money(o.purse)} + {money(o.winBonus)} win bonus</small>
                </div>
                <div className="cg-offer-actions">
                  <button className="button primary" onClick={() => update(acceptOffer(c, o.id))}><Check size={16} aria-hidden="true"/>Sign</button>
                  <button className="button outline" onClick={() => update(declineOffer(c, o.id))} aria-label={`Decline ${n.name}`}><X size={16} aria-hidden="true"/></button>
                </div>
              </article>; })}
            </section>}
          </>}

          {tab === 'fighter' && <>
            <section className="panel cg-stats">
              <div className="section-heading"><h2>Attributes</h2><span className="muted">Potential {c.potential}</span></div>
              <div className="cg-statlist">{STAT_KEYS.map(k => <StatBar key={k} k={k} v={c.stats[k]} cap={c.potential}/>)}</div>
            </section>
            <section className="panel cg-history">
              <div className="section-heading"><h2>Fight record</h2><span className="muted">{c.finishes.ko} KO · {c.finishes.sub} SUB · {c.finishes.dec} DEC</span></div>
              {c.history.length ? <ol>{c.history.slice(0, 8).map((h, i) => <li key={i}><span className={`bn-res ${h.result === 'W' ? 'win' : h.result === 'L' ? 'loss' : ''}`}>{h.result}</span><span><strong>{h.opponent}{h.title ? ' · title' : ''}</strong><small>{h.method} · R{h.round} · {TIERS[h.tier].short} · {money(h.purse)}</small></span></li>)}</ol> : <p className="muted">No fights yet. Sign your first one under This week.</p>}
            </section>
            <section className="panel cg-sharecard"><div><h2>Share your career</h2><p className="muted">Turn your record and belts into an image you can post.</p>{shared && <p className="muted" role="status">{shared}</p>}</div><button type="button" className="button primary" onClick={share}><Share2 size={16} aria-hidden="true"/>Share my career</button></section>
            <CareerExtras c={c}/>
            <Locker c={c} update={update}/>
          </>}

          {tab === 'team' && <><Team c={c} update={update}/><Trips c={c} update={update}/></>}

          {tab === 'division' && <>
            <Rankings c={c} update={update}/>
            <div className="cg-col">
              {c.tier === 2 && <LegendPath c={c} update={update}/>}
              <YearTargets c={c}/>
              <Storylines c={c}/>
              <section className="panel cg-legends">
                <h2>Measured against legends</h2>
                <LegendMatches c={c}/>
              </section>
            </div>
          </>}
        </div>
      </div>

      <CareerPhone c={c} update={update} app={app} setApp={setApp} open={phoneOpen} onClose={closePhone} onTeam={() => { setTab('team'); setPhoneOpen(false); }}/>
    </div>

    <button type="button" className={`cp-fab ${unread ? 'ring' : ''}`} onClick={() => setPhoneOpen(true)} aria-label={unread ? 'Open your phone, 1 new message' : 'Open your phone'}><Smartphone size={24} aria-hidden="true"/>{!!unread && <b>{unread}</b>}</button>
    {c.scenes?.[0] && <StoryScene key={`${c.week}-${c.scenes[0].id}-${c.scenes.length}`} scene={c.scenes[0]} onDone={closeScene}/>}
    {drill && <Drill kind={drillFor(drill)} label={drill === 'spar' ? 'Sparring' : STAT_LABEL[drill]} onDone={q => { const d = drill; setDrill(null); act(d === 'spar' ? {type: 'spar', quality: q, skipped: q == null} : {type: 'train', focus: d, quality: q, skipped: q == null}); }}
      onAlwaysSkip={() => { const d = drill; setDrill(null); update(takeAction(setSkipDrills(c, true), d === 'spar' ? {type: 'spar', skipped: true} : {type: 'train', focus: d, skipped: true})); }}/>}
  </div>;
}

/** the current deal: a few fights, clear targets, and your pay rides on them */
function ContractCard({c}: {c: Career}) {
  const d = c.contract!, played = d.fights - d.left;
  return <section className="panel cg-contract" aria-label="Your contract">
    <div className="section-heading"><h2><FileSignature size={18} aria-hidden="true"/> Your contract</h2><span className="muted">{d.left} of {d.fights} fights left</span></div>
    <ul><li className={d.wins >= d.needWins ? 'done' : ''}><span>Win {d.needWins} fights</span><b>{Math.min(d.wins, d.needWins)}/{d.needWins}</b></li><li className={d.finishes >= d.needFinishes ? 'done' : ''}><span>Get {d.needFinishes} finish{d.needFinishes === 1 ? '' : 'es'}</span><b>{Math.min(d.finishes, d.needFinishes)}/{d.needFinishes}</b></li></ul>
    <p className="muted">Hit both for a bonus and a 10% raise. Miss both and your purses drop 10%.{played ? '' : ' This deal has just started.'}</p>
  </section>;
}

/** a double champion's two deadlines */
function BeltClocks({c}: {c: Career}) {
  return <section className="panel cg-clocks" aria-label="Title defense deadlines">
    <div className="section-heading"><h2><Crown size={18} aria-hidden="true"/> Both belts</h2><span className="muted">Defend or be stripped</span></div>
    <ul>{beltClocks(c).map(b => <li key={b.division} className={!b.booked && b.weeks <= 4 ? 'urgent' : ''}>
      <span><strong>{b.division}</strong><small>{b.booked ? 'Defense signed' : b.weeks === 0 ? 'Sign a defense this week' : `Sign a defense within ${b.weeks} week${b.weeks === 1 ? '' : 's'}`}</small></span>
      <span className="bn-meter-track" aria-hidden="true"><i className={`tone-${b.booked ? 'lime' : b.weeks <= 4 ? 'pink' : 'sun'}`} style={{width: `${b.booked ? 100 : Math.min(100, b.weeks / DUAL_RULES.clock * 100)}%`}}/></span>
    </li>)}</ul>
  </section>;
}

/** the rarest thing in the game: only a dominant champion is ever allowed to change weight class */
function LegendPath({c, update}: {c: Career; update: (c: Career | null) => void}) {
  const [pick, setPick] = useState<Division | null>(null);
  if (c.dual) return <section className="panel cg-legendpath ready"><span className="eyebrow">Double champion</span><h2>Holding two belts</h2>
    <p className="muted">Each belt must be defended every {DUAL_RULES.clock} weeks on {DUAL_RULES.camp}-week camps. If it gets too much, you can give one up.</p>
    {c.camp ? <p className="muted">Finish this camp before giving up a belt.</p> : pick ? <div className="cg-legendconfirm"><p>Give up the <strong>{pick}</strong> title for good?</p>
      <div className="bn-ctas"><button type="button" className="button primary" onClick={() => { update(relinquishBelt(c, pick)); setPick(null); }}>Give it up</button><button type="button" className="button outline" onClick={() => setPick(null)}>Keep both</button></div></div>
      : <div className="cg-legendmoves">{c.dual.belts.map(b => <button key={b} type="button" className="button outline" onClick={() => setPick(b)}><strong>Give up {b}</strong></button>)}</div>}
  </section>;
  const checks = legendChecks(c), ready = legendReady(c), {up, down} = adjacentDivisions(c);
  if (c.superfight) return <section className="panel cg-legendpath ready"><span className="eyebrow">Superfight</span><h2>Chasing a second belt</h2><p className="muted">Beat the {c.division} champion to make history. Lose and you go home to {c.superfight.from} with your belt.</p></section>;
  const busy = !!c.camp || c.injuryWeeks > 0;
  return <section className={`panel cg-legendpath ${ready ? 'ready' : ''}`}>
    <span className="eyebrow">Legends only</span>
    <h2>{ready ? 'A second weight class' : 'Change weight class'}</h2>
    <p className="muted">{ready ? 'You have earned what almost nobody earns. Your current belt waits at home while you fight for another.' : 'Only the most dominant champions in history are allowed to chase a belt in another division.'}</p>
    <ul>{checks.map(x => <li key={x.label} className={x.done ? 'done' : ''}><Check size={15} aria-hidden="true"/><span>{x.label}</span><b>{'most' in x ? x.have : x.need === 1 ? (x.done ? 'Yes' : 'No') : `${Math.floor(Math.min(x.have, x.need))}/${x.need}`}</b></li>)}</ul>
    {ready && (busy ? <p className="muted">Finish your current camp or recovery first.</p> : pick ? <div className="cg-legendconfirm">
      <p>Move to <strong>{pick}</strong> and fight its champion next?</p>
      <div className="bn-ctas"><button type="button" className="button primary" onClick={() => update(moveDivision(c, pick))}>Confirm move</button><button type="button" className="button outline" onClick={() => setPick(null)}>Cancel</button></div>
    </div> : <div className="cg-legendmoves">
      {up && <button type="button" className="button primary" onClick={() => setPick(up)}><strong>Move up to {up}</strong><small>More power and chin. Slower, less cardio.</small></button>}
      {down && <button type="button" className="button outline" onClick={() => setPick(down)}><strong>Drop to {down}</strong><small>Much faster. Weaker chin and a brutal cut.</small></button>}
    </div>)}
  </section>;
}

const rankText = (c: Career, id: string) => { const i = c.rankings.indexOf(id); return c.champion === id ? ' · Champion' : i >= 0 ? ` · #${i + 1}` : ''; };

function Meter({icon, label, v, tone}: {icon: React.ReactNode; label: string; v: number; tone: string}) {
  return <div className="cg-meter"><span>{icon} {label}</span><strong>{Math.round(v)}</strong><span className="bn-meter-track" aria-hidden="true"><i className={`tone-${tone}`} style={{width: `${v}%`}}/></span></div>;
}


/** the people and things money buys: coaches, recovery, PR */
function Team({c, update}: {c: Career; update: (c: Career | null) => void}) {
  return <section className="panel cg-team">
    <div className="section-heading"><h2>Team &amp; spending</h2><span className="muted">Bills {money(weeklyCost(c))}/week</span></div>
    <ul className="cg-coaches">{(Object.keys(COACHES) as CoachKey[]).map(k => { const lvl = c.team?.[k] ?? 0; const co = COACHES[k];
      return <li key={k}><span><strong>{co.label}</strong><small>{co.stats.map(s => STAT_LABEL[s]).join(', ')} grow {lvl === 2 ? '45%' : lvl === 1 ? '20%' : ''}{lvl ? ' faster' : 'at the normal rate'}</small></span>
        <span className="bn-seg" role="group" aria-label={co.label}>
          {[0, 1, 2].map(l => <button key={l} type="button" aria-pressed={lvl === l} onClick={() => update(buy(c, {type: 'coach', key: k, level: l}))}>{l === 0 ? 'None' : `${l === 1 ? 'Local' : 'Elite'} ${money(co.pay[l])}/wk`}</button>)}
        </span></li>; })}</ul>
    <div className="bn-ctas">
      <button className="button outline" disabled={c.money < physioPrice(c)} onClick={() => update(buy(c, {type: 'physio'}))}><Stethoscope size={16} aria-hidden="true"/>Physio &amp; recovery {money(physioPrice(c))}</button>
      <button className="button outline" disabled={c.money < prPrice(c)} onClick={() => update(buy(c, {type: 'pr'}))}><Megaphone size={16} aria-hidden="true"/>PR campaign {money(prPrice(c))}</button>
    </div>
    {c.lastPayout && <p className="muted">Last purse: {money(c.lastPayout.gross)} gross, {money(c.lastPayout.manager)} to your manager, {money(c.lastPayout.gym)} to the gym, {money(c.lastPayout.net)} to you{c.lastPayout.bonus ? ` + ${money(c.lastPayout.bonus)} bonus` : ''}. Career earnings {money(c.earnings ?? 0)}.</p>}
  </section>;
}

/** change your look; premium ink and walkout gear cost money */
function Locker({c, update}: {c: Career; update: (c: Career | null) => void}) {
  const [open, setOpen] = useState(false);
  const look = c.look ?? {...DEFAULT_LOOK};
  return <section className="panel cg-locker">
    <div className="section-heading"><h2><Shirt size={18} aria-hidden="true"/> Locker room</h2><button type="button" className="button outline" onClick={() => setOpen(o => !o)}>{open ? 'Done' : 'Change your look'}</button></div>
    {open ? <LookEditor look={look} owned={c.owned} cash={c.money} onChange={l => update(buy(c, {type: 'look', look: l}))} onBuy={(id, price) => update(buy(c, {type: 'cosmetic', id, price}))}/>
      : <p className="muted">{look.tattoos.length ? `${look.tattoos.length} tattoo${look.tattoos.length > 1 ? 's' : ''}` : 'No ink yet'} · {look.gear.length ? look.gear.length + ' gear' : 'no gear'}. New tattoos and walkout gear cost money, and they show on fight night.</p>}
  </section>;
}

function ActionCard({icon, k, onClick, off}: {icon: React.ReactNode; k: 'spar' | 'rest' | 'promote' | 'tape'; onClick: () => void; off?: boolean}) {
  const a = ACTIONS[k];
  return <button className={`cg-action ${off ? 'off' : ''}`} onClick={onClick} disabled={off}>
    {icon}<strong>{a.label}</strong><small>{a.blurb}</small><span className={`cg-energy ${a.energy > 0 ? 'up' : ''}`}>{a.energy > 0 ? '+' : ''}{a.energy} energy</span>
  </button>;
}

function YearTargets({c}: {c: Career}) {
  const t = targetProgress(c), weeksLeft = 52 - (c.week % 52);
  return <section className="panel cg-targets"><h2>This year's targets</h2>
    <p className="muted">Checked at the awards on your birthday, {weeksLeft} week{weeksLeft === 1 ? '' : 's'} away. Each one you hit is worth hype.</p>
    <ul>{t.map(x => <li key={x.label} className={x.done ? 'done' : ''}>{x.done ? <Check size={15} aria-label="Done"/> : <Target size={15} aria-hidden="true"/>} {x.label}</li>)}</ul>
    {(c.awards?.length ?? 0) > 0 && <div className="cg-trophies">{c.awards!.map((a, i) => <span key={i} className="sticker sun" title={a.detail}><Trophy size={13} aria-hidden="true"/> {a.label} · Y{a.year}</span>)}</div>}
  </section>;
}

function Rankings({c, update}: {c: Career; update: (c: Career | null) => void}) {
  if (c.tier < 2) {
    const list = [...c.roster.filter(n => n.tier === c.tier)].sort((a, b) => (b.record[0] - b.record[1]) - (a.record[0] - a.record[1])).slice(0, 8);
    const myPlace = list.filter(n => n.record[0] - n.record[1] > c.record[0] - c.record[1]).length;   // where you'd slot in (you show up only inside the top 8)
    return <section className="panel cg-rank"><h2>{TIERS[c.tier].short} standouts</h2><p className="muted">Win {c.tier === 0 ? 3 : 2} here with some hype to get called up. {c.tierWins} so far.</p>
      <ol>{list.map((n, i) => <Fragment key={n.id}><li><Avatar name={n.name} color={n.color} size="sm"/><span>{n.name}{(n.streak ?? 0) >= 3 && <em className="cg-hot" title={`${n.streak} wins in a row`}>W{n.streak}</em>}</span><small><CallOutButton c={c} id={n.id} update={update}/>{n.record.join('–')}</small></li>
        {i === myPlace - 1 && <li className="you"><Avatar name={c.name} color={c.color} size="sm"/><span>{c.name} (you)</span><small>{c.record.join('–')}</small></li>}</Fragment>)}
        {myPlace === 0 && <li key="you" className="you"><Avatar name={c.name} color={c.color} size="sm"/><span>{c.name} (you)</span><small>{c.record.join('–')}</small></li>}</ol></section>;
  }
  const champ = c.champion === 'you' ? null : npc(c, c.champion!);
  return <section className="panel cg-rank"><h2>{c.division} rankings</h2>
    <ol>
      <li className={`champ ${c.champ ? 'you' : ''}`}><span className="cg-rk"><Crown size={14} aria-label="Champion"/></span><span>{c.champ ? c.name : champ?.name}</span><small>{!c.champ && champ && (c.rank ?? 99) <= 5 && <CallOutButton c={c} id={champ.id} update={update}/>}{c.champ ? c.record.join('–') : champ?.record.join('–')}</small></li>
      {c.rankings.map((id, i) => { const n = id === 'you' ? null : npc(c, id); const p = (c.lastRanks ?? []).indexOf(id) - 1, mv = !c.lastRanks?.length ? 0 : p < 0 ? 99 : p - i;
        return <li key={id} className={id === 'you' ? 'you' : ''}><span className="cg-rk">{i + 1}</span><span>{n ? n.name : c.name}{(n?.streak ?? 0) >= 3 && <em className="cg-hot" title={`${n!.streak} wins in a row`}>W{n!.streak}</em>}</span><small><CallOutButton c={c} id={id} update={update}/>{mv === 99 ? <b className="cg-mv up">NEW</b> : mv > 0 ? <b className="cg-mv up">▲{mv}</b> : mv < 0 ? <b className="cg-mv down">▼{-mv}</b> : null}{n ? n.record.join('–') : c.record.join('–')}</small></li>; })}
    </ol></section>;
}

/** rivals with their heat, and who has held the belt */
function Storylines({c}: {c: Career}) {
  const rivals = (c.rivals ?? []).map(rv => ({rv, n: npc(c, rv.id)})).filter(x => x.n);
  const lineage = c.lineage ?? [];
  if (!rivals.length && lineage.length < 1) return null;
  return <section className="panel cg-story">
    <h2>Storylines</h2>
    {rivals.length > 0 ? <ol className="cg-rivals">{rivals.map(({rv, n}) => <li key={rv.id}>
      <Avatar name={n!.name} color={n!.color} size="sm"/>
      <span><strong>{n!.name}</strong><small>{rv.why} · {TIERS[n!.tier].short}{rankText(c, n!.id)}</small></span>
      <span className="bn-meter-track" title={`Heat ${rv.heat}`} aria-label={`Heat ${rv.heat} of 100`}><i className={`tone-${rv.heat >= 60 ? 'pink' : rv.heat >= 40 ? 'sun' : 'sky'}`} style={{width: `${rv.heat}%`}}/></span>
    </li>)}</ol> : <p className="muted">No rivals yet. Lose to someone, win a split, or get called out and it gets personal.</p>}
    {lineage.length > 0 && <><h3 className="cg-sub">{c.division} title lineage</h3>
      <ol className="cg-lineage">{lineage.slice(0, 6).map((l, i) => <li key={i} className={l.name === c.name ? 'you' : ''}><Crown size={13} aria-hidden="true"/><strong>{l.name}</strong><small>{l.how} · {yearWeek(l.week)}</small></li>)}</ol></>}
    {(c.bonuses?.potn || c.bonuses?.fotn) ? <p className="muted">Bonuses: {c.bonuses!.potn} Performance of the Night · {c.bonuses!.fotn} Fight of the Night</p> : null}
  </section>;
}

function LegendMatches({c}: {c: Career}) {
  const [w, l] = c.record;
  const near = [...competitors].sort((a, b) => Math.abs(a.record[0] - w) + Math.abs(a.record[1] - l) - (Math.abs(b.record[0] - w) + Math.abs(b.record[1] - l))).slice(0, 3);
  if (w + l === 0) return <p className="muted">Win some fights and we will show you which real UFC fighters your record looks like.</p>;
  return <><p className="muted">Real UFC careers closest to your {c.record.join('–')} record:</p>
    <ul className="cg-legend-list">{near.map(f => <li key={f.id}><a href={`/fighter/${f.id}`}><strong>{f.name}</strong><small>{f.record.join('–')} · {f.division}</small></a></li>)}</ul>
    <a className="text-link" href="/legends">Browse all {competitors.length} legends →</a></>;
}

/* =========================================================== fight night */
function FightNight({career: c, fight: f, setFight, onDone}: {career: Career; fight: FightState; setFight: (f: FightState) => void; onDone: (o: NonNullable<FightState['outcome']>) => void}) {
  const [plan, setPlan] = useState<Plan>(c.style === 'Wrestler' ? 'Wrestle' : c.style === 'Grappler' ? 'Submit' : 'Pressure');
  const opp = npc(c, c.camp!.opponentId) as NPC;
  const last = f.rounds_log[f.rounds_log.length - 1];
  const out = f.outcome;
  return <div className="bn-page cg cg-fight">
    <section className="panel cg-fight-head">
      <Side name={c.name} color={c.color} corner={f.you} label="You" side="red"/>
      <div className="cg-fight-mid">
        <img src="/art/vs-badge.webp" alt="versus" width={110} height={110}/>
        <strong>{out ? 'Final' : `Round ${f.round} of ${f.rounds}`}</strong>
        {c.camp?.title && <span className="sticker sun">Title fight</span>}
      </div>
      <Side name={opp.name} color={opp.color} corner={f.opp} label={`“${opp.nickname}”`} side="blue"/>
    </section>

    {!out && <section className="panel cg-plan">
      <h2>Corner instructions</h2>
      <p className="muted">Pick the game plan for round {f.round}. {opp.style}s like {opp.name.split(' ')[0]} {opp.style === 'Striker' ? 'want to stand and bang.' : opp.style === 'Wrestler' ? 'will shoot for takedowns.' : opp.style === 'Grappler' ? 'want this on the mat.' : 'can do a bit of everything.'}</p>
      <div className="cg-plans" role="radiogroup" aria-label="Game plan">
        {(Object.keys(PLANS) as Plan[]).map(p => <button key={p} type="button" role="radio" aria-checked={plan === p} className={`tone-border-${PLANS[p].tone} ${plan === p ? 'on' : ''}`} onClick={() => setPlan(p)}>
          <strong>{p}</strong><small>{PLANS[p].blurb}</small>
        </button>)}
      </div>
      <button className="button primary cg-big" onClick={() => setFight(fightRound(f, plan))}><Shield size={18} aria-hidden="true"/>Fight round {f.round}</button>
    </section>}

    {out && <section className={`panel cg-result ${out.winner}`}>
      <img src={out.winner === 'you' ? '/art/trophy.webp' : '/art/gem.webp'} alt="" width={130} height={130}/>
      <div>
        <span className="eyebrow">{out.winner === 'you' ? 'Victory' : out.winner === 'opp' ? 'Defeat' : 'Draw'}</span>
        <h2>{out.winner === 'you' ? `You win by ${out.method}` : out.winner === 'opp' ? `${opp.name} wins by ${out.method}` : 'Scored a draw'} · R{out.round}</h2>
        {(out.method === 'DEC' || out.method === 'SPLIT DEC' || out.method === 'DRAW') && <p className="muted">Scorecards: {f.cards.map(([a, b]) => `${a}–${b}`).join(', ')}</p>}
        <p className="muted">Purse: {money(c.camp!.purse + (out.winner === 'you' ? c.camp!.winBonus : 0))}</p>
        <button className="button primary" onClick={() => onDone(out)}>Back to camp <ChevronRight size={18} aria-hidden="true"/></button>
      </div>
    </section>}

    <section className="panel cg-pbp" aria-live="polite">
      <h2>Play by play</h2>
      {!f.rounds_log.length && <p className="muted">The cage door closes. Referee checks both corners…</p>}
      {[...f.rounds_log].reverse().map(rl => <div key={rl.round} className={`cg-round ${rl === last ? 'latest' : ''}`}>
        <h3>Round {rl.round}</h3>
        <ul>{rl.lines.map((l, i) => <li key={i} className={`${l.side} ${l.big ? 'big' : ''}`}>{l.text}</li>)}</ul>
      </div>)}
    </section>
  </div>;
}

function Side({name, color, corner, label, side}: {name: string; color: string; corner: FightState['you']; label: string; side: 'red' | 'blue'}) {
  return <div className={`cg-side ${side}`}>
    <Avatar name={name} color={color} size="lg"/>
    <strong>{name}</strong><small>{label}</small>
    <div className="cg-bars">
      <span className="cg-bar-k">Health</span><span className="bn-meter-track"><i className="tone-pink" style={{width: `${Math.max(0, corner.hp)}%`}}/></span>
      <span className="cg-bar-k">Stamina</span><span className="bn-meter-track"><i className="tone-sky" style={{width: `${corner.stamina}%`}}/></span>
    </div>
    <small className="muted">{corner.landed} landed · {corner.takedowns} TD · {corner.knockdowns} KD</small>
  </div>;
}

/* ============================================================== retired */
function Retired({career: c, onNew}: {career: Career; onNew: () => void}) {
  const titles = c.history.filter(h => h.title && h.result === 'W').length;
  const end = epilogue(migrate(structuredClone(c)));
  return <div className="bn-page cg">
    <section className="panel cg-retired">
      <img src="/art/trophy.webp" alt="" width={180} height={180}/>
      <span className="eyebrow">{end.headline}</span>
      <h1>{c.name}</h1>
      <p className="muted">Retired at {c.age} · {TIERS[c.tier].name}{(c.divisionTitles?.length ?? 0) > 0 ? ` · Champion at ${c.divisionTitles!.join(' and ')}` : ''}</p>
      <div className="cg-epilogue"><h2>What happened next</h2>{end.lines.map((l, i) => <p key={i}>{l}</p>)}</div>
      <button type="button" className="button outline" onClick={() => void shareCareer(c)}><Share2 size={16} aria-hidden="true"/>Share my career</button>
      <div className="cg-retired-stats">
        <div><strong>{c.record.join('–')}</strong><span>Record</span></div>
        <div><strong>{titles}</strong><span>Title wins</span></div>
        <div><strong>{c.finishes.ko + c.finishes.sub}</strong><span>Finishes</span></div>
        <div><strong>{legacy(c)}</strong><span>Legacy score</span></div>
      </div>
      <LegendMatches c={c}/>
      <button className="button primary cg-big" onClick={onNew}><RotateCcw size={18} aria-hidden="true"/>Start a new career</button>
    </section>
  </div>;
}

export default CareerGame;
