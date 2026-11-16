'use client';
// Bubble Night versions of the fighter database, fighter profile and Compare pages.
import {useEffect, useMemo, useState} from 'react';
import {ArrowLeftRight, Link2, Check, Search, Heart, ExternalLink, Swords, Medal} from 'lucide-react';
import {competitors} from '../lib/competitors';
import type {Competitor} from '../lib/domain';
import {Portrait, Empty} from './ui';
import rankings from '../lib/ufc-rankings.json';
import {moments} from '../lib/moments';
import {useArena} from './arena-context';
import FighterGallery, {fighterScenes} from './fighter-gallery';
import {SHOW_UFC_PHOTOS} from '../lib/photo-policy';

const url = (id: string) => `/fighter/${id}`;
const fmt = (v: number | null | undefined, unit = '') => v == null ? '—' : `${v}${unit}`;
const rankOf = (id: string) => rankings.entries.find(e => e.id === id);
const rankLabel = (r: {division: string; rank: string}) => `${r.division.replace("Men's Pound-for-Pound Top Rank", 'P4P').replace("Women's Pound-for-Pound Top Rank", "Women's P4P")} ${r.rank === 'C' ? 'champ' : '#' + r.rank}`;
const divisions = [...new Set(competitors.map(c => c.division))].sort();

/* ------------------------------------------------------------------ shared */
function Segmented<T extends string>({options, value, onChange, label}: {options: readonly T[]; value: T; onChange: (v: T) => void; label: string}) {
  return <div className="bn-seg" role="group" aria-label={label}>
    {options.map(o => <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>{o}</button>)}
  </div>;
}

function Meter({label, value, max, unit = '', tone}: {label: string; value: number | null; max: number; unit?: string; tone: string}) {
  const pct = value == null ? 0 : Math.max(4, Math.min(100, value / max * 100));
  return <div className="bn-meter">
    <span className="bn-meter-k">{label}</span>
    <strong className="bn-meter-v">{fmt(value, unit)}</strong>
    <span className="bn-meter-track" aria-hidden="true"><i className={`tone-${tone}`} style={{width: `${pct}%`}}/></span>
  </div>;
}

function parseResult(r: string) {
  const [res, opp, method, round, date] = r.split(' · ');
  return {res, opp, method, round, date};
}

/* --------------------------------------------------------------- database */
export function FighterDatabase() {
  const [scope, setScope] = useState<'All fighters' | 'Ranked now'>('All fighters');
  const [q, setQ] = useState('');
  const [division, setDivision] = useState('All divisions');
  const [sort, setSort] = useState('Name');
  const [limit, setLimit] = useState(24);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setQ(p.get('q') ?? '');
    if (p.get('ranked') === '1') setScope('Ranked now');
  }, []);
  const rankedIds = useMemo(() => new Set(rankings.entries.map(e => e.id)), []);
  const list = competitors
    .filter(c => (scope === 'All fighters' || rankedIds.has(c.id))
      && `${c.name} ${c.nickname}`.toLowerCase().includes(q.toLowerCase())
      && (division === 'All divisions' || c.division === division))
    .sort((a, b) => sort === 'Wins' ? b.record[0] - a.record[0] : sort === 'Reach' ? (b.reach ?? 0) - (a.reach ?? 0) : a.name.localeCompare(b.name));
  const reset = () => setLimit(24);
  return <div className="bn-page">
    <header className="bn-pagehead with-art">
      <div>
        <span className="eyebrow">The UFC archive</span>
        <h1>Every fighter has <em>a story.</em></h1>
        <p>{competitors.length} fighters with career records, measured stats and the Moments that made them.</p>
      </div>
      <img className="bn-art float" src="/art/octagon.webp" alt="" width={300} height={300}/>
    </header>

    <div className="panel bn-toolbar">
      <label className="bn-searchfield"><Search size={18} aria-hidden="true"/><span className="sr-only">Search fighters</span>
        <input id="roster-q" value={q} placeholder="Name or nickname…" onChange={e => {setQ(e.target.value); reset();}}/>
      </label>
      <label><span className="sr-only">Division</span>
        <select id="roster-division" value={division} onChange={e => {setDivision(e.target.value); reset();}}>
          <option>All divisions</option>{divisions.map(d => <option key={d}>{d}</option>)}
        </select>
      </label>
      <label><span className="sr-only">Sort by</span>
        <select id="roster-sort" value={sort} onChange={e => setSort(e.target.value)}>
          {['Name', 'Wins', 'Reach'].map(s => <option key={s} value={s}>Sort: {s}</option>)}
        </select>
      </label>
      <Segmented label="Which fighters" options={['All fighters', 'Ranked now'] as const} value={scope} onChange={v => {setScope(v); reset();}}/>
    </div>

    <div className="section-heading">
      <h2>{list.length} {list.length === 1 ? 'fighter' : 'fighters'}</h2>
      <a className="button outline" href="/"><Swords size={16} aria-hidden="true"/>Back to your career</a>
    </div>

    <div className="bn-roster">
      {list.slice(0, limit).map(c => {
        const rk = rankOf(c.id);
        return <a href={url(c.id)} className="panel bn-fcard" key={c.id}>
          <Portrait c={c} feature/>
          {rk && <span className="sticker lime bn-fcard-sticker">{rankLabel(rk.ranks[rk.ranks.length - 1])}</span>}
          <span className="bn-fcard-body">
            <span className="bn-fcard-div">{c.division}</span>
            <strong className="bn-fcard-name">{c.name}</strong>
            {c.nickname && <span className="bn-fcard-nick">“{c.nickname}”</span>}
            <span className="bn-fcard-rec">{c.record.join('–')}</span>
          </span>
        </a>;
      })}
    </div>
    {!list.length && <Empty title="No fighters found" body="Try another name or division."/>}
    {list.length > limit && <div className="bn-center"><button className="button outline" onClick={() => setLimit(limit + 24)}>Load 24 more</button></div>}
    <p className="bn-footnote">An archive, not a live rankings feed. Every profile shows its data snapshot and source. <a href="/roster-provenance.json">Data provenance →</a></p>
  </div>;
}

