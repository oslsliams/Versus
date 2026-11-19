'use client';
// A big moment in the career: the screen goes dark and the people in your life speak, one line at a time.
// Awards night adds the trophies (one reveal per tap) and the year's targets after the lines.
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronRight, Trophy, Check, X} from 'lucide-react';
import type {Scene} from '../../lib/career/story';
import {sfx} from '../fight3d/sound';

const initials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export function StoryScene({scene, onDone}: {scene: Scene; onDone: () => void}) {
  const [shown, setShown] = useState(1);
  const next = useRef<HTMLButtonElement>(null), end = useRef<HTMLDivElement>(null);
  const awards = scene.awards ?? [], nL = scene.lines.length;
  const total = nL + awards.length + (scene.review ? 1 : 0);
  const finished = shown >= total;
  const advance = () => { if (finished) onDone(); else setShown(n => n + 1); };
  useEffect(() => { sfx.sting(scene.tone); next.current?.focus(); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);
  useEffect(() => { end.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'}); if (shown > nL && shown <= nL + awards.length && awards[shown - nL - 1]?.you) sfx.sting('win'); }, [shown]);
  const shownAwards = awards.slice(0, Math.max(0, shown - nL));
  return createPortal(<div className={`ss ${scene.tone}`} role="dialog" aria-modal="true" aria-labelledby="ss-title" onClick={advance}>
    <div className="ss-card" onClick={e => e.stopPropagation()}>
      <header><span>{scene.kicker}</span><h2 id="ss-title">{scene.title}</h2></header>
      <ol className="ss-lines" aria-live="polite">
        {scene.lines.slice(0, shown).map((l, i) => <li key={i} className={l.who === 'You' ? 'you' : ''}>
          <i aria-hidden="true">{initials(l.who)}</i>
          <p><b>{l.who}</b>{l.text}</p>
        </li>)}
      </ol>
      {shownAwards.length > 0 && <ul className="ss-awards" aria-live="polite">
        {shownAwards.map(a => <li key={a.label} className={a.you ? 'you' : ''}>
          <Trophy size={20} aria-hidden="true"/>
          <div><small>{a.label}</small><strong>{a.winner}</strong><span>{a.detail}</span></div>
        </li>)}
      </ul>}
      {scene.review && shown >= total && <div className="ss-review">
        {scene.review.last.length > 0 && <div><small>Last year's targets · {scene.review.last.filter(t => t.done).length}/{scene.review.last.length}</small>
          <ul>{scene.review.last.map(t => <li key={t.label} className={t.done ? 'done' : 'miss'}>{t.done ? <Check size={15} aria-label="Done"/> : <X size={15} aria-label="Missed"/>}{t.label}</li>)}</ul></div>}
        <div><small>Next year's targets</small><ul>{scene.review.next.map(t => <li key={t}><ChevronRight size={15} aria-hidden="true"/>{t}</li>)}</ul></div>
      </div>}
      <div ref={end} className="ss-actions">
        {!finished && <button type="button" className="ss-skip" onClick={() => setShown(total)}>Show all</button>}
        <button ref={next} type="button" className="button primary" onClick={advance}>{finished ? 'Continue' : shown >= nL && awards.length && shown < nL + awards.length ? 'Next award' : 'Next'} <ChevronRight size={18} aria-hidden="true"/></button>
      </div>
    </div>
  </div>, document.body);
}
