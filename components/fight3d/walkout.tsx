'use client';
// Fighter walkouts: a short broadcast-style entrance for each fighter before the first bell, one after the other.
// The challenger (blue corner) walks first and the champion (or red corner) last, like a real fight night.
// Pure CSS animation over the fighter's render (no video): stage beams, haze, camera flashes, and a
// lower-third with name, record and weight class. Skip button, or Enter / Esc.
import {useEffect, useMemo, useState} from 'react';
import {SkipForward} from 'lucide-react';
import {divisionOf, type FightCard, type Tape} from '../../lib/fight3d/tape';

export const WALK_MS = 6500;   // per fighter: ~13 s for the pair

const portrait = (t: Tape) => t.model ? `/fighters/${t.model}${t.rank === 'C' ? '-champ' : '-stance'}.webp` : null;

export function Walkout({card, onDone}: {card: FightCard; onDone: () => void}) {
  // challenger first, champion last; with no champion the blue corner (opponent) walks first
  const order = useMemo(() => {
    const blue = {t: card.opp, corner: 'blue' as const}, red = {t: card.you, corner: 'red' as const};
    return card.you.rank === 'C' && card.opp.rank !== 'C' ? [blue, red] : card.opp.rank === 'C' ? [red, blue] : [blue, red];
  }, [card]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => (i + 1 < order.length ? setI(i + 1) : onDone()), WALK_MS);
    return () => clearTimeout(id);
  }, [i, order.length, onDone]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); onDone(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onDone]);
  const {t, corner} = order[i];
  const src = portrait(t);
  const division = divisionOf(t.weight);
  // a few dozen camera flashes in the stands, positioned once per fighter
  const flashes = useMemo(() => Array.from({length: 28}, (_, k) => ({left: `${(k * 37 + i * 13) % 100}%`, top: `${8 + ((k * 53) % 46)}%`, delay: `${((k * 0.37) % 5.6).toFixed(2)}s`})), [i]);
  return <div className={`wo ${corner}`} role="dialog" aria-label={`Walkout: ${t.name}`}>
    <div key={i} className="wo-stage">
      <div className="wo-crowd" aria-hidden="true">{flashes.map((f, k) => <i key={k} style={{left: f.left, top: f.top, animationDelay: f.delay}}/>)}</div>
      <div className="wo-tunnel" aria-hidden="true"/>
      <div className="wo-beam l" aria-hidden="true"/><div className="wo-beam r" aria-hidden="true"/><div className="wo-beam c" aria-hidden="true"/>
      <div className="wo-haze" aria-hidden="true"/>
      {src && <img className="wo-fighter" src={src} alt="" width={720} height={1100}/>}
      <div className="wo-floor" aria-hidden="true"/>
      <div className="wo-plate">
        <span className="wo-corner">Fighting out of the {corner} corner</span>
        <strong className="wo-name">{t.rank && <b className={`wo-rank ${t.rank === 'C' ? 'champ' : ''}`}>{t.rank === 'C' ? 'CHAMPION' : t.rank}</b>}{t.name}</strong>
        {t.nickname && <span className="wo-nick">&ldquo;{t.nickname}&rdquo;</span>}
        <span className="wo-facts"><span>{t.record}</span><span>{division} · {parseFloat(t.weight)} lb</span>{t.country && <span>{t.country}</span>}</span>
      </div>
    </div>
    <div className="wo-top">
      <span className="wo-event">{card.event} · {card.title ?? card.billing}</span>
      <span className="wo-steps" aria-hidden="true">{order.map((_, k) => <i key={k} className={k < i ? 'done' : k === i ? 'on' : ''}/>)}</span>
      <button className="button outline wo-skip" onClick={onDone}><SkipForward size={16} aria-hidden="true"/>Skip <kbd>Esc</kbd></button>
    </div>
  </div>;
}
