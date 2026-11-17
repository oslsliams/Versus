'use client';
// Quick Fight: jump straight into a live fight with an original VERSUS fighter.
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Swords, RotateCcw, Users, Eye} from 'lucide-react';
import {overall, type Stats, type Style} from '../../lib/career/engine';
import {FightStats, LiveFightGame, type Corner, type LiveResult} from '../fight3d/live-fight';
import {tape, type FightCard} from '../../lib/fight3d/tape';

const S = (striking: number, power: number, speed: number, wrestling: number, grappling: number, cardio: number, chin: number, iq: number): Stats => ({striking, power, speed, wrestling, grappling, cardio, chin, iq});
// quick-fight division: Kalani holds the belt, everyone else is ranked
export const ROSTER: (Corner & {nickname: string; blurb: string; rank: string})[] = [
  {name: 'Dante Okafor', nickname: 'Static', style: 'Striker', color: '#e58fb6', stats: S(84, 78, 80, 48, 42, 70, 66, 72), rank: '#3', blurb: 'Lightning hands, hates the mat.'},
  {name: 'Ilya Volkov', nickname: 'Undertow', style: 'Wrestler', color: '#86c4dc', stats: S(58, 70, 60, 88, 66, 86, 78, 70), rank: '#2', blurb: 'Chain wrestler with a bottomless tank.'},
  {name: 'Ryo Takeda', nickname: 'The Locksmith', style: 'Grappler', color: '#968fd6', stats: S(55, 52, 66, 70, 92, 74, 64, 82), rank: '#5', blurb: 'Every scramble ends at his neck.'},
  {name: 'Marcus Ashford', nickname: 'Brick House', style: 'Striker', color: '#e8a07a', stats: S(72, 92, 52, 60, 46, 60, 88, 58), rank: '#7', blurb: 'One punch changes everything.'},
  {name: 'Sione Kalani', nickname: 'Monsoon', style: 'All-rounder', color: '#7fd1b3', stats: S(74, 74, 72, 72, 70, 76, 76, 74), rank: 'C', blurb: 'No holes. No panic.'},
  {name: 'Enzo Bianchi', nickname: 'Paper Cut', style: 'Striker', color: '#e9c873', stats: S(88, 62, 88, 52, 50, 78, 58, 80), rank: '#4', blurb: 'Kicks from everywhere, gone before you swing.'},
  {name: 'Kofi Mwangi', nickname: 'Gravity', style: 'Wrestler', color: '#bfe36b', stats: S(62, 78, 64, 84, 72, 72, 82, 66), rank: '#6', blurb: 'Takes you down and keeps you there.'},
  {name: 'Hugo Delacroix', nickname: 'Slow Burn', style: 'All-rounder', color: '#d9a7ff', stats: S(70, 66, 68, 68, 74, 90, 72, 86), rank: '#1', blurb: 'Wins the fourth and fifth round every time.'},
];
const LEVELS = [{label: 'Easy', v: .12}, {label: 'Normal', v: .5}, {label: 'Hard', v: .74}] as const;

