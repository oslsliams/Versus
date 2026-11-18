'use client';
// VERSUS live fights: full-screen playable fight. You are the red corner.
import {useCallback, useEffect, useRef, useState} from 'react';
import {Walkout} from './walkout';
import {Pause, Play, FastForward, Maximize, Minimize, X} from 'lucide-react';
import type {Stats, Style} from '../../lib/career/engine';
import {DT, NO_INPUT, ROUND_SECONDS, aiInput, createFight, damageTaken, makeBrain, step, type Input, type LiveFight as Fight} from '../../lib/fight3d/engine';
import type {FightView} from './fight-view';
import {pairModels, tape as makeTape, withModels, FIGHTER_MODELS, type FightCard, type FighterModel, type Tape} from '../../lib/fight3d/tape';
import {Commentator, VOICES, announce, cornerAdvice, verdict, type Line} from '../../lib/fight3d/commentary';
import type {Look} from '../../lib/cosmetics';

export type Corner = {name: string; color: string; style: Style; stats: Stats; look?: Look};
export type FightStatLine = {sig: number; thrown: number; tdLanded: number; tdAttempts: number; ctrl: number; kds: number; head?: number; body?: number; legs?: number};
export type LiveResult = {winner: 'you' | 'opp' | 'draw'; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; damageTaken: number; cards: [number, number][]; stats?: [FightStatLine, FightStatLine]; how?: string; time?: number; card?: FightCard};

/** bodies for both corners: a fighter's own look wins, otherwise a stable pick, never the same body twice */
export function cornerModels(you: Corner, opp: Corner): [FighterModel, FighterModel] {
  const [a, b] = pairModels(you.name, opp.name);
  const red = you.look?.model ?? a; let blue = opp.look?.model ?? b;
  if (blue === red) blue = opp.look?.model && !you.look?.model ? blue : FIGHTER_MODELS[(FIGHTER_MODELS.indexOf(red) + 3) % FIGHTER_MODELS.length];
  return [red, blue];
}

type Btn = Exclude<keyof Input, 'mx' | 'mz'>;
// WASD / arrows move around the octagon (relative to the camera); Shift blocks (and sprawls)
const KEYMAP: Record<string, Btn> = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  ShiftLeft: 'block', ShiftRight: 'block', KeyO: 'block',
  KeyJ: 'jab', KeyK: 'cross', KeyL: 'kick', KeyI: 'upper', KeyU: 'upper', Space: 'shoot',
};
const last = (n: string) => n.split(' ').slice(-1)[0].toUpperCase();

