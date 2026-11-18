'use client';
// React wrapper for the 3D look preview (three.js loads only in the browser, on demand).
import {useEffect, useRef, useState} from 'react';
import type {Look} from '../../lib/cosmetics';
import type {LookPreview} from './preview-view';

export function FighterPreview({look, focus = 'body'}: {look: Look; focus?: 'body' | 'upper'}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<LookPreview | null>(null);
  const [err, setErr] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    import('./preview-view').then(({LookPreview}) => {
      if (!alive || !canvas.current) return;
      try { view.current = new LookPreview(canvas.current); setReady(true); } catch { setErr(true); }
    }).catch(() => setErr(true));
    const onResize = () => view.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { alive = false; window.removeEventListener('resize', onResize); view.current?.dispose(); view.current = null; };
  }, []);
  const key = JSON.stringify(look);
  useEffect(() => { if (ready && view.current) { view.current.show(look).catch(() => setErr(true)); } }, [ready, key]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (view.current) view.current.focus = focus; }, [focus, ready]);
  return <div className="fp">
    <canvas ref={canvas} aria-label="3D preview of your fighter. Drag to turn him around."/>
    {err && <p className="fp-err">The 3D preview needs WebGL. Your picks still save.</p>}
    <span className="fp-hint" aria-hidden="true">Drag to turn</span>
  </div>;
}