export function QuickFight() {
  const [mine, setMine] = useState(0);
  const [theirs, setTheirs] = useState(1);
  const [level, setLevel] = useState(1);
  const [rounds, setRounds] = useState(3);
  const [fighting, setFighting] = useState(0);
  const [watch, setWatch] = useState(false);
  useEffect(() => { if (new URLSearchParams(location.search).get('watch') === '1') { setWatch(true); setFighting(1); } }, []);
  const [result, setResult] = useState<LiveResult | null>(null);
  const you = useMemo(() => ROSTER[mine], [mine]);
  const opp = useMemo(() => ROSTER[theirs === mine ? (mine + 1) % ROSTER.length : theirs], [theirs, mine]);
  const onEnd = useCallback((r: LiveResult) => setResult(r), []);
  const fightCard = useMemo<FightCard>(() => ({event: 'VERSUS FIGHT NIGHT', billing: 'Main event', title: you.rank === 'C' || opp.rank === 'C' ? 'VERSUS LIGHTWEIGHT CHAMPIONSHIP' : undefined, you: tape(you, opp.stats), opp: tape(opp, you.stats)}), [you, opp]);

  if (fighting) return <div className="bn-page cg">
    {!result ? <LiveFightGame key={fighting} card={fightCard} you={you} opp={opp} rounds={rounds} difficulty={LEVELS[level].v} onEnd={onEnd} watch={watch} onQuit={() => { setResult(null); setFighting(0); }}/>
      : <>{result.stats && <FightStats card={fightCard} stats={result.stats} result={result}/>}<section className={`panel cg-result ${result.winner}`}>
        <img src={result.winner === 'you' ? '/art/trophy.webp' : '/art/gem.webp'} alt="" width={130} height={130}/>
        <div>
          <span className="eyebrow">{result.winner === 'you' ? 'Victory' : result.winner === 'opp' ? 'Defeat' : 'Draw'}</span>
          <h2>{result.winner === 'you' ? `${you.name} wins by ${result.method}` : result.winner === 'opp' ? `${opp.name} wins by ${result.method}` : 'Scored a draw'} · R{result.round}</h2>
          {['DEC', 'SPLIT DEC', 'DRAW'].includes(result.method) && <p className="muted">Scorecards: {result.cards.map(([a, b]) => `${a}–${b}`).join(', ')}</p>}
          <div className="bn-ctas"><button className="button primary" onClick={() => { setResult(null); setFighting(n => n + 1); }}><RotateCcw size={16} aria-hidden="true"/>Rematch</button><button className="button outline" onClick={() => { setResult(null); setFighting(0); }}><Users size={16} aria-hidden="true"/>Change fighters</button></div>
        </div>
      </section></>}
  </div>;

  const card = (f: typeof ROSTER[number], i: number, sel: number, set: (i: number) => void, disabled?: boolean) => <button key={f.name} type="button" role="radio" aria-checked={sel === i} disabled={disabled} className={`qf-card ${sel === i ? 'on' : ''}`} onClick={() => set(i)} style={{'--c': f.color} as React.CSSProperties}>
    <span className="cg-avatar md" style={{'--c': f.color} as React.CSSProperties}>{f.name.split(' ').map(w => w[0]).join('')}</span>
    <strong>{f.name}</strong><small>“{f.nickname}” · {f.style}</small><small className="qf-ovr">OVR {overall(f.stats)}</small>
  </button>;

  return <div className="bn-page cg">
    <header className="bn-pagehead with-art">
      <div><span className="eyebrow">Quick fight</span><h1>Pick a corner. <em>Fight.</em></h1><p>Choose an original VERSUS fighter and an opponent, then fight it out live. No career, no consequences.</p></div>
      <img className="bn-art float" src="/art/vs-badge.webp" alt="" width={240} height={240}/>
    </header>
    <section className="panel qf-pick"><h2>Your fighter</h2><div className="qf-grid" role="radiogroup" aria-label="Your fighter">{ROSTER.map((f, i) => card(f, i, mine, setMine))}</div><p className="muted">{you.blurb}</p></section>
    <section className="panel qf-pick"><h2>Opponent</h2><div className="qf-grid" role="radiogroup" aria-label="Opponent">{ROSTER.map((f, i) => card(f, i, theirs === mine ? -1 : theirs, setTheirs, i === mine))}</div><p className="muted">{opp.blurb}</p></section>
    <section className="panel qf-opts">
      <div><span className="cg-label">Difficulty</span><div className="bn-seg" role="group" aria-label="Difficulty">{LEVELS.map((l, i) => <button key={l.label} type="button" aria-pressed={level === i} onClick={() => setLevel(i)}>{l.label}</button>)}</div></div>
      <div><span className="cg-label">Rounds</span><div className="bn-seg" role="group" aria-label="Rounds">{[1, 3, 5].map(n => <button key={n} type="button" aria-pressed={rounds === n} onClick={() => setRounds(n)}>{n}</button>)}</div></div>
      <div className="qf-go"><button className="button primary cg-big" onClick={() => { setWatch(false); setFighting(1); }}><Swords size={18} aria-hidden="true"/>Fight: {you.name.split(' ')[0]} vs {opp.name.split(' ')[0]}</button><button className="button outline" onClick={() => { setWatch(true); setFighting(1); }}><Eye size={16} aria-hidden="true"/>Watch AI fight</button></div>
    </section>
  </div>;
}
