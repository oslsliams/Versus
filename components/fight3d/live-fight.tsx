'use client';
// VERSUS live fights: full-screen playable fight. You are the red corner.
import {useEffect, useRef, useState} from 'react';
import {Pause, Play, FastForward, Maximize, Minimize, X} from 'lucide-react';
import type {Stats, Style} from '../../lib/career/engine';
import {DT, NO_INPUT, ROUND_SECONDS, aiInput, createFight, makeBrain, step, type Input, type LiveFight as Fight} from '../../lib/fight3d/engine';
import type {FightView} from './fight-view';

export type Corner = {name: string; color: string; style: Style; stats: Stats};
export type LiveResult = {winner: 'you' | 'opp' | 'draw'; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; damageTaken: number; cards: [number, number][]};

const KEYMAP: Record<string, keyof Input> = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyS: 'block', ArrowDown: 'block', ShiftLeft: 'block', ShiftRight: 'block',
  KeyJ: 'jab', KeyK: 'cross', KeyL: 'kick', KeyI: 'upper', KeyU: 'upper', Space: 'shoot',
};
const last = (n: string) => n.split(' ').slice(-1)[0].toUpperCase();

export function LiveFightGame({you, opp, rounds, difficulty, onEnd, onSim, onQuit, watch = false}: {you: Corner; opp: Corner; rounds: number; difficulty: number; onEnd: (r: LiveResult) => void; onSim?: () => void; onQuit?: () => void; watch?: boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null), shell = useRef<HTMLDivElement>(null);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const held = useRef<Input>({...NO_INPUT}), pressed = useRef<Input>({...NO_INPUT});
  const [callout, setCallout] = useState<{text: string; key: number; tone: string} | null>(null);
  const [paused, setPaused] = useState(false);
  const [ground, setGround] = useState<null | 'top' | 'bottom'>(null);
  const [loading, setLoading] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [full, setFull] = useState(false);
  const pausedRef = useRef(false), done = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    let view: FightView | null = null, raf = 0, last = performance.now(), acc = 0, alive = true, slowFrames = 0, degraded = false;
    const g: Fight = createFight(you, opp, rounds);
    const brain = makeBrain(difficulty), autoBrain = makeBrain(.6);
    const resize = () => { if (view && shell.current) view.resize(shell.current.clientWidth, shell.current.clientHeight); };
    import('./fight-view').then(async ({FightView, loadFightAssets, modelFor}) => {
      let red = modelFor(you.name), blue = modelFor(opp.name);
      if (blue === red) blue = modelFor(opp.name + ' blue');
      const assets = await loadFightAssets(red, blue, p => alive && setLoading(p));
      if (!alive || !canvas.current) return;
      try { view = new FightView(canvas.current, g, assets); } catch { setError('Your browser could not start 3D graphics (WebGL). Try another browser or simulate the fight.'); return; }
      resize(); setReady(true); last = performance.now();
      raf = requestAnimationFrame(loop);
    }).catch(() => alive && setError('The fight assets could not load. Check your connection and try again.'));
    const loop = (now: number) => {
      const raw = (now - last) / 1000; last = now;
      const frame = Math.min(.5, raw);
      if (!degraded) { slowFrames = raw > .045 ? slowFrames + 1 : Math.max(0, slowFrames - 1); if (slowFrames > 45) { degraded = true; view?.degrade(); } }
      if (!pausedRef.current) {
        acc += frame;
        while (acc >= DT) {
          const ai = aiInput(g, g.f[1], g.f[0], brain);
          const me = watch ? aiInput(g, g.f[0], g.f[1], autoBrain) : {held: held.current, pressed: pressed.current};
          step(g, [me.held, ai.held], [me.pressed, ai.pressed]);
          pressed.current = {...NO_INPUT};
          view!.events(g.events);
          for (const e of g.events) if (e.text) setCallout({text: e.text, key: Math.random(), tone: e.type === 'ko' || e.type === 'tap' ? 'big' : e.side === 0 ? 'you' : 'opp'});
          acc -= DT;
        }
        view!.render(g, frame);
        paint(g);
        if (g.phase === 'over' && g.phaseT > 2.6 && !done.current) {
          done.current = true;
          const r = g.result!;
          onEnd({winner: r.winner === 0 ? 'you' : r.winner === 1 ? 'opp' : 'draw', method: r.method, round: r.round, damageTaken: Math.round(100 - Math.max(0, g.f[0].hp)), cards: g.cards});
        }
      }
      raf = requestAnimationFrame(loop);
    };
    const paint = (g: Fight) => {
      const h = hud.current;
      g.f.forEach((f, i) => {
        const hp = h['hp' + i], st = h['st' + i];
        if (hp) { hp.style.width = `${Math.max(0, f.hp)}%`; hp.dataset.low = f.hp < 30 ? '1' : ''; }
        if (st) st.style.width = `${f.stamina}%`;
      });
      const clock = h.clock; if (clock) { const s = Math.max(0, Math.ceil(g.clock)); clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
      const rd = h.round; if (rd) rd.textContent = g.phase === 'break' ? 'BREAK' : `R${g.round}`;
      const me = g.f[0], them = g.f[1];
      const gs = me.state === 'top' ? 'top' : me.state === 'bottom' ? 'bottom' : null;
      setGround(prev => prev === gs ? prev : gs);
      const esc = h.escape; if (esc) esc.style.width = `${Math.min(100, (gs === 'bottom' ? me.escape : them.escape) * 100)}%`;
      const sub = h.sub; if (sub) sub.style.width = `${Math.min(100, (gs === 'top' ? me.sub : them.sub) * 100)}%`;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') { setPaused(p => !p); return; }
      const k = KEYMAP[e.code]; if (!k) return;
      e.preventDefault();
      if (!held.current[k]) pressed.current[k] = true;
      held.current[k] = true;
    };
    const up = (e: KeyboardEvent) => { const k = KEYMAP[e.code]; if (k) held.current[k] = false; };
    const blur = () => { held.current = {...NO_INPUT}; };
    const fsChange = () => { setFull(!!document.fullscreenElement); setTimeout(resize, 50); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); window.addEventListener('resize', resize); document.addEventListener('fullscreenchange', fsChange);
    document.documentElement.classList.add('lf-lock');
    return () => {
      alive = false; cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('resize', resize); document.removeEventListener('fullscreenchange', fsChange);
      document.documentElement.classList.remove('lf-lock');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      view?.dispose();
    };
  }, [you, opp, rounds, difficulty, onEnd, watch]);

  const toggleFull = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); } catch { /* fullscreen not allowed here: the overlay still fills the window */ }
  };
  const touch = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); if (!held.current[k]) pressed.current[k] = true; held.current[k] = true; },
    onPointerUp: () => { held.current[k] = false; }, onPointerCancel: () => { held.current[k] = false; }, onPointerLeave: () => { held.current[k] = false; },
  });

  return <div className="lf" ref={shell} role="application" aria-label={`Live fight: ${you.name} versus ${opp.name}`}>
    <canvas ref={canvas}/>
    {!ready && !error && <div className="lf-loading"><img src="/brand/unseen-interactive-wordmark-light.svg" alt="Unseen Interactive" width={220} height={70}/><span>Loading the arena… {Math.round(loading * 100)}%</span><span className="lf-loadbar"><i style={{width: `${loading * 100}%`}}/></span></div>}

    <div className="lf-top">
      {[you, opp].map((c, i) => <div key={i} className={`lf-plate ${i ? 'blue' : 'red'}`}>
        <span className="lf-bars"><span className="lf-hp"><i ref={el => { hud.current['hp' + i] = el; }}/></span><span className="lf-st"><i ref={el => { hud.current['st' + i] = el; }}/></span></span>
        <span className="lf-name">{c.name.toUpperCase()}</span>
      </div>)}
    </div>

    <div className="lf-score">
      <span className="lf-sname">{last(you.name)}</span><span className="lf-chip red"/>
      <span className="lf-logo">VS</span>
      <span ref={el => { hud.current.clock = el; }} className="lf-clock">{Math.floor(ROUND_SECONDS / 60)}:{String(ROUND_SECONDS % 60).padStart(2, '0')}</span>
      <span ref={el => { hud.current.round = el; }} className="lf-round">R1</span>
      <span className="lf-chip blue"/><span className="lf-sname">{last(opp.name)}</span>
    </div>

    {callout && <div key={callout.key} className={`lf-callout ${callout.tone}`} aria-live="assertive">{callout.text}</div>}
    {ground && <div className="lf-ground">
      <span>{ground === 'top' ? 'Top position: J / K ground and pound · L submission' : 'On your back: mash any attack key to escape'}</span>
      <span className="lf-meter"><b>Escape</b><span className="lf-mbar"><i className="esc" ref={el => { hud.current.escape = el; }}/></span></span>
      <span className="lf-meter"><b>Submission</b><span className="lf-mbar"><i className="sub" ref={el => { hud.current.sub = el; }}/></span></span>
    </div>}

    <div className="lf-tools">
      <button onClick={toggleFull} aria-label={full ? 'Exit fullscreen' : 'Fullscreen'}>{full ? <Minimize size={18}/> : <Maximize size={18}/>}</button>
      <button onClick={() => setPaused(p => !p)} aria-label={paused ? 'Resume' : 'Pause'}><Pause size={18}/></button>
    </div>
    {paused && <div className="lf-pause"><h2>Paused</h2>
      <button className="button primary" onClick={() => setPaused(false)}><Play size={16} aria-hidden="true"/>Resume</button>
      {onSim && <button className="button outline" onClick={onSim}><FastForward size={16} aria-hidden="true"/>Simulate the rest</button>}
      {onQuit && <button className="button outline" onClick={onQuit}><X size={16} aria-hidden="true"/>Leave the fight</button>}
      <p className="lf-keys"><kbd>A</kbd><kbd>D</kbd> move · <kbd>S</kbd> block · <kbd>J</kbd> jab · <kbd>K</kbd> cross / hook · <kbd>L</kbd> kick · <kbd>I</kbd> elbow · <kbd>Space</kbd> takedown</p>
    </div>}
    {error && <div className="lf-pause"><h2>Can't start the fight</h2><p>{error}</p>{onSim && <button className="button primary" onClick={onSim}>Simulate the fight</button>}{onQuit && <button className="button outline" onClick={onQuit}>Back</button>}</div>}

    <div className="lf-pad" aria-label="Touch controls">
      <div className="lf-dpad"><button {...touch('left')} aria-label="Move left">◀</button><button {...touch('block')} aria-label="Block">Block</button><button {...touch('right')} aria-label="Move right">▶</button></div>
      <div className="lf-btns"><button className="jab" {...touch('jab')}>Jab</button><button className="cross" {...touch('cross')}>Cross</button><button className="kick" {...touch('kick')}>Kick</button><button className="upper" {...touch('upper')}>Elbow</button><button className="shoot" {...touch('shoot')}>Shoot</button></div>
    </div>
    {ready && !paused && <p className="lf-hint"><kbd>J</kbd> jab <kbd>K</kbd> cross <kbd>L</kbd> kick <kbd>I</kbd> elbow <kbd>Space</kbd> takedown <kbd>S</kbd> block <kbd>Esc</kbd> menu</p>}
  </div>;
}
