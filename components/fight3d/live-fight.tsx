'use client';
// VERSUS live fights: full-screen playable fight. You are the red corner.
import {useCallback, useEffect, useRef, useState} from 'react';
import {WalkoutHud, walkOrder} from './walkout';
import {Pause, Play, FastForward, Maximize, Minimize, X} from 'lucide-react';
import type {Stats, Style} from '../../lib/career/engine';
import {applyFightSettings, loadFightSettings} from './fight-settings';
import {DT, GOPTS, GPOS_LABEL, NO_INPUT, aiInput, applyFX, createFight, damageTaken, grappleOptions, grappleSubs, makeBrain, step, type GDir, type Input, type LiveFight as Fight} from '../../lib/fight3d/engine';
import type {FightView} from './fight-view';
import {pairModels, tape as makeTape, withModels, FIGHTER_MODELS, type FightCard, type FighterModel, type Tape} from '../../lib/fight3d/tape';
import {Commentator, VOICES, announce, cornerAdvice, verdict, type Line} from '../../lib/fight3d/commentary';
import type {Look} from '../../lib/cosmetics';
import {goalValue, type FightTale} from '../../lib/career/story';
import {sfx} from './sound';
import {MuteButton} from './mute-button';

export type Corner = {name: string; color: string; style: Style; stats: Stats; look?: Look; /** a cut carried in from camp (0-100) */ cut?: number};
export type FightStatLine = {sig: number; thrown: number; tdLanded: number; tdAttempts: number; ctrl: number; kds: number; head?: number; body?: number; legs?: number};
export type LiveResult = {winner: 'you' | 'opp' | 'draw'; method: 'KO/TKO' | 'SUB' | 'DEC' | 'SPLIT DEC' | 'DRAW'; round: number; damageTaken: number; cards: [number, number][]; stats?: [FightStatLine, FightStatLine]; how?: string; time?: number; card?: FightCard; tale?: FightTale};

/** bodies for both corners: a fighter's own look wins, otherwise a stable pick, never the same body twice */
export function cornerModels(you: Corner, opp: Corner): [FighterModel, FighterModel] {
  const [a, b] = pairModels(you.name, opp.name);
  const red = you.look?.model ?? a; let blue = opp.look?.model ?? b;
  if (blue === red) blue = opp.look?.model && !you.look?.model ? blue : FIGHTER_MODELS[(FIGHTER_MODELS.indexOf(red) + 3) % FIGHTER_MODELS.length];
  return [red, blue];
}

type Btn = Exclude<keyof Input, 'mx' | 'mz'>;
/** what the grappling guide shows (rebuilt only when something changes; the bars move every frame through refs) */
type GView = {pos: string; role: 'top' | 'bottom' | 'clinch' | 'drive'; opts: {dir: GDir; label: string}[]; subs: string[];
  read: {label: string | null; lit: GDir | null; dirs: GDir[]; guessed: GDir | null} | null; mine: string | null; sub: {name: string; mine: boolean; choke: boolean} | null};
// WASD / arrows move around the octagon (relative to the camera); Shift blocks (and sprawls)
const KEYMAP: Record<string, Btn> = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  ShiftLeft: 'block', ShiftRight: 'block', KeyO: 'block',
  KeyJ: 'jab', KeyK: 'cross', KeyL: 'kick', KeyI: 'upper', KeyU: 'upper', Space: 'shoot',
};
const last = (n: string) => n.split(' ').slice(-1)[0].toUpperCase();

