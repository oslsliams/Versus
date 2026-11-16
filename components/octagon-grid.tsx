'use client';
// Octagon Grid: a daily 3x3 fighter trivia puzzle built from the VERSUS archive.
import {useEffect, useMemo, useState} from 'react';
import {Check, Copy, RotateCcw, Search, X, Eye} from 'lucide-react';
import {competitors} from '../lib/competitors';
import type {Competitor} from '../lib/domain';
import rankings from '../lib/ufc-rankings.json';
import {Portrait} from './ui';

type Rule = {id: string; label: string; test: (c: Competitor) => boolean};
type Cell = {fighter?: string; wrong?: number};
type Saved = {cells: Cell[]; guesses: number; used: string[]; revealed: boolean};

const MAX_GUESSES = 9;
const ranked = new Set(rankings.entries.map(e => e.id));

function count<T>(xs: T[]) { const m = new Map<T, number>(); xs.forEach(x => m.set(x, (m.get(x) ?? 0) + 1)); return m; }

function buildRules() {
  const groups: Rule[] = [];
  for (const [d, n] of count(competitors.map(c => c.division))) if (n >= 12) groups.push({id: 'div:' + d, label: d, test: c => c.division === d});
  for (const [k, n] of count(competitors.flatMap(c => c.country.split(' / ')))) if (n >= 10) groups.push({id: 'cty:' + k, label: `From ${k}`, test: c => c.country.split(' / ').includes(k)});
  const stats: Rule[] = [
    {id: 'ko10', label: '10+ KO/TKO wins', test: c => (c.methods[0] ?? 0) >= 10},
    {id: 'ko5', label: '5+ KO/TKO wins', test: c => (c.methods[0] ?? 0) >= 5},
    {id: 'sub5', label: '5+ submission wins', test: c => (c.methods[1] ?? 0) >= 5},
    {id: 'dec8', label: '8+ decision wins', test: c => (c.methods[2] ?? 0) >= 8},
    {id: 'w20', label: '20+ career wins', test: c => c.record[0] >= 20},
    {id: 'l3', label: '3 or fewer losses', test: c => c.record[1] <= 3},
    {id: 'reach190', label: 'Reach 190 cm+', test: c => (c.reach ?? 0) >= 190},
    {id: 'acc50', label: 'Striking accuracy 50%+', test: c => (c.stats.accuracy ?? 0) >= 50},
    {id: 'slpm5', label: '5+ sig. strikes / min', test: c => (c.stats.landed ?? 0) >= 5},
    {id: 'tdd80', label: 'Takedown defense 80%+', test: c => (c.stats.defense ?? 0) >= 80},
    {id: 'td3', label: '3+ takedowns / 15 min', test: c => (c.stats.takedowns ?? 0) >= 3},
    {id: 'ranked', label: 'Ranked right now', test: c => ranked.has(c.id)},
    {id: 'retired', label: 'Not active', test: c => c.status !== 'Active'},
  ];
  return {groups, stats};
}

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

function makePuzzle(day: string) {
  const {groups, stats} = buildRules();
  const r = rng('octagon-grid:' + day);
  const pick = <T,>(xs: T[], n: number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  for (let tries = 0; tries < 800; tries++) {
    const rows = pick(groups, 3), cols = pick(stats, 3);
    const answers = rows.flatMap(row => cols.map(col => competitors.filter(c => row.test(c) && col.test(c)).map(c => c.id)));
    if (answers.every(a => a.length >= 2)) return {rows, cols, answers};
  }
  const rows = groups.slice(0, 3), cols = stats.slice(0, 3);
  return {rows, cols, answers: rows.flatMap(row => cols.map(col => competitors.filter(c => row.test(c) && col.test(c)).map(c => c.id)))};
}

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): Saved => ({cells: Array.from({length: 9}, () => ({})), guesses: 0, used: [], revealed: false});
const key = (day: string) => `versus-octagon-grid:${day}`;

