'use client';
// Walkout broadcast graphics, drawn over the 3D walkout (components/fight3d/walkout-scene.ts):
// a WALKOUT bug, the lower third for whoever is walking (corner, rank, name, nickname, record, weight class,
// country), progress for both walks, and Skip (Esc / Enter).
import {useEffect} from 'react';
import {SkipForward} from 'lucide-react';
import {divisionOf, type FightCard} from '../../lib/fight3d/tape';

/** walking order by side (0 = red / you, 1 = blue / opponent): the challenger first, the champion last */
export const walkOrder = (card: FightCard): (0 | 1)[] => card.opp.rank === 'C' && card.you.rank !== 'C' ? [0, 1] : [1, 0];

export function WalkoutHud({card, step, onSkip}: {card: FightCard; step: number; onSkip: () => void}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); onSkip(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onSkip]);
  const order = walkOrder(card);
  const side = order[Math.min(step, order.length - 1)];
  const t = side === 0 ? card.you : card.opp, corner = side === 0 ? 'red' : 'blue';
  return <div className={`wo ${corner}`} role="region" aria-label={`Walkout: ${t.name}`}>
    <div key={step} className="wo-plate">
      <span className="wo-corner">Walking out of the {corner} corner</span>
      <strong className="wo-name">{t.rank && <b className={`wo-rank ${t.rank === 'C' ? 'champ' : ''}`}>{t.rank === 'C' ? ((t.belts ?? 1) >= 2 ? 'DOUBLE CHAMPION' : 'CHAMPION') : t.rank}</b>}{t.name}</strong>
      {t.nickname && <span className="wo-nick">&ldquo;{t.nickname}&rdquo;</span>}
      <span className="wo-facts"><span>{t.record}</span><span>{divisionOf(t.weight)} · {parseFloat(t.weight)} lb</span>{t.country && <span>{t.country}</span>}</span>
    </div>
    <div className="wo-top">
      <span className="wo-bug">WALKOUT</span>
      <span className="wo-event">{card.event} · {card.title ?? card.billing}</span>
      <span className="wo-steps" aria-hidden="true">{order.map((_, k) => <i key={k} className={k < step ? 'done' : k === step ? 'on' : ''}/>)}</span>
      <button className="button outline wo-skip" onClick={onSkip}><SkipForward size={16} aria-hidden="true"/>Skip <kbd>Esc</kbd></button>
    </div>
  </div>;
}
