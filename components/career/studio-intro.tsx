'use client';
// "Unseen Interactive presents" studio intro. Shows once per browser session,
// can be skipped, and never shows for people who prefer reduced motion.
import {useEffect, useState} from 'react';

const KEY = 'versus-intro-seen';

export function UnseenEye({className}: {className?: string}) {
  return <svg className={className} viewBox="0 0 512 512" aria-hidden="true">
    <g transform="translate(86.00 166.95) scale(0.80952) translate(-30 -40)">
      <path className="ui-eye-line" d="M60 150 Q240 300 420 150 Q272.4 27 124.8 105.7" fill="none" stroke="currentColor" strokeWidth="34" strokeLinecap="butt" strokeLinejoin="round" pathLength={1}/>
      <path className="ui-eye-pupil" d="M240 108 Q280 150 240 192 Q200 150 240 108 Z" fill="currentColor"/>
    </g>
  </svg>;
}

export function StudioIntro() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === '1'; sessionStorage.setItem(KEY, '1'); } catch {}
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (seen || reduce) return;
    setShow(true);
    const out = setTimeout(() => setLeaving(true), 2100);
    const done = setTimeout(() => setShow(false), 2700);
    return () => { clearTimeout(out); clearTimeout(done); };
  }, []);
  if (!show) return null;
  const skip = () => { setLeaving(true); setTimeout(() => setShow(false), 300); };
  return <div className={`ui-intro ${leaving ? 'leaving' : ''}`} role="presentation" onClick={skip}>
    <div className="ui-intro-mark">
      <UnseenEye className="ui-intro-eye"/>
      <img className="ui-intro-word" src="/brand/unseen-interactive-wordmark-light.svg" alt="Unseen Interactive" width={340} height={108}/>
      <span className="ui-intro-presents">presents</span>
    </div>
    <button type="button" className="ui-intro-skip" onClick={skip}>Skip</button>
  </div>;
}