export function OctagonGrid() {
  const [day] = useState(today);
  const puzzle = useMemo(() => makePuzzle(day), [day]);
  const [s, setS] = useState<Saved>(blank);
  const [active, setActive] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [shake, setShake] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { try { const raw = localStorage.getItem(key(day)); if (raw) setS(JSON.parse(raw)); } catch {} }, [day]);
  useEffect(() => { try { localStorage.setItem(key(day), JSON.stringify(s)); } catch {} }, [s, day]);

  const solved = s.cells.filter(c => c.fighter).length;
  const left = MAX_GUESSES - s.guesses;
  const over = left <= 0 || solved === 9 || s.revealed;
  const results = q.trim().length < 2 ? [] : competitors.filter(c => `${c.name} ${c.nickname}`.toLowerCase().includes(q.toLowerCase())).slice(0, 7);

  const guess = (c: Competitor) => {
    if (active == null || over) return;
    const ok = puzzle.answers[active].includes(c.id) && !s.used.includes(c.id);
    setS(prev => {
      const cells = prev.cells.map((cell, i) => i !== active ? cell : ok ? {fighter: c.id} : {...cell, wrong: (cell.wrong ?? 0) + 1});
      return {...prev, cells, guesses: prev.guesses + 1, used: ok ? [...prev.used, c.id] : prev.used};
    });
    if (ok) { setActive(null); setQ(''); } else { setShake(active); setTimeout(() => setShake(null), 500); }
  };

  const share = async () => {
    const rows = [0, 1, 2].map(r => [0, 1, 2].map(c => s.cells[r * 3 + c].fighter ? '🟩' : '⬛').join('')).join('\n');
    const text = `VERSUS Octagon Grid ${day}\n${solved}/9 in ${s.guesses} guesses\n${rows}\nversusarena.org/grid`;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const fighter = (id?: string) => competitors.find(c => c.id === id);

  return <div className="bn-page og">
    <header className="bn-pagehead with-art">
      <div>
        <span className="eyebrow">New · daily puzzle</span>
        <h1>Octagon <em>Grid.</em></h1>
        <p>Fill every square with a fighter who fits both the row and the column. Nine guesses, one fighter per square, and a new grid every day.</p>
      </div>
      <img className="bn-art float" src="/art/octagon.webp" alt="" width={280} height={280}/>
    </header>

    <div className="og-status">
      <span className="bn-pill">{day}</span>
      <span className={`bn-pill ${left <= 3 && !over ? 'warn' : ''}`}>{left} {left === 1 ? 'guess' : 'guesses'} left</span>
      <span className="bn-pill live">{solved} / 9 solved</span>
    </div>

    <section className="og-board" aria-label="Octagon Grid board">
      <div className="og-corner" aria-hidden="true"><img src="/art/vs-badge.webp" alt="" width={90} height={90}/></div>
      {puzzle.cols.map(c => <div key={c.id} className="og-head col">{c.label}</div>)}
      {puzzle.rows.map((row, r) => <div key={row.id} className="og-rowwrap" style={{display: 'contents'}}>
        <div className="og-head row">{row.label}</div>
        {puzzle.cols.map((col, ci) => {
          const i = r * 3 + ci, cell = s.cells[i], f = fighter(cell.fighter);
          const example = s.revealed && !f ? fighter(puzzle.answers[i].find(id => !s.used.includes(id))) : undefined;
          return <button key={col.id} type="button" disabled={!!f || over}
            className={`og-cell ${f ? 'solved' : ''} ${active === i ? 'active' : ''} ${shake === i ? 'shake' : ''} ${example ? 'revealed' : ''}`}
            aria-label={f ? `${row.label} and ${col.label}: ${f.name}` : `${row.label} and ${col.label}: empty`}
            onClick={() => { setActive(i); setQ(''); }}>
            {f ? <><Portrait c={f}/><span className="og-name">{f.name}</span></>
              : example ? <><Portrait c={example}/><span className="og-name">{example.name}</span></>
              : <span className="og-plus" aria-hidden="true">+</span>}
            {!f && (cell.wrong ?? 0) > 0 && !example && <span className="og-miss">{cell.wrong} miss{cell.wrong === 1 ? '' : 'es'}</span>}
          </button>;
        })}
      </div>)}
    </section>

    {active != null && !over && <div className="panel og-picker" role="dialog" aria-label="Pick a fighter">
      <div className="og-picker-head">
        <span><b>{puzzle.rows[Math.floor(active / 3)].label}</b> + <b>{puzzle.cols[active % 3].label}</b></span>
        <button type="button" className="bn-swap" aria-label="Close" onClick={() => setActive(null)}><X size={18}/></button>
      </div>
      <label className="bn-searchfield"><Search size={18} aria-hidden="true"/><span className="sr-only">Search a fighter</span>
        <input id="og-search" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type a fighter's name…" autoComplete="off"/>
      </label>
      <ul className="og-results">
        {results.map(c => <li key={c.id}><button type="button" disabled={s.used.includes(c.id)} onClick={() => guess(c)}>
          <span>{c.name}</span><small>{s.used.includes(c.id) ? 'Already used' : c.division}</small>
        </button></li>)}
        {q.trim().length >= 2 && !results.length && <li className="muted">No fighters match “{q}”.</li>}
      </ul>
    </div>}

    {over && <section className="panel og-done">
      <img src={solved >= 7 ? '/art/trophy.webp' : '/art/coin.webp'} alt="" width={120} height={120}/>
      <div>
        <h2>{solved === 9 ? 'Perfect grid.' : solved >= 6 ? 'Strong showing.' : 'Tough grid today.'}</h2>
        <p>You filled {solved} of 9 squares in {s.guesses} guesses. Come back tomorrow for a new grid.</p>
        <div className="bn-ctas">
          <button className="button primary" onClick={share}>{copied ? <Check size={16} aria-hidden="true"/> : <Copy size={16} aria-hidden="true"/>}{copied ? 'Copied' : 'Share result'}</button>
          {!s.revealed && solved < 9 && <button className="button outline" onClick={() => setS(p => ({...p, revealed: true}))}><Eye size={16} aria-hidden="true"/>Show answers</button>}
        </div>
      </div>
    </section>}

    {!over && s.guesses > 0 && <div className="bn-center"><button className="button outline" onClick={() => setS(p => ({...p, guesses: MAX_GUESSES}))}><RotateCcw size={16} aria-hidden="true"/>Give up and see results</button></div>}
    <p className="bn-footnote">Answers use each fighter’s archived snapshot in VERSUS. Each fighter can only be used once per grid.</p>
  </div>;
}
