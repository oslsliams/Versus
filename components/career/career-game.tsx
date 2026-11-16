'use client';
// VERSUS career mode: create a fighter, run their weeks, take fights, climb to a belt.
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Dumbbell, Swords, BedDouble, Megaphone, Crown, Flame, HeartPulse, Zap, Wallet, ChevronRight, RotateCcw, Flag, Shield, X, Check} from 'lucide-react';
import {
  ACTIONS, DIVISIONS, FIGHTER_COLORS, START_COUNTRIES, STAT_KEYS, STAT_LABEL, STYLES, TIERS,
  acceptOffer, applyResult, createCareer, declineOffer, legacy, npc, overall, retire, rng, takeAction,
  type Career, type Division, type NPC, type Plan, type StatKey, type Style,
} from '../../lib/career/engine';
import {PLANS, aiPlan, fightRound, startFight, type FightState} from '../../lib/career/fight';
import {competitors} from '../../lib/competitors';
import {StudioIntro} from './studio-intro';
import {QuickFight} from './quick-fight';
import {LiveFightGame, type LiveResult} from '../fight3d/live-fight';

const SAVE = 'versus-career-v1', FIGHT = 'versus-career-fight-v1';
const load = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; } };
const save = (k: string, v: unknown) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const initials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const money = (n: number) => '$' + Math.round(n).toLocaleString();
const yearWeek = (w: number) => `Year ${Math.floor((w - 1) / 52) + 1} · Week ${((w - 1) % 52) + 1}`;

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
  useEffect(() => { setCareer(load<Career>(SAVE)); setFight(load<FightState>(FIGHT)); setReady(true); if (new URLSearchParams(location.search).get('watch') === '1') setMode('quick'); }, []);
  const update = (c: Career | null) => { setCareer(c); save(SAVE, c); };
  const updateFight = (f: FightState | null) => { setFight(f); save(FIGHT, f); };
  const inFight = live || (!!fight && !!career?.camp);

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