export function LiveFightGame({you, opp, rounds, difficulty, onEnd, onSim, onQuit, watch = false, card, venue = 2}: {you: Corner; opp: Corner; rounds: number; difficulty: number; onEnd: (r: LiveResult) => void; onSim?: () => void; onQuit?: () => void; watch?: boolean; card?: FightCard; venue?: number}) {
  // the broadcast card: event, billing and the tale of the tape (built from the corners if the caller has nothing richer)
  const [mRed, mBlue] = cornerModels(you, opp);
  const base: FightCard = card ?? {event: 'VERSUS FIGHT NIGHT', billing: 'Main event', you: makeTape(you, opp), opp: makeTape(opp, you)};
  const fc: FightCard = {...base, you: {...base.you, model: mRed}, opp: {...base.opp, model: mBlue}};
  const fcRef = useRef(fc); fcRef.current = fc;
  const [started, setStarted] = useState(false);
  const [walk, setWalk] = useState(false);              // the walkouts play between the tale of the tape and the first bell
  const walkRef = useRef(false); walkRef.current = walk;
  const [walkStep, setWalkStep] = useState(0);
  const viewRef = useRef<FightView | null>(null);
  const skipWalk = useCallback(() => { viewRef.current?.director?.skip(); }, []);
  const [comm, setComm] = useState<(Line & {key: number}) | null>(null);
  const [corner, setCorner] = useState<string[] | null>(null);
  const startedRef = useRef(false); startedRef.current = started;
  const canvas = useRef<HTMLCanvasElement>(null), shell = useRef<HTMLDivElement>(null);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const held = useRef<Input>({...NO_INPUT}), pressed = useRef<Input>({...NO_INPUT});
  const [callout, setCallout] = useState<{text: string; key: number; tone: string} | null>(null);
  // juice: pop-up hit bubbles over the fighters, a white flash on the big moments
  const [bubbles, setBubbles] = useState<{id: number; text: string; x: number; y: number; tone: string}[]>([]);
  const [flash, setFlash] = useState(0);
  // the end: KO replay, then the decision (hand raise), then the stats screen
  const [stage, setStage] = useState<null | 'replay' | 'decision'>(null);
  const stageRef = useRef<null | 'replay' | 'decision'>(null); stageRef.current = stage;
  const endRef = useRef<LiveResult | null>(null);
  const finish = useCallback(() => { if (endRef.current) onEnd(endRef.current); }, [onEnd]);
  useEffect(() => { if (!bubbles.length) return; const id = setTimeout(() => setBubbles(b => b.slice(1)), 950); return () => clearTimeout(id); }, [bubbles]);
  // watch mode moves on from the decision by itself
  useEffect(() => { if (watch && stage === 'decision') { const id = setTimeout(finish, 12000); return () => clearTimeout(id); } }, [watch, stage, finish]);
  const [paused, setPaused] = useState(false);
  const [gv, setGv] = useState<GView | null>(null);
  const [loading, setLoading] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [full, setFull] = useState(false);
  // the player's fight settings (game style, realism sliders, presentation switches)
  const [fset] = useState(loadFightSettings);
  const fsRef = useRef(fset); fsRef.current = fset;
  const pausedRef = useRef(false), done = useRef(false), readyRef = useRef(false);
  readyRef.current = ready;
  // AI-vs-AI watch mode skips the tape after a beat
  useEffect(() => { if (watch && ready && !started) { const id = setTimeout(() => setWalk(true), 2500); return () => clearTimeout(id); } }, [watch, ready, started]);
  pausedRef.current = paused;
  // sound: walkout music, then the crowd for the fight, and silence when the fight screen closes
  useEffect(() => { if (walk && !started) { sfx.unlock(); sfx.crowdOn(venue); sfx.walkoutOn(); } if (started) sfx.walkoutOff(); }, [walk, started, venue]);
  useEffect(() => () => sfx.stopFight(), []);
  useEffect(() => { if (stage === 'decision' && endRef.current) sfx.fanfare(endRef.current.winner === 'you'); }, [stage]);

  useEffect(() => {
    let view: FightView | null = null, raf = 0, last = performance.now(), acc = 0, alive = true, slowFrames = 0, degraded = false;
    applyFightSettings(fsRef.current);
    applyFX({human: watch ? -1 : 0});   // the player is the red corner (AI-vs-AI watch mode has no human)
    const g: Fight = createFight(you, opp, rounds);
    const brain = makeBrain(difficulty), autoBrain = makeBrain(.6);
    const caller = new Commentator([you.name, opp.name]);
    let roundStart = {landed: [0, 0] as [number, number], td: [0, 0] as [number, number]}, lastPhase = g.phase;
    // what really happened in this fight, for the story afterwards
    const told = {kdFor: 0, kdAgainst: 0, rockedFor: 0, rockedAgainst: 0, tired: 0};
    const goal = fcRef.current.story?.goal;
    const resize = () => { if (view && shell.current) view.resize(shell.current.clientWidth, shell.current.clientHeight); };
    import('./fight-view').then(async ({FightView, loadFightAssets}) => {
      const [red, blue] = cornerModels(you, opp);
      const plain = new URLSearchParams(location.search).has('nolook');   // debug: fight without tattoos/gear
      const assets = await loadFightAssets(red, blue, p => alive && setLoading(p), plain ? undefined : [you.look ? {...you.look, model: red} : undefined, opp.look ? {...opp.look, model: blue} : undefined], !!fcRef.current.title);
      if (!alive || !canvas.current) return;
      try { const beltsOf = (t: Tape) => t.rank === 'C' ? Math.max(1, t.belts ?? 1) : 0;
        view = new FightView(canvas.current, g, assets, venue, {title: !!fcRef.current.title, held: [beltsOf(fcRef.current.you), beltsOf(fcRef.current.opp)]}); viewRef.current = view;
        view.shakeMul = fsRef.current.shake ? 1 : 0; view.setBlood(fsRef.current.blood); } catch { setError('Your browser could not start 3D graphics (WebGL). Try another browser or simulate the fight.'); return; }
      if (new URLSearchParams(location.search).has('debugview')) Object.assign(window, {__view: view, __fight: g});   // test hook
      resize(); setReady(true); last = performance.now();
      raf = requestAnimationFrame(loop);
    }).catch(() => alive && setError('The fight assets could not load. Check your connection and try again.'));
    const loop = (now: number) => {
      if (!startedRef.current) {
        // the walkouts: the 3D director runs the arena until both fighters are in the cage
        if (walkRef.current && view) {
          try {
            const d = view.startWalkout(walkOrder(fcRef.current));
            view.render(g, Math.min(.25, (now - last) / 1000)); last = now;
            setWalkStep(d.who);
            if (d.done) setStarted(true);
          } catch (err) { console.error('walkout failed, going straight to the fight', err); view.director?.skip(); setStarted(true); }
          raf = requestAnimationFrame(loop); return;
        }
        last = now; raf = requestAnimationFrame(loop); return;   // tale of the tape is up
      }
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
          view!.events(g.events); sfx.events(g.events);
          for (const e of g.events) {
            if (e.type === 'kd' || e.type === 'ko') { if (e.side === 0) told.kdFor++; else told.kdAgainst++; }
            else if (e.type === 'hurt') { if (e.side === 0) told.rockedFor++; else told.rockedAgainst++; }
            else if (e.type === 'tired' && e.side === 0) told.tired++;
          }
          const said = caller.feed(g, g.events, DT); if (said && fsRef.current.commentary) setComm({...said, key: Math.random()});
          if (g.phase !== lastPhase) {
            if (g.phase === 'break' && !watch) setCorner(cornerAdvice(g, roundStart));
            if (g.phase === 'intro' || g.phase === 'fight') { setCorner(null); if (g.phase === 'fight') roundStart = {landed: [g.f[0].landed, g.f[1].landed], td: [g.f[0].takedowns, g.f[1].takedowns]}; }
            lastPhase = g.phase;
          }
          for (const e of g.events) if (e.text && e.type !== 'hit' && e.type !== 'block') setCallout({text: e.text, key: Math.random(), tone: e.type === 'ko' || e.type === 'tap' || e.type === 'hurt' ? 'big' : e.side === 0 ? 'you' : 'opp'});
          pop(g);
          acc -= DT;
        }
        view!.render(g, frame); sfx.crowdTick(frame);
        paint(g);
        if (g.phase === 'over' && g.phaseT > 2.6 && !done.current) {
          done.current = true;
          const r = g.result!;
          const line = (f: Fight['f'][number]): FightStatLine => ({sig: f.landed, thrown: f.thrown, tdLanded: f.takedowns, tdAttempts: f.tdAttempts, ctrl: Math.round(f.ctrl), kds: f.knockdowns, head: f.headLanded, body: f.bodyLanded, legs: f.legLanded});
          endRef.current = {winner: r.winner === 0 ? 'you' : r.winner === 1 ? 'opp' : 'draw', method: r.method, round: r.round, damageTaken: damageTaken(g.f[0]), cards: g.cards, stats: [line(g.f[0]), line(g.f[1])], how: r.how, time: r.time, card: fcRef.current,
            tale: {kdFor: told.kdFor, kdAgainst: told.kdAgainst, rockedFor: told.rockedFor, rockedAgainst: told.rockedAgainst, landed: g.f[0].landed, thrown: g.f[0].thrown, head: g.f[0].headLanded, body: g.f[0].bodyLanded, legs: g.f[0].legLanded, takedowns: g.f[0].takedowns, ctrl: Math.round(g.f[0].ctrl), gassed: told.tired >= 3, legsGone: g.f[0].legs < 30, bodyGone: g.f[0].body < 30, closeCards: g.cards.some(([a, b]) => Math.abs(a - b) <= 1), cut: Math.round(g.f[0].cut), oppCut: Math.round(g.f[1].cut)}};
          // knockouts get the slow-motion replay first; everything ends with the hand raise
          if (fsRef.current.replay && r.method === 'KO/TKO' && view!.finale.hasKO && r.winner !== -1) { view!.finale.startReplay(r.winner === 0 ? 1 : 0); setStage('replay'); }
          else { view!.finale.startCeremony(r.winner); setStage('decision'); }
        }
        if (stageRef.current === 'replay' && view!.finale.replayDone && view!.finale.mode === 'replay') { view!.finale.startCeremony(g.result!.winner); setStage('decision'); }
      }
      raf = requestAnimationFrame(loop);
    };
    // pop-up bubbles: clean shots, counters, body and leg work, checks, and combo counts
    const streak = [0, 0], streakT = [0, 0];
    const pop = (g: Fight) => {
      if (!view) return;
      const now = performance.now(), add: {id: number; text: string; x: number; y: number; tone: string}[] = [];
      for (const e of g.events) {
        const s = e.side, d = (s === 0 ? 1 : 0) as 0 | 1;
        let text = '', who: 0 | 1 = d;
        if (e.type === 'hit') {
          if (now - streakT[s] > 1300) streak[s] = 0; streak[s]++; streakT[s] = now; streak[d] = 0;
          if (e.text === 'Counter!') text = 'COUNTER!';
          else if (e.target === 'body' && e.power > .3) text = 'BODY!';
          else if (e.target === 'legs' && e.power > .3) text = 'LEG KICK!';
          else if (e.target !== 'body' && e.target !== 'legs' && e.power > 1) text = 'BOOM!';
          else if (e.target !== 'body' && e.target !== 'legs' && e.power > .6) text = 'CLEAN!';
          if (streak[s] >= 3) { add.push({id: Math.random(), text: streak[s] + ' HIT COMBO', x: 0, y: 0, tone: 'combo ' + (s === 0 ? 'red' : 'blue')}); const p = view.screenOf(s); add[add.length - 1].x = p.x; add[add.length - 1].y = p.y - 40; }
        } else if (e.type === 'block' && e.target === 'legs') { text = 'CHECKED!'; who = d; }
        if (e.type === 'ko' || e.type === 'kd' || e.type === 'hurt') setFlash(Math.random());
        if (!text) continue;
        const p = view.screenOf(who);
        add.push({id: Math.random(), text, x: p.x + (Math.random() - .5) * 40, y: p.y, tone: s === 0 ? 'red' : 'blue'});
      }
      if (add.length && fsRef.current.bubbles) setBubbles(b => [...b, ...add].slice(-5));
    };
    let gkey = '';
    const paint = (g: Fight) => {
      const h = hud.current, me0 = () => g.f[0];
      g.f.forEach((f, i) => {
        const hp = h['hp' + i], st = h['st' + i];
        if (hp) { hp.style.width = `${Math.max(0, f.hp)}%`; hp.dataset.low = f.hp < 30 ? '1' : ''; }
        const cap = h['cap' + i]; if (cap) cap.style.width = `${100 - f.cap}%`;
        for (const [k, v] of [['hd', f.hp], ['bd', f.body], ['lg', f.legs]] as const) { const el = h[k + i]; if (el) el.dataset.lvl = v > 66 ? 'ok' : v > 33 ? 'mid' : 'bad'; }
        const rk = h['rk' + i]; if (rk) rk.dataset.on = f.rocked > 0 ? '1' : '';
        const ct = h['ct' + i]; if (ct) { ct.dataset.on = f.cut > 1 ? '1' : ''; ct.dataset.bad = f.cut >= 50 ? '1' : ''; }
        if (st) { st.style.width = `${f.stamina}%`; st.dataset.low = f.stamina < 30 ? '1' : ''; }
        const pl = h['pl' + i]; if (pl) pl.dataset.show = f.hp < 60 || f.cap < 75 || f.stamina < 45 || f.body < 50 || f.legs < 50 || f.rocked > 0 || f.cut > 1 ? '1' : '';
        const sn = h['sn' + i]; if (sn) { const s = Math.round(f.stamina); sn.textContent = s < 12 ? `GASSED ${s}` : `STAMINA ${s}`; sn.dataset.low = s < 30 ? '1' : ''; }
      });
      const gl = h.goal; if (gl && goal) { const n = goal.kind === 'body' || goal.kind === 'legs' || goal.kind === 'td' || goal.kind === 'landed' ? goalValue(goal, {body: me0().bodyLanded, legs: me0().legLanded, takedowns: me0().takedowns, landed: me0().landed, kdAgainst: told.kdAgainst}) : null; const txt = n == null ? goal.label : `${goal.label}: ${Math.min(n, goal.n)}/${goal.n}`; if (gl.textContent !== txt) gl.textContent = txt; gl.dataset.done = n != null && n >= goal.n ? '1' : ''; }
      const clock = h.clock; if (clock) { const s = Math.max(0, Math.ceil(g.clock)); clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
      const rd = h.round; if (rd) rd.textContent = g.phase === 'break' ? 'BREAK' : `R${g.round}`;
      // grappling guide: where you are, what you can do, the read when he moves, the bar chase in a submission
      const G = g.grap;
      let view: GView | null = null;
      if (G && !watch) {
        const m = G.move, S = G.sub, theirRole = G.top === 1 ? 'top' : 'bottom';
        view = {pos: GPOS_LABEL[G.pos], role: G.pos === 'clinch' ? 'clinch' : G.pos === 'drive' ? 'drive' : G.top === 0 ? 'top' : 'bottom',
          opts: m || S ? [] : grappleOptions(g, 0).map(o => ({dir: o.dir, label: o.label})), subs: m || S ? [] : grappleSubs(g, 0),
          read: m && m.by === 1 ? {label: m.t >= m.tele ? m.opt.label : null, lit: m.t >= m.tele ? m.opt.dir : null, guessed: G.guess[0],
            dirs: [...new Set((G.pos === 'drive' ? GOPTS.drive : GOPTS[G.pos].filter(o => o.role === 'any' || o.role === theirRole)).map(o => o.dir))]} : null,
          mine: m && m.by === 0 ? m.opt.label : null, sub: S ? {name: S.name, mine: S.by === 0, choke: S.choke} : null};
        if (m) { const mb = h.gmove; if (mb) mb.style.width = `${Math.min(100, m.t / m.win * 100)}%`; }
        if (S) {
          const put = (el: HTMLElement | null | undefined, c: number, w: number) => { if (el) { el.style.left = `${(c - w / 2) * 100}%`; el.style.width = `${w * 100}%`; } };
          for (const k of ['', '2', '3'] as const) { const off = k === '2' ? 1 : k === '3' ? -1 : 0; put(h['ga' + k], S.a + off, S.aw); put(h['gd' + k], S.d + off, S.dw); }
          const lk = h.glock; if (lk) lk.style.width = `${Math.min(100, S.lock * 100)}%`;
          const es = h.gesc; if (es) es.style.width = `${Math.min(100, S.esc * 100)}%`;
          const gd = h.gdir; if (gd) {
            const mine = S.by === 0, from = mine ? S.a : S.d, to = mine ? S.d : S.a, w = mine ? S.aw : S.dw;
            let diff = to - from; if (S.choke) diff = ((diff + 1.5) % 1) - .5;
            let go = mine ? Math.sign(diff) : -Math.sign(diff || 1);
            if (!mine && !S.choke && ((go < 0 && from - w / 2 < .03) || (go > 0 && from + w / 2 > .97))) go = -go;   // pinned at the end: dart past him
            const txt = mine && Math.abs(diff) < .02 ? 'HOLD' : go < 0 ? `◀ A ${mine ? 'CHASE' : 'RUN'}` : `${mine ? 'CHASE' : 'RUN'} D ▶`;
            if (gd.textContent !== txt) gd.textContent = txt;
          }
        }
      }
      const key = JSON.stringify(view); if (key !== gkey) { gkey = key; setGv(view); }
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
  }, [you, opp, rounds, difficulty, onEnd, watch, venue]);

  const toggleFull = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); } catch { /* fullscreen not allowed here: the overlay still fills the window */ }
  };
  const touch = (k: Btn) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); if (!held.current[k]) pressed.current[k] = true; held.current[k] = true; },
    onPointerUp: () => { held.current[k] = false; }, onPointerCancel: () => { held.current[k] = false; }, onPointerLeave: () => { held.current[k] = false; },
  });

  return <div className={`lf${walk && !started ? ' walking' : ''}${stage ? ' finale' : ''} hud-${fset.hud}`} ref={shell} role="application" aria-label={`Live fight: ${you.name} versus ${opp.name}`}>
    <canvas ref={canvas}/>
    {!started && !error && (walk ? <WalkoutHud card={fc} step={walkStep} onSkip={skipWalk}/> : <TaleOfTape card={fc} ready={ready} loading={loading} onStart={() => setWalk(true)}/>)}

    <div className="lf-top">
      {[you, opp].map((c, i) => <div key={i} className={`lf-plate ${i ? 'blue' : 'red'}`} ref={el => { hud.current['pl' + i] = el; }}>
        <span className="lf-bars"><span className="lf-hp"><i ref={el => { hud.current['hp' + i] = el; }}/><b className="lf-cap" title="Damage he can't recover from this fight" ref={el => { hud.current['cap' + i] = el; }}/></span>
          <span className="lf-dmg" aria-hidden="true"><b ref={el => { hud.current['hd' + i] = el; }}>HEAD</b><b ref={el => { hud.current['bd' + i] = el; }}>BODY</b><b ref={el => { hud.current['lg' + i] = el; }}>LEGS</b><em ref={el => { hud.current['rk' + i] = el; }}>ROCKED</em><em className="lf-cut" ref={el => { hud.current['ct' + i] = el; }}>CUT</em></span><span className="lf-st"><i ref={el => { hud.current['st' + i] = el; }}/></span><b className="lf-stn" ref={el => { hud.current['sn' + i] = el; }}>STAMINA 100</b></span>
        <span className="lf-name">{(i ? fc.opp : fc.you).rank && <b className={`lf-rank ${(i ? fc.opp : fc.you).rank === 'C' ? 'champ' : ''}`}>{(i ? fc.opp : fc.you).rank}</b>}{c.name.toUpperCase()}</span>
      </div>)}
    </div>

    <div className={`lf-event ${fc.title ? 'title' : ''}`}>{fc.title && <img src="/art/belt.webp" alt="" width={46} height={19}/>}{fc.event} · {fc.title ?? fc.billing}</div>
    {fc.story && started && !stage && <div className="lf-goal"><b>{fc.story.title}</b><span ref={el => { hud.current.goal = el; }}>{fc.story.goal.label}</span></div>}
    <div className="lf-score">
      <span className="lf-sname">{fc.you.rank && <b className={`lf-srank ${fc.you.rank === 'C' ? 'champ' : ''}`} title={fc.you.rank === 'C' ? 'Champion' : `Ranked ${fc.you.rank}`}>{fc.you.rank}</b>}{last(you.name)}</span><span className="lf-chip red"/>
      <span className="lf-logo">VS</span>
      <span ref={el => { hud.current.clock = el; }} className="lf-clock">{Math.floor(fset.roundSec / 60)}:{String(fset.roundSec % 60).padStart(2, '0')}</span>
      <span ref={el => { hud.current.round = el; }} className="lf-round">R1</span>
      <span className="lf-chip blue"/><span className="lf-sname">{last(opp.name)}{fc.opp.rank && <b className={`lf-srank ${fc.opp.rank === 'C' ? 'champ' : ''}`} title={fc.opp.rank === 'C' ? 'Champion' : `Ranked ${fc.opp.rank}`}>{fc.opp.rank}</b>}</span>
    </div>

    {comm && started && <div key={comm.key} className={`lf-comm ${comm.who}`} aria-live="polite"><b>{VOICES[comm.who]}</b>{comm.text}</div>}
    {corner && <div className="lf-corner" role="status"><span className="eyebrow">Your corner</span><ul>{corner.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
    {callout && !stage && <div key={callout.key} className={`lf-callout ${callout.tone}`} aria-live="assertive">{callout.text}</div>}
    {flash > 0 && <div key={flash} className="lf-flash" aria-hidden="true"/>}
    {!stage && bubbles.map(b => <span key={b.id} className={`lf-bubble ${b.tone}`} style={{left: b.x, top: b.y}} aria-hidden="true">{b.text}</span>)}
    {stage === 'replay' && <div className="lf-replay" aria-label="Knockout replay"><i/><i/><span className="lf-replay-bug">REPLAY</span><span className="lf-replay-sub">Slow motion</span></div>}
    {stage === 'decision' && endRef.current && <Decision card={fc} result={endRef.current} onContinue={finish}/>}
    {gv && !stage && <GrappleGuide v={gv} hud={hud}/>}

    <div className="lf-tools">
      <MuteButton/>
      <button onClick={toggleFull} aria-label={full ? 'Exit fullscreen' : 'Fullscreen'}>{full ? <Minimize size={18}/> : <Maximize size={18}/>}</button>
      <button onClick={() => setPaused(p => !p)} aria-label={paused ? 'Resume' : 'Pause'}><Pause size={18}/></button>
    </div>
    {paused && <div className="lf-pause"><h2>Paused</h2>
      <button className="button primary" onClick={() => setPaused(false)}><Play size={16} aria-hidden="true"/>Resume</button>
      {onSim && <button className="button outline" onClick={onSim}><FastForward size={16} aria-hidden="true"/>Simulate the rest</button>}
      {onQuit && <button className="button outline" onClick={onQuit}><X size={16} aria-hidden="true"/>Leave the fight</button>}
      <p className="lf-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move around the cage · <kbd>Shift</kbd> block (tap as they shoot to sprawl, block a leg kick to check it) · <kbd>J</kbd> jab · <kbd>K</kbd> cross / hook · <kbd>L</kbd> kick (body) · <kbd>I</kbd> elbow / hook · <kbd>Space</kbd> takedown (in close: clinch)</p>
      <p className="lf-keys">Grappling: <kbd>Space</kbd> + <kbd>W</kbd>/<kbd>A</kbd>/<kbd>D</kbd>/<kbd>S</kbd> to change position · when he moves, press the direction you read to stop it · <kbd>L</kbd> submission, then <kbd>A</kbd>/<kbd>D</kbd> to chase his bar (or run from his) · <kbd>J</kbd>/<kbd>K</kbd> strike. The more hurt and tired a man is, the bigger his bar and the easier he is to catch.</p>
      <p className="lf-keys">Aim: hold <kbd>W</kbd> + <kbd>L</kbd> for a head kick, <kbd>S</kbd> + <kbd>L</kbd> for a leg kick, <kbd>S</kbd> + a punch to go to the body. Hooks, elbows and head kicks knock people out; counters (hitting him as he throws) hit hardest. Body shots drain his gas tank, leg kicks slow him down.</p>
    </div>}
    {error && <div className="lf-pause"><h2>Can't start the fight</h2><p>{error}</p>{onSim && <button className="button primary" onClick={onSim}>Simulate the fight</button>}{onQuit && <button className="button outline" onClick={onQuit}>Back</button>}</div>}

    <div className="lf-pad" aria-label="Touch controls">
      <div className="lf-dpad"><button {...touch('up')} aria-label="Move in">▲</button><button {...touch('left')} aria-label="Move left">◀</button><button {...touch('block')} aria-label="Block">Block</button><button {...touch('right')} aria-label="Move right">▶</button><button {...touch('down')} aria-label="Move out">▼</button></div>
      <div className="lf-btns"><button className="jab" {...touch('jab')}>Jab</button><button className="cross" {...touch('cross')}>Cross</button><button className="kick" {...touch('kick')}>Kick</button><button className="upper" {...touch('upper')}>Elbow</button><button className="shoot" {...touch('shoot')}>Shoot</button></div>
    </div>
    {ready && !paused && fset.hints && <p className="lf-hint"><kbd>J</kbd> jab <kbd>K</kbd> cross <kbd>L</kbd> kick <kbd>I</kbd> hook <kbd>W</kbd>/<kbd>S</kbd>+strike head / body-legs <kbd>Space</kbd> takedown <kbd>Shift</kbd> block / sprawl <kbd>Esc</kbd> menu</p>}
  </div>;
}

/* ================================================================ broadcast graphics */
// champions get the belt version of their portrait, and a double champion carries both belts
const PORTRAIT = (t: Tape, stance = false) => t.model ? `/fighters/${t.model}${t.rank === 'C' ? ((t.belts ?? 1) >= 2 ? '-double' : '-champ') : stance ? '-stance' : ''}.webp` : null;
function Side({t, side, stance}: {t: Tape; side: 'red' | 'blue'; stance?: boolean}) {
  const src = PORTRAIT(t, stance);
  const [first, ...rest] = t.name.toUpperCase().split(' ');
  return <div className={`tt-side ${side}`}>
    {src ? <img className={`tt-portrait ${stance ? 'alive' : ''}`} src={src} alt="" width={720} height={1100}/> : <span className="tt-portrait none" aria-hidden="true"/>}
    <div className="tt-id">
      <span className="tt-name">{t.rank && <b className={`tt-rank ${t.rank === 'C' ? 'champ' : ''}`}>{t.rank}</b>}{first}<br/>{rest.join(' ')}</span>
      {(t.belts ?? 1) >= 2 && <span className="tt-nick">Double champion</span>}
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
      {card.title && <img className="tt-belt" src="/art/belt.webp" alt="The championship belt" width={500} height={210}/>}
      <h2 className="tt-title">{card.title ?? card.billing.toUpperCase()}<small>{card.title ? 'Championship bout · 5 rounds' : 'Tale of the tape'}</small></h2>
      <dl className="tt-rows">{rows.map(([k, a, b]) => <div key={k}><dd>{a}</dd><dt>{k}</dt><dd>{b}</dd></div>)}</dl>
      {card.story ? <div className="tt-story"><b>{card.story.title}</b><p>{card.story.brief}</p><span>Bonus goal: {card.story.goal.label}</span></div> : <p className="tt-announce">{announce(card)}</p>}
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
      {result && card.title && result.winner !== 'draw' && <img className="tt-belt small" src="/art/belt.webp" alt="" width={500} height={210}/>}
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

/** The decision, read like the ring announcer does it, while the referee holds both wrists and then raises the
 *  winner's hand. Finishes give method, strike, time and round; decisions read the judges' totals (winner's score
 *  first, the way official results print them: 29-28, 29-28, 30-27); title fights end with "and still" / "and new". */
function Decision({card, result, onContinue}: {card: FightCard; result: LiveResult; onContinue: () => void}) {
  const w = result.winner === 'you' ? card.you : result.winner === 'opp' ? card.opp : null;
  const l = w === card.you ? card.opp : card.you;
  const corner = result.winner === 'you' ? 'red' : 'blue';
  const scores = result.cards.map(([a, b]) => result.winner === 'opp' ? `${b}-${a}` : `${a}-${b}`).join(', ');
  const clock = result.time != null ? mmss(Math.round(result.time)) : '';
  const tko = result.how === 'Ground and pound' || result.how === 'Leg kicks' || result.how === 'Body shot' || result.how === 'Doctor stoppage';
  const lead = result.method === 'KO/TKO' ? `Referee stops the contest at ${clock} of round ${result.round}.`
    : result.method === 'SUB' ? `${l.name.split(' ').slice(-1)[0]} taps at ${clock} of round ${result.round}.`
    : `After ${result.round} rounds, we go to the judges' scorecards.`;
  const how = result.method === 'KO/TKO' ? `by ${tko ? 'TKO' : 'knockout'}${result.how ? ` (${result.how.toLowerCase()})` : ''}`
    : result.method === 'SUB' ? `by submission${result.how ? ` (${result.how.toLowerCase()})` : ''}`
    : result.method === 'SPLIT DEC' ? 'by split decision' : 'by unanimous decision';
  const titleCall = card.title && w ? (w.rank === 'C' ? 'AND STILL' : 'AND NEW') : null;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); onContinue(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onContinue]);
  return <div className={`lf-decision ${w ? corner : 'draw'}`} role="dialog" aria-label="Official decision">
    <div className="lf-dec-card">
      {card.title && <img className="lf-dec-belt" src="/art/belt.webp" alt={w ? 'The championship belt' : 'The belt stays where it is'} width={500} height={210}/>}
      <span className="lf-dec-lead">{lead}</span>
      {result.method !== 'KO/TKO' && result.method !== 'SUB' && <span className="lf-dec-scores">{card.title && <small>Championship scorecards</small>}{scores}</span>}
      {w ? <>
        <span className="lf-dec-for">{titleCall ? `${titleCall} ${card.title?.replace(/^VERSUS /, '').replace(/CHAMPIONSHIP$/, 'CHAMPION')}` : `For the winner, ${how}, fighting out of the ${corner} corner`}</span>
        <strong className="lf-dec-name">{w.nickname ? <small>&ldquo;{w.nickname}&rdquo;</small> : null}{w.name}</strong>
        {titleCall && <span className="lf-dec-for">{how}</span>}
      </> : <strong className="lf-dec-name">It&rsquo;s a draw</strong>}
      <button className="button primary lf-dec-go" onClick={onContinue}>Fight stats <kbd>Enter</kbd></button>
    </div>
  </div>;
}
/** The grappling guide: the position, your options, the read when he moves, and the submission bar chase */
function GrappleGuide({v, hud}: {v: GView; hud: React.MutableRefObject<Record<string, HTMLElement | null>>}) {
  const r = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };
  const role = v.role === 'top' ? 'On top' : v.role === 'bottom' ? 'Underneath' : v.role === 'clinch' ? 'Tied up' : 'Shot';
  if (v.sub) return <div className={`lf-grap sub ${v.sub.mine ? 'att' : 'def'}`} role="status">
    <header><b>{v.sub.name}</b><span>{v.sub.mine ? 'Chase his bar' : 'Get out!'}</span><em className="lf-gdir" ref={r('gdir')}/></header>
    <div className={`lf-track ${v.sub.choke ? 'loop' : ''}`} aria-hidden="true">
      {['', '2', '3'].map(k => <i key={'d' + k} className={`lf-bar ${v.sub!.mine ? 'his' : 'mine'}${k ? '' : ' tag'}`} ref={r('gd' + k)}/>)}
      {['', '2', '3'].map(k => <i key={'a' + k} className={`lf-bar ${v.sub!.mine ? 'mine' : 'his'}${k ? '' : ' tag'}`} ref={r('ga' + k)}/>)}
    </div>
    <div className="lf-gmeters"><span><b>Submit</b><u><i ref={r('glock')}/></u></span><span><b>Escape</b><u><i className="esc" ref={r('gesc')}/></u></span></div>
    <p>{v.sub.mine ? <><kbd>A</kbd><kbd>D</kbd> move your red bar (YOU) onto his blue one · <kbd>J</kbd> strike to widen it</> : <><kbd>A</kbd><kbd>D</kbd> keep your red bar (YOU) away from his blue one · follow the arrow · <kbd>J</kbd> fight his hands</>}{v.sub.choke ? ' · a choke goes all the way round' : ''}</p>
  </div>;
  if (v.read) return <div className="lf-grap read" role="status">
    <header><b>{v.read.label ? `He's going for: ${v.read.label}` : 'He\'s moving. Read it!'}</b><span>{v.pos}</span></header>
    <div className="lf-dirs">{v.read.dirs.map(d => <kbd key={d} className={`${v.read!.lit === d ? 'lit' : ''} ${v.read!.guessed === d ? 'picked' : ''}`}>{d}</kbd>)}</div>
    <p>{v.read.guessed ? 'Committed.' : 'Press the direction he\'s going to stop it. One guess.'}</p>
  </div>;
  return <div className="lf-grap" role="status">
    <header><b>{v.pos}</b><span>{role}</span></header>
    {v.mine ? <div className="lf-gmove"><span>{v.mine}…</span><u><i ref={r('gmove')}/></u></div> : <ul>
      {v.opts.map(o => <li key={o.dir + o.label}><kbd>Space</kbd>+<kbd>{o.dir}</kbd>{o.label}</li>)}
      {v.subs.length > 0 && <li><kbd>L</kbd>{v.subs.join(' / ')}</li>}
      {(v.role === 'top' || v.role === 'clinch') && <li><kbd>J</kbd><kbd>K</kbd>{v.role === 'clinch' ? 'Short shots' : 'Ground and pound'}{v.role === 'clinch' ? <> · <kbd>I</kbd>Knees</> : null}</li>}
      {v.role === 'bottom' && <li><kbd>Shift</kbd>Cover up</li>}
    </ul>}
  </div>;
}
