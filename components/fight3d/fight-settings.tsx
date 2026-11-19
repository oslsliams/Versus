'use client';
// Fight settings the player can switch: a game style preset (Arcade, Balanced, Simulation, Knockout) or custom
// sliders for damage, stamina drain, cuts and round length, plus realism and presentation switches.
// Saved on this device and applied to the engine right before every fight.
import {useState} from 'react';
import {applyFX} from '../../lib/fight3d/engine';

export type Hud = 'on' | 'dynamic' | 'off';
export type FightSettings = {
  style: 'arcade' | 'balanced' | 'sim' | 'knockout' | 'custom';
  damage: number; stamina: number; cuts: number; roundSec: 60 | 90 | 120;
  doctor: boolean; regen: boolean; hud: Hud; commentary: boolean; blood: boolean; shake: boolean; replay: boolean; hints: boolean; bubbles: boolean;
};
const BASE: FightSettings = {style: 'balanced', damage: 1, stamina: 1, cuts: 1, roundSec: 90, doctor: true, regen: true, hud: 'on', commentary: true, blood: true, shake: true, replay: true, hints: true, bubbles: true};
/** the presets only touch the realism numbers; presentation switches stay as the player set them */
export const STYLES: Record<Exclude<FightSettings['style'], 'custom'>, {label: string; hint: string; set: Partial<FightSettings>}> = {
  arcade: {label: 'Arcade', hint: 'Big shots, quick fights, a deep gas tank.', set: {damage: 1.3, stamina: .7, cuts: .5, roundSec: 60, doctor: false, regen: true}},
  balanced: {label: 'Balanced', hint: 'The way VERSUS is tuned: close to real MMA results.', set: {damage: 1, stamina: 1, cuts: 1, roundSec: 90, doctor: true, regen: true}},
  sim: {label: 'Simulation', hint: 'Longer rounds, heavier gas, cuts matter. Damage stays with you.', set: {damage: .9, stamina: 1.35, cuts: 1.3, roundSec: 120, doctor: true, regen: true}},
  knockout: {label: 'Knockout', hint: 'No health coming back between exchanges. Every clean shot counts.', set: {damage: 1.15, stamina: 1, cuts: 1, roundSec: 90, doctor: false, regen: false}},
};
const KEY = 'versus-fight-settings';
export function loadFightSettings(): FightSettings {
  try { const v = localStorage.getItem(KEY); return v ? {...BASE, ...JSON.parse(v)} : {...BASE}; } catch { return {...BASE}; }
}
export function saveFightSettings(s: FightSettings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: settings last for this visit */ } }
/** push the realism settings into the fight engine (call right before createFight) */
export function applyFightSettings(s: FightSettings) { applyFX({damage: s.damage, stamina: s.stamina, cuts: s.cuts, roundSec: s.roundSec, doctor: s.doctor, regen: s.regen}); }

const pct = (n: number) => `${Math.round(n * 100)}%`;
/** the settings panel (career phone, quick fight) */
export function FightSettingsPanel({compact = false}: {compact?: boolean}) {
  const [s, setS] = useState<FightSettings>(() => typeof window === 'undefined' ? BASE : loadFightSettings());
  const put = (k: Partial<FightSettings>, custom = true) => setS(prev => { const n = {...prev, ...k, ...(custom ? {style: 'custom' as const} : {})}; saveFightSettings(n); return n; });
  const toggle = (k: keyof FightSettings, label: string, hint: string) => <label className="fs-row"><span><b>{label}</b><small>{hint}</small></span>
    <input type="checkbox" role="switch" checked={!!s[k]} onChange={e => put({[k]: e.target.checked} as Partial<FightSettings>, k === 'doctor' || k === 'regen')}/></label>;
  const slider = (k: 'damage' | 'stamina' | 'cuts', label: string) => <label className="fs-row slider"><span><b>{label}</b><small>{pct(s[k])}</small></span>
    <input type="range" min={.5} max={1.5} step={.05} value={s[k]} onChange={e => put({[k]: Number(e.target.value)} as Partial<FightSettings>)} aria-label={`${label}: ${pct(s[k])}`}/></label>;
  return <div className={`fs ${compact ? 'compact' : ''}`}>
    <fieldset className="fs-styles"><legend>Game style</legend>
      {(Object.keys(STYLES) as (keyof typeof STYLES)[]).map(k => <button key={k} type="button" aria-pressed={s.style === k} onClick={() => put({...STYLES[k].set, style: k}, false)}><b>{STYLES[k].label}</b><small>{STYLES[k].hint}</small></button>)}
      {s.style === 'custom' && <p className="fs-custom">Custom: you changed a setting below.</p>}
    </fieldset>
    <fieldset><legend>Realism</legend>
      {slider('damage', 'Strike damage')}
      {slider('stamina', 'Stamina drain')}
      {slider('cuts', 'Cuts')}
      <label className="fs-row"><span><b>Round length</b><small>Fight-clock seconds per round</small></span>
        <select value={s.roundSec} onChange={e => put({roundSec: Number(e.target.value) as FightSettings['roundSec']})}><option value={60}>Short (60s)</option><option value={90}>Standard (90s)</option><option value={120}>Long (120s)</option></select></label>
      {toggle('doctor', 'Doctor stoppages', 'A bad cut can end the fight')}
      {toggle('regen', 'Health regeneration', 'Head health comes back between exchanges')}
    </fieldset>
    <fieldset><legend>Presentation</legend>
      <label className="fs-row"><span><b>Fight HUD</b><small>Dynamic shows a fighter's bars only when he's hurt or tired</small></span>
        <select value={s.hud} onChange={e => put({hud: e.target.value as Hud}, false)}><option value="on">On</option><option value="dynamic">Dynamic</option><option value="off">Off</option></select></label>
      {toggle('commentary', 'Commentary', 'The broadcast team calls the fight')}
      {toggle('blood', 'Blood', 'Cuts show on the fighters’ faces')}
      {toggle('shake', 'Camera shake', 'The camera jolts on big shots')}
      {toggle('replay', 'Knockout replays', 'Slow-motion replay after a KO')}
      {toggle('bubbles', 'Hit pop-ups', 'BOOM!, COUNTER! and combo counts')}
      {toggle('hints', 'Control hints', 'The key guide at the bottom of the screen')}
    </fieldset>
  </div>;
}