export function LiveFightGame({you, opp, rounds, difficulty, onEnd, onSim, onQuit, watch = false, card}: {you: Corner; opp: Corner; rounds: number; difficulty: number; onEnd: (r: LiveResult) => void; onSim?: () => void; onQuit?: () => void; watch?: boolean; card?: FightCard}) {
  // the broadcast card: event, billing and the tale of the tape (built from the corners if the caller has nothing richer)
  const [mRed, mBlue] = cornerModels(you, opp);
  const base: FightCard = card ?? {event: 'VERSUS FIGHT NIGHT', billing: 'Main event', you: makeTape(you, opp), opp: makeTape(opp, you)};
  const fc: FightCard = {...base, you: {...base.you, model: mRed}, opp: {...base.opp, model: mBlue}};
  const fcRef = useRef(fc); fcRef.current = fc;
  const [started, setStarted] = useState(false);
  const [walk, setWalk] = useState(false);              // the walkouts play between the tale of the tape and the first bell
  const walkRef = useRef(false); walkRef.current = walk;
  const beginFight = useCallback(() => setStarted(true), []);
  const [comm, setComm] = useState<(Line & {key: number}) | null>(null);
  const [corner, setCorner] = useState<string[] | null>(null);
  const startedRef = useRef(false); startedRef.current = started;
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
  const pausedRef = useRef(false), done = useRef(false), readyRef = useRef(false);
  readyRef.current = ready;
  // AI-vs-AI watch mode skips the tape after a beat
  useEffect(() => { if (watch && ready && !started) { const id = setTimeout(() => setWalk(true), 2500); return () => clearTimeout(id); } }, [watch, ready, started]);
  pausedRef.current = paused;

  useEffect(() => {
    let view: FightView | null = null, raf = 0, last = performance.now(), acc = 0, alive = true, slowFrames = 0, degraded = false;
    const g: Fight = createFight(you, opp, rounds);
    const brain = makeBrain(difficulty), autoBrain = makeBrain(.6);
    const caller = new Commentator([you.name, opp.name]);
    let roundStart = {landed: [0, 0] as [number, number], td: [0, 0] as [number, number]}, lastPhase = g.phase;
    const resize = () => { if (view && shell.current) view.resize(shell.current.clientWidth, shell.current.clientHeight); };
    import('./fight-view').then(async ({FightView, loadFightAssets}) => {
      const [red, blue] = cornerModels(you, opp);
      const plain = new URLSearchParams(location.search).has('nolook');   // debug: fight without tattoos/gear
      const assets = await loadFightAssets(red, blue, p => alive && setLoading(p), plain ? undefined : [you.look ? {...you.look, model: red} : undefined, opp.look ? {...opp.look, model: blue} : undefined]);
      if (!alive || !canvas.current) return;
      try { view = new FightView(canvas.current, g, assets); } catch { setError('Your browser could not start 3D graphics (WebGL). Try another browser or simulate the fight.'); return; }
      resize(); setReady(true); last = performance.now();
      raf = requestAnimationFrame(loop);
    }).catch(() => alive && setError('The fight assets could not load. Check your connection and try again.'));
    const loop = (now: number) => {
      if (!startedRef.current) { last = now; raf = requestAnimationFrame(loop); return; }   // tale of the tape is up
      const raw = (now - last) / 1000; last = now;
      const frame = Math.min(.5, raw);
      if (!degraded) { slowFrames = raw > .045 ? slowFrames + 1 : Math.max(0, slowFrames - 1); if (slowFrames > 45) { degraded = true; view?.degrade(); } }
      if (!pausedRef.current) {
        acc += frame;
        while (acc >= DT) {
          const ai = aiInput(g, g.f[1], g.f[0], brain);
          if (!watch) {   // screen-space keys -> world movement along the camera's axes
            const h = held.current, ax = view!.axes, sx = (h.right ? 1 : 0) - (h.left ? 1 : 0), sy = (h.up ? 1 : 0) - (h.down ? 1 : 0);
            h.mx = sx * ax.rx + sy * ax.fx; h.mz = sx * ax.rz + sy * ax.fz;
          }
          const me = watch ? aiInput(g, g.f[0], g.f[1], autoBrain) : {held: held.current, pressed: pressed.current};
          step(g, [me.held, ai.held], [me.pressed, ai.pressed]);
          pressed.current = {...NO_INPUT};
          view!.events(g.events);
          const said = caller.feed(g, g.events, DT); if (said) setComm({...said, key: Math.random()});
          if (g.phase !== lastPhase) {
            if (g.phase === 'break' && !watch) setCorner(cornerAdvice(g, roundStart));
            if (g.phase === 'intro' || g.phase === 'fight') { setCorner(null); if (g.phase === 'fight') roundStart = {landed: [g.f[0].landed, g.f[1].landed], td: [g.f[0].takedowns, g.f[1].takedowns]}; }
            lastPhase = g.phase;
          }
          for (const e of g.events) if (e.text) setCallout({text: e.text, key: Math.random(), tone: e.type === 'ko' || e.type === 'tap' || e.type === 'hurt' ? 'big' : e.side === 0 ? 'you' : 'opp'});
          acc -= DT;
        }
        view!.render(g, frame);
        paint(g);
        if (g.phase === 'over' && g.phaseT > 2.6 && !done.current) {
          done.current = true;
          const r = g.result!;
          const line = (f: Fight['f'][number]): FightStatLine => ({sig: f.landed, thrown: f.thrown, tdLanded: f.takedowns, tdAttempts: f.tdAttempts, ctrl: Math.round(f.ctrl), kds: f.knockdowns, head: f.headLanded, body: f.bodyLanded, legs: f.legLanded});
          onEnd({winner: r.winner === 0 ? 'you' : r.winner === 1 ? 'opp' : 'draw', method: r.method, round: r.round, damageTaken: damageTaken(g.f[0]), cards: g.cards, stats: [line(g.f[0]), line(g.f[1])], how: r.how, time: r.time, card: fcRef.current});
        }
      }
      raf = requestAnimationFrame(loop);
    };
    const paint = (g: Fight) => {
      const h = hud.current;
      g.f.forEach((f, i) => {
        const hp = h['hp' + i], st = h['st' + i];
        if (hp) { hp.style.width = `${Math.max(0, f.hp)}%`; hp.dataset.low = f.hp < 30 ? '1' : ''; }
        const cap = h['cap' + i]; if (cap) cap.style.width = `${100 - f.cap}%`;
        for (const [k, v] of [['hd', f.hp], ['bd', f.body], ['lg', f.legs]] as const) { const el = h[k + i]; if (el) el.dataset.lvl = v > 66 ? 'ok' : v > 33 ? 'mid' : 'bad'; }
        const rk = h['rk' + i]; if (rk) rk.dataset.on = f.rocked > 0 ? '1' : '';
        if (st) { st.style.width = `${f.stamina}%`; st.dataset.low = f.stamina < 30 ? '1' : ''; }
        const sn = h['sn' + i]; if (sn) { const s = Math.round(f.stamina); sn.textContent = s < 12 ? `GASSED ${s}` : `STAMINA ${s}`; sn.dataset.low = s < 30 ? '1' : ''; }
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
      if (!startedRef.current) { if ((e.code === 'Enter' || e.code === 'Space') && readyRef.current && !walkRef.current) { e.preventDefault(); setWalk(true); } return; }
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
  const touch = (k: Btn) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); if (!held.current[k]) pressed.current[k] = true; held.current[k] = true; },
    onPointerUp: () => { held.current[k] = false; }, onPointerCancel: () => { held.current[k] = false; }, onPointerLeave: () => { held.current[k] = false; },
  });

  return <div className="lf" ref={shell} role="application" aria-label={`Live fight: ${you.name} versus ${opp.name}`}>
    <canvas ref={canvas}/>
    {!started && !error && (walk ? <Walkout card={fc} onDone={beginFight}/> : <TaleOfTape card={fc} ready={ready} loading={loading} onStart={() => setWalk(true)}/>)}

    <div className="lf-top">
      {[you, opp].map((c, i) => <div key={i} className={`lf-plate ${i ? 'blue' : 'red'}`}>
        <span className="lf-bars"><span className="lf-hp"><i ref={el => { hud.current['hp' + i] = el; }}/><b className="lf-cap" title="Damage he can't recover from this fight" ref={el => { hud.current['cap' + i] = el; }}/></span>
          <span className="lf-dmg" aria-hidden="true"><b ref={el => { hud.current['hd' + i] = el; }}>HEAD</b><b ref={el => { hud.current['bd' + i] = el; }}>BODY</b><b ref={el => { hud.current['lg' + i] = el; }}>LEGS</b><em ref={el => { hud.current['rk' + i] = el; }}>ROCKED</em></span><span className="lf-st"><i ref={el => { hud.current['st' + i] = el; }}/></span><b className="lf-stn" ref={el => { hud.current['sn' + i] = el; }}>STAMINA 100</b></span>
        <span className="lf-name">{(i ? fc.opp : fc.you).rank && <b className={`lf-rank ${(i ? fc.opp : fc.you).rank === 'C' ? 'champ' : ''}`}>{(i ? fc.opp : fc.you).rank}</b>}{c.name.toUpperCase()}</span>
      </div>)}
    </div>

    <div className={`lf-event ${fc.title ? 'title' : ''}`}>{fc.event} · {fc.title ?? fc.billing}</div>
    <div className="lf-score">
      <span className="lf-sname">{fc.you.rank && <b className={`lf-srank ${fc.you.rank === 'C' ? 'champ' : ''}`} title={fc.you.rank === 'C' ? 'Champion' : `Ranked ${fc.you.rank}`}>{fc.you.rank}</b>}{last(you.name)}</span><span className="lf-chip red"/>
      <span className="lf-logo">VS</span>
      <span ref={el => { hud.current.clock = el; }} className="lf-clock">{Math.floor(ROUND_SECONDS / 60)}:{String(ROUND_SECONDS % 60).padStart(2, '0')}</span>
      <span ref={el => { hud.current.round = el; }} className="lf-round">R1</span>
      <span className="lf-chip blue"/><span className="lf-sname">{last(opp.name)}{fc.opp.rank && <b className={`lf-srank ${fc.opp.rank === 'C' ? 'champ' : ''}`} title={fc.opp.rank === 'C' ? 'Champion' : `Ranked ${fc.opp.rank}`}>{fc.opp.rank}</b>}</span>
    </div>

    {comm && started && <div key={comm.key} className={`lf-comm ${comm.who}`} aria-live="polite"><b>{VOICES[comm.who]}</b>{comm.text}</div>}
    {corner && <div className="lf-corner" role="status"><span className="eyebrow">Your corner</span><ul>{corner.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
    {callout && <div key={callout.key} className={`lf-callout ${callout.tone}`} aria-live="assertive">{callout.text}</div>}
    {ground && <div className="lf-ground">
      <span>{ground === 'top' ? 'Top: J / K ground and pound · L start a submission, then mash J / K to crank it' : 'On your back: mash any key to fill Escape (and to fight off submissions)'}</span>
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
      <p className="lf-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move around the cage · <kbd>Shift</kbd> block (tap as they shoot to sprawl, block a leg kick to check it) · <kbd>J</kbd> jab · <kbd>K</kbd> cross / hook · <kbd>L</kbd> kick (body) · <kbd>I</kbd> elbow / hook · <kbd>Space</kbd> takedown</p>
      <p className="lf-keys">Aim: hold <kbd>W</kbd> + <kbd>L</kbd> for a head kick, <kbd>S</kbd> + <kbd>L</kbd> for a leg kick, <kbd>S</kbd> + a punch to go to the body. Hooks, elbows and head kicks knock people out; counters (hitting him as he throws) hit hardest. Body shots drain his gas tank, leg kicks slow him down.</p>
    </div>}
    {error && <div className="lf-pause"><h2>Can't start the fight</h2><p>{error}</p>{onSim && <button className="button primary" onClick={onSim}>Simulate the fight</button>}{onQuit && <button className="button outline" onClick={onQuit}>Back</button>}</div>}

    <div className="lf-pad" aria-label="Touch controls">
      <div className="lf-dpad"><button {...touch('up')} aria-label="Move in">▲</button><button {...touch('left')} aria-label="Move left">◀</button><button {...touch('block')} aria-label="Block">Block</button><button {...touch('right')} aria-label="Move right">▶</button><button {...touch('down')} aria-label="Move out">▼</button></div>
      <div className="lf-btns"><button className="jab" {...touch('jab')}>Jab</button><button className="cross" {...touch('cross')}>Cross</button><button className="kick" {...touch('kick')}>Kick</button><button className="upper" {...touch('upper')}>Elbow</button><button className="shoot" {...touch('shoot')}>Shoot</button></div>
    </div>
    {ready && !paused && <p className="lf-hint"><kbd>J</kbd> jab <kbd>K</kbd> cross <kbd>L</kbd> kick <kbd>I</kbd> hook <kbd>W</kbd>/<kbd>S</kbd>+strike head / body-legs <kbd>Space</kbd> takedown <kbd>Shift</kbd> block / sprawl <kbd>Esc</kbd> menu</p>}
  </div>;
}

/* ================================================================ broadcast graphics */
// champions get the belt version of their portrait
const PORTRAIT = (t: Tape, stance = false) => t.model ? `/fighters/${t.model}${t.rank === 'C' ? '-champ' : stance ? '-stance' : ''}.webp` : null;
function Side({t, side, stance}: {t: Tape; side: 'red' | 'blue'; stance?: boolean}) {
  const src = PORTRAIT(t, stance);
  const [first, ...rest] = t.name.toUpperCase().split(' ');
  return <div className={`tt-side ${side}`}>
    {src ? <img className={`tt-portrait ${stance ? 'alive' : ''}`} src={src} alt="" width={720} height={1100}/> : <span className="tt-portrait none" aria-hidden="true"/>}
    <div className="tt-id">
      <span className="tt-name">{t.rank && <b className={`tt-rank ${t.rank === 'C' ? 'champ' : ''}`}>{t.rank}</b>}{first}<br/>{rest.join(' ')}</span>
      {t.nickname && <span className="tt-nick">&ldquo;{t.nickname}&rdquo;</span>}
      <span className="tt-meta"><span>{t.country ?? t.style}</span><span>{t.record}</span><span className={t.fav ? 'fav' : 'und'}>{t.odds} {t.fav ? 'FAV' : 'UND'}</span></span>
    </div>
  </div>;
}
/** pre-fight tale of the tape (broadcast style), doubles as the loading screen */
function TaleOfTape({card, ready, loading, onStart}: {card: FightCard; ready: boolean; loading: number; onStart: () => void}) {
  const rows: [string, string, string][] = [['RECORD', card.you.record, card.opp.record], ['AGE', String(card.you.age), String(card.opp.age)], ['HEIGHT', card.you.height, card.opp.height], ['WEIGHT', card.you.weight, card.opp.weight], ['REACH', card.you.reach, card.opp.reach], ['STYLE', card.you.style, card.opp.style],
    ['ODDS', card.you.odds, card.opp.odds], ...(card.you.prob != null ? [['WIN CHANCE', `${Math.round(card.you.prob * 100)}%`, `${Math.round((1 - card.you.prob) * 100)}%`] as [string, string, string]] : [])];
  return <div className="tt" role="dialog" aria-label="Tale of the tape">
    <Side t={card.you} side="red" stance/>
    <div className="tt-mid">
      <div className="tt-event"><strong>VERSUS</strong><span>{card.event.replace(/^VERSUS\s*/, '') || 'FIGHT NIGHT'}</span></div>
      <h2 className="tt-title">{card.title ?? card.billing.toUpperCase()}<small>{card.title ? 'Championship bout · 5 rounds' : 'Tale of the tape'}</small></h2>
      <dl className="tt-rows">{rows.map(([k, a, b]) => <div key={k}><dd>{a}</dd><dt>{k}</dt><dd>{b}</dd></div>)}</dl>
      <p className="tt-announce">{announce(card)}</p>
      <div className="tt-sponsor">RIPTIDE ENERGY</div>
      {ready ? <button className="button primary tt-go" onClick={onStart} autoFocus>Walk out <kbd>Enter</kbd></button>
        : <div className="tt-load"><span>Loading the arena… {Math.round(loading * 100)}%</span><span className="lf-loadbar"><i style={{width: `${loading * 100}%`}}/></span></div>}
    </div>
    <Side t={card.opp} side="blue" stance/>
  </div>;
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
/** post-fight statistics (broadcast style) */
export function FightStats({card: raw, stats, result}: {card: FightCard; stats: [FightStatLine, FightStatLine]; result?: {winner: 'you' | 'opp' | 'draw'; method: string; round: number; how?: string; time?: number; card?: FightCard}}) {
  const card = result?.card ?? withModels(raw);
  const pct = (a: number, b: number) => b ? ` (${Math.round(a / b * 100)}%)` : '';
  const rows: [string, string, string][] = [
    ['SIGNIFICANT STRIKES', `${stats[0].sig}${pct(stats[0].sig, stats[0].thrown)}`, `${stats[1].sig}${pct(stats[1].sig, stats[1].thrown)}`], ['STRIKES THROWN', `${stats[0].thrown}`, `${stats[1].thrown}`],
    ...(stats[0].head != null ? [['HEAD / BODY / LEGS', `${stats[0].head}/${stats[0].body}/${stats[0].legs}`, `${stats[1].head}/${stats[1].body}/${stats[1].legs}`] as [string, string, string]] : []),
    ['KNOCKDOWNS', `${stats[0].kds}`, `${stats[1].kds}`], ['TAKEDOWNS LANDED', `${stats[0].tdLanded}`, `${stats[1].tdLanded}`],
    ['TAKEDOWNS ATTEMPTED', `${stats[0].tdAttempts}`, `${stats[1].tdAttempts}`], ['GROUND CONTROL TIME', mmss(stats[0].ctrl), mmss(stats[1].ctrl)],
  ];
  const [a, b] = [card.you, card.opp];
  return <section className="tt tt-stats" aria-label="Fight statistics">
    <Side t={a} side="red"/>
    <div className="tt-mid">
      <div className="tt-event"><strong>VERSUS</strong><span>{card.event.replace(/^VERSUS\s*/, '') || 'FIGHT NIGHT'}</span></div>
      <h2 className="tt-title">FIGHT STATISTICS</h2>
      <div className="tt-heads"><span className="red">{a.name.toUpperCase()}</span><span className="blue">{b.name.toUpperCase()}</span></div>
      <dl className="tt-rows">{rows.map(([k, x, y]) => <div key={k}><dd>{x}</dd><dt>{k}</dt><dd>{y}</dd></div>)}</dl>
      {result && <Verdict card={card} result={result}/>}
    </div>
    <Side t={b} side="blue"/>
  </section>;
}
function Verdict({card, result}: {card: FightCard; result: {winner: 'you' | 'opp' | 'draw'; method: string; round: number; how?: string; time?: number}}) {
  const [v] = useState(() => verdict(card, result));   // pick the quotes once
  const official = result.winner === 'draw' ? 'DRAW' : `${result.method}${result.how ? ` (${result.how.toUpperCase()})` : ''} · ROUND ${result.round}${result.time != null ? ` · ${mmss(Math.round(result.time))}` : ''}`;
  return <div className="tt-verdict"><span className="tt-official">{official}</span><strong>{v.headline}</strong>{v.quotes.map(([who, q]) => <p key={who}><b>{who.split(' ').slice(-1)[0].toUpperCase()}:</b> “{q}”</p>)}</div>;
}