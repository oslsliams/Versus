'use client';
import {useRef} from 'react';

/** Pointer-driven holographic tilt. Spread the returned handlers on any element with class "holo". */
export function useHolo<T extends HTMLElement = HTMLDivElement>(strength = 18) {
  const ref = useRef<T>(null);
  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.classList.add('is-live');
    el.style.setProperty('--ry', `${((x - .5) * strength).toFixed(1)}deg`);
    el.style.setProperty('--rx', `${((.5 - y) * strength).toFixed(1)}deg`);
    el.style.setProperty('--mx', `${Math.round(x * 100)}%`);
    el.style.setProperty('--my', `${Math.round(y * 100)}%`);
    el.style.setProperty('--shine', '1');
  };
  const onPointerLeave = () => {
    const el = ref.current; if (!el) return;
    el.classList.remove('is-live');
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--shine', '0');
  };
  return {ref, onPointerMove, onPointerLeave};
}

export function HoloLayers() {
  return <><span className="holo-foil" aria-hidden="true"/><span className="holo-glare" aria-hidden="true"/></>;
}