/* ---------------------------------------------------------------- profile */
export function FighterProfile({id}: {id: string}) {
  const {state, act, busy} = useArena();
  const c = competitors.find(c => c.id === id);
  const [other, setOther] = useState(competitors.find(x => x.id !== id)!.id);
  if (!c) return <Empty title="Fighter not found" body="Find a fighter in the archive."/>;
  const cards = moments.filter(m => m.portrait === id);
  const rk = rankOf(c.id);
  const [ko, sub, dec] = c.methods.map(n => n ?? 0);
  const wins = Math.max(1, ko + sub + dec);
  const fav = state?.me.favoriteFighter === id;
  const saveFav = () => state && act({action: 'profile', username: state.me.username, favorites: JSON.parse(state.me.favorites), bio: state.me.bio ?? '', location: state.me.location ?? '', avatar: state.me.avatar ?? 'initials', accent: state.me.accent ?? '#c5f74f', favoriteFighter: id}, 'Favorite fighter saved to your profile.');
  return <div className="bn-page">
    <a className="text-link" href="/legends">← Legends</a>

    <section className="panel bn-fhero" style={{'--fighter-color': c.color} as React.CSSProperties}>
      <div className="bn-fhero-art"><Portrait c={c} large/></div>
      <div className="bn-fhero-copy">
        <div className="bn-pills">
          <span className={`bn-pill ${c.status === 'Active' ? 'live' : ''}`}>{c.status}</span>
          <span className="bn-pill">{c.division}</span>
          <span className="bn-pill">{c.country}</span>
        </div>
        <h1>{c.name}</h1>
        {c.nickname && <span className="sticker sky" style={{'--tilt': '-3deg'} as React.CSSProperties}>“{c.nickname}”</span>}
        <div className="bn-fhero-rec"><strong>{c.record.join('–')}</strong><span>career W–L–D{c.nc ? ` · ${c.nc} NC` : ''}</span></div>
        {rk && <div className="bn-pills">{rk.ranks.map(r => <span key={r.division} className="sticker lime" style={{'--tilt': '2deg'} as React.CSSProperties}>{rankLabel(r)}</span>)}</div>}
        <div className="bn-ctas">
          {state
            ? <button className="button outline" disabled={busy || fav} onClick={saveFav}><Heart size={16} aria-hidden="true"/>{fav ? 'Your favorite' : 'Set as favorite'}</button>
            : <a className="button outline" href={`/auth?return_to=${encodeURIComponent('/fighter/' + id)}`}><Heart size={16} aria-hidden="true"/>Sign in to favorite</a>}
        </div>
        <p className="bn-footnote">Archived {c.snapshot}</p>
      </div>
    </section>

    <section className="bn-statgrid" aria-label="Career statistics">
      <Meter label="Sig. strikes landed / min" value={c.stats.landed} max={9} tone="lime"/>
      <Meter label="Striking accuracy" value={c.stats.accuracy} max={100} unit="%" tone="pink"/>
      <Meter label="Takedowns / 15 min" value={c.stats.takedowns} max={6} tone="sky"/>
      <Meter label="Takedown defense" value={c.stats.defense} max={100} unit="%" tone="sun"/>
      <div className="bn-meter bn-finish">
        <span className="bn-meter-k">How they win</span>
        <div className="bn-finishbar" aria-hidden="true">
          <i className="tone-pink" style={{flexGrow: ko}}/><i className="tone-sky" style={{flexGrow: sub}}/><i className="tone-violet" style={{flexGrow: dec}}/>
        </div>
        <div className="bn-legend-row">
          <span><b className="dot tone-pink"/>KO/TKO {ko} · {Math.round(ko / wins * 100)}%</span>
          <span><b className="dot tone-sky"/>Sub {sub} · {Math.round(sub / wins * 100)}%</span>
          <span><b className="dot tone-violet"/>Decision {dec} · {Math.round(dec / wins * 100)}%</span>
        </div>
      </div>
      <div className="bn-meter bn-physical">
        <span className="bn-meter-k">Physical</span>
        <div className="bn-phys"><span><strong>{fmt(c.height, ' cm')}</strong>Height</span><span><strong>{fmt(c.reach, ' cm')}</strong>Reach</span><span><strong>{fmt(c.age)}</strong>Age</span></div>
      </div>
    </section>

    {SHOW_UFC_PHOTOS && fighterScenes[c.id]?.length > 0 && <FighterGallery key={c.id} c={c}/>}

    <div className="bn-two">
      <section className="panel bn-fights">
        <h2>Recent fights</h2>
        {c.recent.length ? <ol>{c.recent.map((r, i) => {
          const f = parseResult(r);
          return <li key={i}><span className={`bn-res ${f.res === 'W' ? 'win' : f.res === 'L' ? 'loss' : ''}`}>{f.res}</span><span><strong>{f.opp}</strong><small>{[f.method, f.round, f.date].filter(Boolean).join(' · ')}</small></span></li>;
        })}</ol> : <p className="muted">No recent fights in this snapshot.</p>}
      </section>
      <section className="panel bn-fights">
        <h2>Moments</h2>
        {cards.length ? <div className="bn-mchips">{cards.map(m => <a key={m.id} className={`bn-mchip tier-${m.tier.toLowerCase()}`} href={`/moments?q=${encodeURIComponent(m.name)}`}><img src="/art/gem.webp" alt="" width={36} height={36}/><span><strong>{m.title.toLowerCase()}</strong><small>{m.event} · {m.tier}</small></span></a>)}</div>
          : <p className="muted">No Moments yet. <a className="text-link" href="/suggestions">Suggest one →</a></p>}
      </section>
    </div>

    <CareerFacts c={c}/>
  </div>;
}

