'use client';
import {useEffect, useState} from 'react';
import {Volume2, VolumeX} from 'lucide-react';
import {sfx} from './sound';

/** one switch for every sound in the game; the choice is remembered on this device */
export function MuteButton({label = false, className}: {label?: boolean; className?: string}) {
  const [muted, setMuted] = useState(false);
  useEffect(() => { setMuted(sfx.muted); return sfx.subscribe(setMuted); }, []);
  const Icon = muted ? VolumeX : Volume2;
  return <button type="button" className={className} onClick={() => sfx.toggle()} aria-pressed={muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
    <Icon size={18} aria-hidden="true"/>{label && (muted ? 'Sound off' : 'Sound on')}
  </button>;
}
