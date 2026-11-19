// VERSUS sound: every sound in the game is synthesised live with Web Audio, so there are no audio files to load.
// Impacts, the bell, a crowd that reacts to the fight, walkout music, menu clicks and story stingers.
import type {FightEvent} from '../../lib/fight3d/engine';

const KEY = 'versus-muted';
type Tone = 'win' | 'loss' | 'big' | 'quiet';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private crowdGain: GainNode | null = null; private crowdFilter: BiquadFilterNode | null = null; private crowdSrc: AudioBufferSourceNode | null = null;
  private crowdSize = 1; private crowdHype = 0;
  private music: ReturnType<typeof setInterval> | null = null; private musicAt = 0; private musicStep = 0; private musicGain: GainNode | null = null;
  private listeners = new Set<(m: boolean) => void>();
  muted = false;

  constructor() { try { this.muted = typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch { /* private window */ } }

  /** browsers only allow sound after the player has touched the page */
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext; if (!AC) return;
      const ctx = new AC(); this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(ctx.destination);
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : .85; this.master.connect(comp);
      const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }
  setMuted(m: boolean) {
    this.muted = m; try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* private window */ }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : .85, this.ctx.currentTime, .02);
    this.listeners.forEach(f => f(m));
  }
  toggle() { this.unlock(); this.setMuted(!this.muted); }
  subscribe(f: (m: boolean) => void) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }

  /* ---------------------------------------------------------- building blocks */
  private burst(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'lowpass', at = 0, sweepTo?: number) {
    const c = this.ctx; if (!c || !this.noise || !this.master) return;
    const t = c.currentTime + at, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    s.connect(f).connect(g).connect(this.musicGainFor(type)); s.start(t, Math.random() * 2, dur + .05);
  }
  private musicGainFor(_t: BiquadFilterType) { return this.master!; }
  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', at = 0, to?: number, out?: AudioNode) {
    const c = this.ctx; if (!c || !this.master) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g).connect(out ?? this.master); o.start(t); o.stop(t + dur + .05);
  }

  /* ------------------------------------------------------------- the fight */
  punch(power: number, target?: string) {
    const p = Math.min(1.6, Math.max(.2, power)), body = target === 'body', legs = target === 'legs';
    this.tone(body ? 95 : legs ? 130 : 150, .1 + p * .08, .45 + p * .35, 'sine', 0, body ? 42 : 55);        // the weight of it
    this.burst(.05 + p * .05, body ? 700 : legs ? 1700 : 2600, .7, .32 + p * .3);                              // the slap of glove on skin
    if (p > .8) this.burst(.2, 240, 1, .4 * p);
  }
  private block() { this.burst(.06, 900, 1.2, .24); this.tone(190, .05, .16, 'triangle'); }
  private whiff() { this.burst(.14, 700, 1.1, .1, 'bandpass', 0, 1900); }
  private boom(v = 1) { this.tone(78, .75, .95 * v, 'sine', 0, 26); this.burst(.5, 320, .8, .55 * v); this.burst(.09, 3200, .6, .4 * v); }
  private thud() { this.tone(70, .3, .75, 'sine', 0, 32); this.burst(.22, 420, .8, .4); }
  bell(times = 1) { for (let n = 0; n < times; n++) for (const [f, v] of [[830, .34], [1245, .2], [2090, .13], [3120, .07]]) this.tone(f, 1.25, v, 'sine', n * .34); }
  private tick() { this.tone(1300, .03, .1, 'square'); }

  /** everything that happened in this step of the fight */
  events(evts: FightEvent[]) {
    if (!this.ctx) return;
    for (const e of evts) {
      if (e.type === 'hit') { this.punch(e.power, e.target); this.cheer(Math.min(.24, e.power * .2)); }
      else if (e.type === 'block') this.block();
      else if (e.type === 'whiff') this.whiff();
      else if (e.type === 'kd') { this.boom(.9); this.cheer(1); }
      else if (e.type === 'ko') { this.boom(1.2); this.cheer(1.6); }
      else if (e.type === 'hurt') { this.boom(.55); this.cheer(.7); }
      else if (e.type === 'td') { this.thud(); this.cheer(.4); }
      else if (e.type === 'sprawl') { this.thud(); this.cheer(.3); }
      else if (e.type === 'tap') { this.tick(); this.tone(120, .2, .5); this.cheer(1.6); }
      else if (e.type === 'sub') this.cheer(.55);
      else if (e.type === 'escape') this.cheer(.35);
      else if (e.type === 'bell') this.bell(e.text?.startsWith('End') ? 2 : 1);
    }
  }

  /* ------------------------------------------------------------- the crowd */
  /** size: 0 a basement, 1 a mid-size arena, 2 the big show */
  crowdOn(venue: number) {
    const c = this.ctx; if (!c || !this.noise || !this.master || this.crowdSrc) return;
    this.crowdSize = [.42, .72, 1][venue] ?? 1;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const low = c.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 1100;
    const band = c.createBiquadFilter(); band.type = 'peaking'; band.frequency.value = 620; band.Q.value = .7; band.gain.value = 8;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(low).connect(band).connect(g).connect(this.master); s.start();
    this.crowdSrc = s; this.crowdGain = g; this.crowdFilter = low; this.crowdHype = .2; this.applyCrowd(1.2);
  }
  private cheer(amount: number) { this.crowdHype = Math.min(1.8, this.crowdHype + amount); this.applyCrowd(.06); }
  /** called every frame: the noise of the building settles back down after each moment */
  crowdTick(dt: number) { if (!this.crowdGain) return; this.crowdHype = Math.max(.2, this.crowdHype - dt * .42); this.applyCrowd(.35); }
  private applyCrowd(tc: number) {
    const c = this.ctx; if (!c || !this.crowdGain || !this.crowdFilter) return;
    this.crowdGain.gain.setTargetAtTime((.05 + this.crowdHype * .13) * this.crowdSize, c.currentTime, tc);
    this.crowdFilter.frequency.setTargetAtTime(850 + this.crowdHype * 1500, c.currentTime, tc);
  }
  crowdOff() {
    const c = this.ctx; if (!c || !this.crowdSrc || !this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(0, c.currentTime, .25); const s = this.crowdSrc; this.crowdSrc = null; this.crowdGain = null; this.crowdFilter = null;
    try { s.stop(c.currentTime + 1.2); } catch { /* already stopped */ }
  }

  /* ----------------------------------------------------------- walkout music */
  walkoutOn() {
    const c = this.ctx; if (!c || !this.master || this.music) return;
    this.musicGain = c.createGain(); this.musicGain.gain.value = .0001; this.musicGain.gain.exponentialRampToValueAtTime(.7, c.currentTime + 1.4); this.musicGain.connect(this.master);
    this.musicAt = c.currentTime + .08; this.musicStep = 0;
    const beat = 60 / 132 / 2, bass = [55, 55, 55, 65.4, 55, 55, 49, 49, 55, 55, 55, 65.4, 73.4, 73.4, 65.4, 49];
    const out = this.musicGain;
    this.music = setInterval(() => {
      while (this.musicAt < c.currentTime + .25) {
        const i = this.musicStep % 16, at = this.musicAt - c.currentTime;
        if (i % 4 === 0) this.tone(120, .24, .85, 'sine', at, 40, out);
        if (i === 4 || i === 12) { this.tone(190, .1, .3, 'triangle', at, 110, out); }
        if (i % 2 === 1) this.tone(7200, .025, .06, 'square', at, undefined, out);
        this.tone(bass[i], beat * .9, .34, 'sawtooth', at, undefined, out);
        if (this.musicStep % 32 >= 16 && i % 4 === 2) this.tone(bass[i] * 4, beat * 1.4, .1, 'square', at, undefined, out);
        this.musicAt += beat; this.musicStep++;
      }
    }, 60);
  }
  walkoutOff() {
    if (this.music) clearInterval(this.music); this.music = null;
    const c = this.ctx, g = this.musicGain; if (c && g) { g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(.0001, c.currentTime, .3); setTimeout(() => g.disconnect(), 1800); } this.musicGain = null;
  }
  stopFight() { this.walkoutOff(); this.crowdOff(); }

  /* ------------------------------------------------------------ menus and story */
  click() { if (this.ctx) this.tone(620, .05, .1, 'triangle', 0, 420); }
  ping() { if (!this.ctx) return; this.tone(880, .12, .16); this.tone(1320, .2, .14, 'sine', .09); }
  drill(good: number) { if (!this.ctx) return; if (good > .35) { this.punch(.35 + good * .5, 'head'); if (good > .8) this.tone(1500, .1, .1, 'sine', .03); } else this.tone(130, .14, .2, 'sawtooth'); }
  fanfare(win: boolean) {
    if (!this.ctx) return;
    (win ? [261.6, 329.6, 392, 523.3] : [220, 196, 174.6]).forEach((f, i) => { this.tone(f, win ? .55 : .8, .24, 'sawtooth', i * .16); this.tone(f * 2, .4, .08, 'triangle', i * .16); });
  }
  sting(tone: Tone) {
    if (!this.ctx) return;
    if (tone === 'big') { this.boom(.6); [130.8, 196, 261.6].forEach((f, i) => this.tone(f, 1.6, .17, 'sawtooth', .06 * i)); }
    else if (tone === 'win') [392, 523.3].forEach((f, i) => this.tone(f, .7, .15, 'triangle', i * .12));
    else if (tone === 'loss') { this.tone(110, 1.5, .34, 'sine', 0, 72); this.tone(164.8, 1.5, .1, 'triangle'); }
    else this.tone(293.7, 1, .12, 'triangle');
  }
}
export const sfx = new Sfx();