function LiveFightNight({career: c, onDone}: {career: Career; onDone: (o: NonNullable<FightState['outcome']>) => void}) {
  const opp = npc(c, c.camp!.opponentId)!;
  const you = useMemo(() => ({name: c.name, color: c.color, style: c.style, stats: c.stats}), [c.name, c.color, c.style, c.stats]);
  const them = useMemo(() => ({name: opp.name, color: opp.color, style: opp.style, stats: opp.stats}), [opp]);
  const difficulty = Math.max(.2, Math.min(.95, .35 + (overall(opp.stats) - overall(c.stats)) / 60 + c.tier * .12));
  const [result, setResult] = useState<LiveResult | null>(null);
  const onEnd = useCallback((r: LiveResult) => setResult(r), []);
  const sim = useCallback(() => { const o = simulate(c)!; setResult({...o, cards: []}); }, [c]);
  if (!result) return <div className="bn-page cg">
    <div className="cg-livehead"><span className="eyebrow">{c.camp!.title ? (c.champ ? 'Title defense' : 'Title fight') : TIERS[c.tier].name}</span><h1>{c.name} <span className="muted">vs</span> {opp.name}</h1></div>
    <LiveFightGame you={you} opp={them} rounds={c.camp!.rounds} difficulty={difficulty} onEnd={onEnd} onSim={sim}/>
  </div>;
  const purse = c.camp!.purse + (result.winner === 'you' ? c.camp!.winBonus : 0);
  return <div className="bn-page cg"><section className={`panel cg-result ${result.winner}`}>
    <img src={result.winner === 'you' ? '/art/trophy.webp' : '/art/gem.webp'} alt="" width={130} height={130}/>
    <div>
      <span className="eyebrow">{result.winner === 'you' ? 'Victory' : result.winner === 'opp' ? 'Defeat' : 'Draw'}</span>
      <h2>{result.winner === 'you' ? `You win by ${result.method}` : result.winner === 'opp' ? `${opp.name} wins by ${result.method}` : 'Scored a draw'} · R{result.round}</h2>
      {result.cards.length > 0 && ['DEC', 'SPLIT DEC', 'DRAW'].includes(result.method) && <p className="muted">Scorecards: {result.cards.map(([a, b]) => `${a}–${b}`).join(', ')}</p>}
      <p className="muted">Purse: {money(purse)}</p>
      <button className="button primary" onClick={() => onDone({winner: result.winner, method: result.method, round: result.round, damageTaken: result.damageTaken})}>Back to camp <ChevronRight size={18} aria-hidden="true"/></button>
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
  const [err, setErr] = useState('');
  const preview = useMemo(() => createCareer({name: name || 'Your Name', nickname, country, division, style, color}, 42).stats, [style, name, nickname, country, division, color]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) { setErr('Give your fighter a name with at least 3 letters.'); return; }
    onCreate(createCareer({name: name.trim(), nickname: nickname.trim(), country, division, style, color}));
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
    <form className="cg-create" onSubmit={submit} noValidate>
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
        <span className="cg-label">Corner color</span>
        <div className="cg-colors" role="radiogroup" aria-label="Corner color">
          {FIGHTER_COLORS.map(c => <button type="button" role="radio" aria-checked={color === c} aria-label={c} key={c} className={color === c ? 'on' : ''} style={{background: c}} onClick={() => setColor(c)}/>)}
        </div>
      </section>
      <aside className="panel cg-preview">
        <Avatar name={name || 'Your Name'} color={color} size="lg"/>
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
function Hub({career: c, update, startFightNight}: {career: Career; update: (c: Career | null) => void; startFightNight: () => void}) {
  const [focus, setFocus] = useState<StatKey>('striking');
  const [confirm, setConfirm] = useState<'retire' | 'new' | null>(null);
  const opp = c.camp ? npc(c, c.camp.opponentId) : undefined;
  const fightWeek = !!c.camp && c.camp.weeksLeft === 0;
  const injured = c.injuryWeeks > 0;
  const act = (a: Parameters<typeof takeAction>[1]) => update(takeAction(c, a));
  const tier = TIERS[c.tier];

  return <div className="bn-page cg">
    <section className={`panel cg-head ${c.champ ? 'is-champ' : ''}`}>
      <Avatar name={c.name} color={c.color} size="lg"/>
      <div className="cg-head-copy">
        <div className="bn-pills">
          <span className={`sticker ${tier.color}`} style={{'--tilt': '-3deg'} as React.CSSProperties}>{tier.name}</span>
          {c.champ ? <span className="sticker sun" style={{'--tilt': '2deg'} as React.CSSProperties}><Crown size={13} aria-hidden="true"/> Champion</span>
            : c.rank ? <span className="sticker lime" style={{'--tilt': '2deg'} as React.CSSProperties}>#{c.rank} {c.division}</span> : null}
          {injured && <span className="sticker pink">Injured · {c.injuryWeeks}w</span>}
        </div>
        <h1>{c.name}</h1>
        <p className="muted">{c.nickname ? `“${c.nickname}” · ` : ''}{c.division} · {c.style} · Age {c.age} · {yearWeek(c.week)}</p>
      </div>
      <div className="cg-record"><strong>{c.record.join('–')}</strong><span>{c.finishes.ko} KO · {c.finishes.sub} SUB · {c.finishes.dec} DEC</span><span className="cg-ovr">OVR {overall(c.stats)}</span></div>
      {c.champ && <img className="cg-belt" src="/art/trophy.webp" alt="" width={110} height={110}/>}
    </section>

    <section className="cg-meters" aria-label="Condition">
      <Meter icon={<Zap size={16}/>} label="Energy" v={c.energy} tone="lime"/>
      <Meter icon={<HeartPulse size={16}/>} label="Health" v={c.health} tone="pink"/>
      <Meter icon={<Flame size={16}/>} label="Hype" v={c.hype} tone="sun"/>
      <div className="cg-meter"><span><Wallet size={16} aria-hidden="true"/> Bank</span><strong>{money(c.money)}</strong></div>
    </section>

    <div className="cg-main">
      <div className="cg-col">
        {c.camp && opp && <section className={`panel cg-camp ${fightWeek ? 'fight-week' : ''}`}>
          <span className="eyebrow">{fightWeek ? 'Fight week' : `Fight camp · ${c.camp.weeksLeft} week${c.camp.weeksLeft === 1 ? '' : 's'} out`}</span>
          <div className="cg-vs">
            <Avatar name={c.name} color={c.color}/><img src="/art/vs-badge.webp" alt="versus" width={64} height={64}/><Avatar name={opp.name} color={opp.color}/>
          </div>
          <h2>{c.camp.title ? (c.champ ? 'Title defense' : 'Title fight') : 'Main card'} vs {opp.name}</h2>
          <p className="muted">“{opp.nickname}” · {opp.style} · {opp.record.join('–')} · OVR {overall(opp.stats)} · {c.camp.rounds} rounds · Purse {money(c.camp.purse)} + {money(c.camp.winBonus)} to win</p>
          {fightWeek && <button className="button primary cg-big" onClick={startFightNight}><Swords size={18} aria-hidden="true"/>Walk out to the cage</button>}
        </section>}

        {!fightWeek && <section className="panel cg-week">
          <div className="section-heading"><h2>This week</h2><span className="muted">{yearWeek(c.week)}</span></div>
          <div className="cg-actions">
            <div className={`cg-action train ${injured ? 'off' : ''}`}>
              <Dumbbell size={22} aria-hidden="true"/><strong>{ACTIONS.train.label}</strong><small>{ACTIONS.train.blurb}</small>
              <label className="sr-only" htmlFor="cg-focus">Training focus</label>
              <select id="cg-focus" value={focus} onChange={e => setFocus(e.target.value as StatKey)}>{STAT_KEYS.map(k => <option key={k} value={k}>{STAT_LABEL[k]} ({Math.floor(c.stats[k])})</option>)}</select>
              <button className="button primary" disabled={injured} onClick={() => act({type: 'train', focus})}>Train {STAT_LABEL[focus].toLowerCase()}</button>
            </div>
            <ActionCard icon={<Swords size={22}/>} k="spar" off={injured} onClick={() => act({type: 'spar'})}/>
            <ActionCard icon={<BedDouble size={22}/>} k="rest" onClick={() => act({type: 'rest'})}/>
            <ActionCard icon={<Megaphone size={22}/>} k="promote" onClick={() => act({type: 'promote'})}/>
          </div>
          {c.energy < 30 && <p className="cg-warn">You're running on fumes. Training tired is slow and gets people hurt.</p>}
        </section>}

        {!c.camp && <section className="panel cg-offers">
          <div className="section-heading"><h2>Fight offers</h2><span className="muted">{TIERS[c.tier].short}</span></div>
          {!c.offers.length && <p className="muted">{injured ? 'No offers while you are injured.' : c.week < c.nextOfferWeek ? `Recovering from your last fight. Offers in ${c.nextOfferWeek - c.week} week(s).` : 'Your manager is working the phones. Check back next week.'}</p>}
          {c.offers.map(o => { const n = npc(c, o.opponentId)!; const gap = overall(n.stats) - overall(c.stats); return <article key={o.id} className={`cg-offer ${o.title ? 'title' : ''}`}>
            <Avatar name={n.name} color={n.color}/>
            <div className="cg-offer-body">
              <span className={`sticker ${o.title ? 'sun' : gap > 8 ? 'pink' : gap < -8 ? 'lime' : 'sky'}`} style={{'--tilt': '-2deg'} as React.CSSProperties}>{o.note}</span>
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

        <section className="panel cg-news">
          <h2>Fight news</h2>
          <ol>{c.log.slice(0, 12).map((l, i) => <li key={i} className={l.tone ?? ''}><span>Wk {((l.week - 1) % 52) + 1}</span>{l.text}</li>)}</ol>
        </section>
      </div>

      <div className="cg-col">
        <section className="panel cg-stats">
          <div className="section-heading"><h2>Attributes</h2><span className="muted">Potential {c.potential}</span></div>
          <div className="cg-statlist">{STAT_KEYS.map(k => <StatBar key={k} k={k} v={c.stats[k]} cap={c.potential}/>)}</div>
        </section>
        <Rankings c={c}/>
        {c.history.length > 0 && <section className="panel cg-history">
          <h2>Fight record</h2>
          <ol>{c.history.slice(0, 8).map((h, i) => <li key={i}><span className={`bn-res ${h.result === 'W' ? 'win' : h.result === 'L' ? 'loss' : ''}`}>{h.result}</span><span><strong>{h.opponent}{h.title ? ' · title' : ''}</strong><small>{h.method} · R{h.round} · {TIERS[h.tier].short} · {money(h.purse)}</small></span></li>)}</ol>
        </section>}
        <section className="panel cg-legends">
          <h2>Measured against legends</h2>
          <LegendMatches c={c}/>
        </section>
        <div className="cg-danger">
          {confirm ? <div className="panel cg-confirm" role="alertdialog" aria-label="Confirm">
            <p>{confirm === 'retire' ? 'Retire now? Your career ends and gets its legacy score.' : 'Start over? This career is deleted from this device.'}</p>
            <div className="bn-ctas"><button className="button primary" onClick={() => { if (confirm === 'retire') update(retire(c)); else update(null); setConfirm(null); }}>{confirm === 'retire' ? 'Retire' : 'Delete and restart'}</button><button className="button outline" onClick={() => setConfirm(null)}>Cancel</button></div>
          </div> : <div className="bn-ctas"><button className="button outline" onClick={() => setConfirm('retire')}><Flag size={16} aria-hidden="true"/>Retire</button><button className="button outline" onClick={() => setConfirm('new')}><RotateCcw size={16} aria-hidden="true"/>New career</button></div>}
        </div>
      </div>
    </div>
  </div>;
}

const rankText = (c: Career, id: string) => { const i = c.rankings.indexOf(id); return c.champion === id ? ' · Champion' : i >= 0 ? ` · #${i + 1}` : ''; };

function Meter({icon, label, v, tone}: {icon: React.ReactNode; label: string; v: number; tone: string}) {
  return <div className="cg-meter"><span>{icon} {label}</span><strong>{Math.round(v)}</strong><span className="bn-meter-track" aria-hidden="true"><i className={`tone-${tone}`} style={{width: `${v}%`}}/></span></div>;
}

function ActionCard({icon, k, onClick, off}: {icon: React.ReactNode; k: 'spar' | 'rest' | 'promote'; onClick: () => void; off?: boolean}) {
  const a = ACTIONS[k];
  return <button className={`cg-action ${off ? 'off' : ''}`} onClick={onClick} disabled={off}>
    {icon}<strong>{a.label}</strong><small>{a.blurb}</small><span className={`cg-energy ${a.energy > 0 ? 'up' : ''}`}>{a.energy > 0 ? '+' : ''}{a.energy} energy</span>
  </button>;
}

function Rankings({c}: {c: Career}) {
  if (c.tier < 2) {
    const list = [...c.roster.filter(n => n.tier === c.tier)].sort((a, b) => (b.record[0] - b.record[1]) - (a.record[0] - a.record[1])).slice(0, 8);
    return <section className="panel cg-rank"><h2>{TIERS[c.tier].short} standouts</h2><p className="muted">Win {c.tier === 0 ? 3 : 2} here with some hype to get called up. {c.tierWins} so far.</p>
      <ol>{list.map(n => <li key={n.id}><Avatar name={n.name} color={n.color} size="sm"/><span>{n.name}</span><small>{n.record.join('–')}</small></li>)}</ol></section>;
  }
  const champ = c.champion === 'you' ? null : npc(c, c.champion!);
  return <section className="panel cg-rank"><h2>{c.division} rankings</h2>
    <ol>
      <li className={`champ ${c.champ ? 'you' : ''}`}><span className="cg-rk"><Crown size={14} aria-label="Champion"/></span><span>{c.champ ? c.name : champ?.name}</span><small>{c.champ ? c.record.join('–') : champ?.record.join('–')}</small></li>
      {c.rankings.map((id, i) => { const n = id === 'you' ? null : npc(c, id); return <li key={id} className={id === 'you' ? 'you' : ''}><span className="cg-rk">{i + 1}</span><span>{n ? n.name : c.name}</span><small>{n ? n.record.join('–') : c.record.join('–')}</small></li>; })}
    </ol></section>;
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
  return <div className="bn-page cg">
    <section className="panel cg-retired">
      <img src="/art/trophy.webp" alt="" width={180} height={180}/>
      <span className="eyebrow">Career complete</span>
      <h1>{c.name}</h1>
      <p className="muted">Retired at {c.age} · {TIERS[c.tier].name}</p>
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