function CareerFacts({c}: {c: Competitor}) {
  return <details className="panel bn-sources">
    <summary>Sources and scope notes</summary>
    {c.notes.map((n, i) => <p className="muted" key={i}>{n}</p>)}
    <p className="bn-footnote">Snapshot: {c.snapshot}. Missing values stay unavailable.</p>
    <a className="text-link" href={c.source} target="_blank" rel="noreferrer">Original statistics source <ExternalLink size={14} aria-hidden="true"/></a>
  </details>;
}

/* ---------------------------------------------------------------- compare */
type Row = {label: string; a: number | null; b: number | null; unit?: string; lowerWins?: boolean};

export function StatCompare() {
  const [a, setA] = useState(competitors[0].id);
  const [b, setB] = useState(competitors[1].id);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (competitors.some(c => c.id === p.get('a'))) setA(p.get('a')!);
    if (competitors.some(c => c.id === p.get('b'))) setB(p.get('b')!);
  }, []);
  useEffect(() => {
    const u = new URL(location.href); u.searchParams.set('a', a); u.searchParams.set('b', b);
    history.replaceState(null, '', u); setCopied(false);
  }, [a, b]);
  const ca = competitors.find(c => c.id === a)!, cb = competitors.find(c => c.id === b)!;
  const rows: Row[] = [
    {label: 'Career wins', a: ca.record[0], b: cb.record[0]},
    {label: 'Career losses', a: ca.record[1], b: cb.record[1], lowerWins: true},
    {label: 'Height', a: ca.height, b: cb.height, unit: ' cm'},
    {label: 'Reach', a: ca.reach, b: cb.reach, unit: ' cm'},
    {label: 'Sig. strikes / min', a: ca.stats.landed, b: cb.stats.landed},
    {label: 'Striking accuracy', a: ca.stats.accuracy, b: cb.stats.accuracy, unit: '%'},
    {label: 'Takedowns / 15 min', a: ca.stats.takedowns, b: cb.stats.takedowns},
    {label: 'Takedown defense', a: ca.stats.defense, b: cb.stats.defense, unit: '%'},
    {label: 'KO / TKO wins', a: ca.methods[0], b: cb.methods[0]},
    {label: 'Submission wins', a: ca.methods[1], b: cb.methods[1]},
    {label: 'Decision wins', a: ca.methods[2], b: cb.methods[2]},
  ];
  const edge = (r: Row) => r.a == null || r.b == null || r.a === r.b ? 0 : (r.a > r.b) !== !!r.lowerWins ? -1 : 1;
  const leadsA = rows.filter(r => edge(r) === -1).length, leadsB = rows.filter(r => edge(r) === 1).length;
  const copy = async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { setCopied(false); } };
  const corner = (c: Competitor, side: 'red' | 'blue', leads: number) => <a href={url(c.id)} className={`bn-corner ${side}`}>
    <Portrait c={c} large/>
    <span className="bn-corner-body">
      <span className="bn-corner-div">{c.division} · {c.country}</span>
      <strong>{c.name}</strong>
      <span className="bn-corner-rec">{c.record.join('–')}</span>
      <span className={`sticker ${side === 'red' ? 'pink' : 'sky'}`} style={{'--tilt': side === 'red' ? '-4deg' : '4deg'} as React.CSSProperties}>Leads {leads} of {rows.length}</span>
    </span>
  </a>;

  return <div className="bn-page">
    <header className="bn-pagehead">
      <span className="eyebrow">Tale of the tape</span>
      <h1>Let the numbers <em>talk.</em></h1>
      <p>Pick any two fighters. Bars push from the middle, and whoever has the edge on each stat lights up.</p>
    </header>

    <div className="panel bn-picker">
      <label className="red"><span>Red corner</span><select id="cmp-a" value={a} onChange={e => setA(e.target.value)}>{competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button className="bn-swap" type="button" onClick={() => {setA(b); setB(a);}} aria-label="Swap corners"><ArrowLeftRight size={20}/></button>
      <label className="blue"><span>Blue corner</span><select id="cmp-b" value={b} onChange={e => setB(e.target.value)}>{competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button className="button outline" type="button" onClick={copy}>{copied ? <Check size={16} aria-hidden="true"/> : <Link2 size={16} aria-hidden="true"/>}{copied ? 'Link copied' : 'Copy link'}</button>
    </div>

    {a === b ? <Empty title="Choose two different fighters" body="Pick another fighter for the blue corner."/> : <>
      <section className="bn-stage">
        {corner(ca, 'red', leadsA)}
        <img className="bn-vs" src="/art/vs-badge.webp" alt="versus" width={220} height={220}/>
        {corner(cb, 'blue', leadsB)}
      </section>

      <section className="panel bn-tape" aria-label="Stat comparison">
        {ca.division !== cb.division && <p className="bn-note">Different weight classes. Size and opposition make direct comparisons limited.</p>}
        {rows.map(r => {
          const e = edge(r), max = Math.max(r.a ?? 0, r.b ?? 0) || 1;
          return <div className="bn-row" key={r.label}>
            <span className={`bn-val red ${e === -1 ? 'win' : ''}`}>{fmt(r.a, r.unit)}</span>
            <span className="bn-bar red" aria-hidden="true"><i style={{width: `${(r.a ?? 0) / max * 100}%`}}/></span>
            <span className="bn-label">{r.label}{r.lowerWins && <small> · lower is better</small>}</span>
            <span className="bn-bar blue" aria-hidden="true"><i style={{width: `${(r.b ?? 0) / max * 100}%`}}/></span>
            <span className={`bn-val blue ${e === 1 ? 'win' : ''}`}>{fmt(r.b, r.unit)}</span>
          </div>;
        })}
        <p className="bn-footnote"><Medal size={14} aria-hidden="true"/> Historical stats from each fighter’s listed snapshot, not win odds. A bigger number doesn’t always mean a better fighter.</p>
      </section>
    </>}
  </div>;
}
