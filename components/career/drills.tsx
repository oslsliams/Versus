'use client';
// Training you actually play: three short drills that decide how much a week in the gym is worth.
// Every drill can be skipped: a quick session worth half the gains (and the drills can be switched off in Settings).
import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {StatKey} from '../../lib/career/engine';
import {sfx} from '../fight3d/sound';

export type DrillKind = 'pads' | 'react' | 'rhythm';
export const drillFor = (focus: StatKey | 'spar'): DrillKind => focus === 'spar' || focus === 'wrestling' || focus === 'grappling' || focus === 'iq' ? 'react' : focus === 'cardio' || focus === 'speed' || focus === 'chin' ? 'rhythm' : 'pads';
const INFO: Record<DrillKind, {title: string; how: string; reps: number}> = {
  pads: {title: 'Pad work', how: 'Hit when the closing ring meets the pad.', reps: 8},
  react: {title: 'Live reactions', how: 'Answer each call as fast as you can.', reps: 8},
  rhythm: {title: 'Conditioning', how: 'Tap every time the marker reaches the line.', reps: 9},
};
const CALLS = [{key: 'ArrowLeft', label: 'Slip left', mark: '◀'}, {key: 'ArrowUp', label: 'Sprawl', mark: '▲'}, {key: 'ArrowRight', label: 'Slip right', mark: '▶'}];
const grade = (q: number) => q >= .85 ? 'Perfect session' : q >= .65 ? 'Sharp session' : q >= .4 ? 'Solid session' : 'Rough session';

/** onDone(undefined) means the drill was skipped; onAlwaysSkip switches drills off for good (Settings turns them back on) */
export function Drill({kind, label, onDone, onAlwaysSkip}: {kind: DrillKind; label: string; onDone: (quality: number | undefined) => void; onAlwaysSkip?: () => void}) {
  const info = INFO[kind];
  const [phase, setPhase] = useState<'ready' | 'go' | 'done'>('ready');
  const [rep, setRep] = useState(0), [flash, setFlash] = useState<{text: string; good: boolean; id: number} | null>(null);
  const [call, setCall] = useState(0), [spot, setSpot] = useState({x: 50, y: 50});
  const scores = useRef<number[]>([]), start = useRef(0), judged = useRef(false), judgedAt = useRef(0), repRef = useRef(0);
  const ring = useRef<HTMLElement>(null), marker = useRef<HTMLElement>(null), go = useRef<HTMLButtonElement>(null);
  const dur = kind === 'pads' ? 1050 : kind === 'react' ? 1250 : 820;
  const quality = scores.current.length ? scores.current.reduce((a, b) => a + b, 0) / info.reps : 0;

  const next = useCallback(() => {
    repRef.current += 1;
    if (repRef.current >= info.reps) { setPhase('done'); return; }
    setRep(repRef.current); judged.current = false; start.current = performance.now();
    setSpot({x: 25 + Math.random() * 50, y: 28 + Math.random() * 44}); setCall(Math.floor(Math.random() * CALLS.length));
  }, [info.reps]);
  const score = useCallback((v: number) => {
    if (judged.current) return; judged.current = true; judgedAt.current = performance.now(); scores.current.push(v); sfx.drill(v);
    setFlash({text: v >= .8 ? 'PERFECT' : v >= .5 ? 'GOOD' : v > 0 ? 'LATE' : 'MISS', good: v >= .5, id: Math.random()});
  }, []);
  const hit = useCallback((pick?: number) => {
    if (phase !== 'go' || judged.current) return;
    const t = (performance.now() - start.current) / dur;
    if (kind === 'react') score(pick === call ? Math.max(.25, 1 - t * .85) : 0);
    else score(Math.max(0, 1 - Math.abs(t - .78) / .3));
  }, [phase, dur, kind, call, score]);

  useEffect(() => {
    if (phase !== 'go') return;
    let raf = 0; start.current = performance.now();
    const loop = (now: number) => {
      const t = (now - start.current) / dur;
      if (ring.current) ring.current.style.transform = `translate(-50%,-50%) scale(${Math.max(.2, 2.65 - t * 2.1)})`;
      if (marker.current) marker.current.style.left = `${Math.min(100, t / 1 * 100)}%`;
      if (t >= 1 && !judged.current) score(0);
      if (judged.current && now - judgedAt.current > 300) next();   // a beat to see the result, then straight into the next rep
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [phase, dur, next, score]);
  useEffect(() => {
    go.current?.focus(); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [phase]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onDone(undefined); return; }
      if (phase !== 'go') return;
      const i = CALLS.findIndex(c => c.key === e.key);
      if (kind === 'react' ? i >= 0 : e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); hit(i); }
    };
    window.addEventListener('keydown', down); return () => window.removeEventListener('keydown', down);
  }, [phase, kind, hit, onDone]);

  return createPortal(<div className="dr" role="dialog" aria-modal="true" aria-label={`${info.title}: ${label}`}>
    <div className="dr-card">
      <header><span>{label}</span><h2>{info.title}</h2></header>
      {phase === 'ready' && <div className="dr-intro"><p>{info.how}</p><p className="muted">A great session can be worth about twice a poor one.</p>
        <button ref={go} type="button" className="button primary" onClick={() => { sfx.unlock(); repRef.current = 0; scores.current = []; judged.current = false; setRep(0); setPhase('go'); }}>Start drill</button>
        <button type="button" className="button outline" onClick={() => onDone(undefined)}>Skip (half gains)</button>
        {onAlwaysSkip && <button type="button" className="dr-always" onClick={onAlwaysSkip}>Always skip drills</button>}</div>}
      {phase === 'go' && <>
        <div className="dr-reps" aria-label={`Rep ${rep + 1} of ${info.reps}`}>{Array.from({length: info.reps}, (_, i) => <i key={i} className={i < rep ? 'on' : i === rep ? 'now' : ''}/>)}</div>
        {kind === 'pads' && <button ref={go} type="button" className="dr-stage" onPointerDown={e => { e.preventDefault(); hit(); }} aria-label="Hit the pad"><span className="dr-pad" style={{left: `${spot.x}%`, top: `${spot.y}%`}}/><i ref={ring} className="dr-ring" style={{left: `${spot.x}%`, top: `${spot.y}%`}}/></button>}
        {kind === 'rhythm' && <button ref={go} type="button" className="dr-stage rhythm" onPointerDown={e => { e.preventDefault(); hit(); }} aria-label="Tap on the beat"><span className="dr-track"><b/><i ref={marker}/></span></button>}
        {kind === 'react' && <div className="dr-react"><strong key={rep}>{CALLS[call].label}</strong><div>{CALLS.map((c, i) => <button key={c.key} ref={i === 1 ? go : undefined} type="button" onPointerDown={e => { e.preventDefault(); hit(i); }}><b aria-hidden="true">{c.mark}</b>{c.label}</button>)}</div></div>}
        {flash && <em key={flash.id} className={`dr-flash ${flash.good ? 'good' : ''}`} aria-live="polite">{flash.text}</em>}
        <p className="dr-keys">{kind === 'react' ? 'Arrow keys or tap' : 'Space or tap'}</p>
      </>}
      {phase === 'done' && <div className="dr-intro"><strong className="dr-score">{Math.round(quality * 100)}%</strong><p>{grade(quality)}</p>
        <button ref={go} type="button" className="button primary" onClick={() => onDone(quality)}>Finish the week</button></div>}
    </div>
  </div>, document.body);
}
