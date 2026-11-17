// VERSUS live fights: the stadium comes alive. The Blender build (scripts/art/build_stadium.py) supplies
// the building and the seat map; this brings the night: ~9k instanced fans who bounce and erupt,
// phone lights and camera flashes, a live feed and a scoreboard on the centre-hung board, scrolling
// LED ribbons, sweeping beams, and glowing trim.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {LiveFight} from '../../lib/fight3d/engine';

const SPONSORS = ['VERSUS', 'UNSEEN INTERACTIVE', 'RIPTIDE ENERGY', 'APEX GLOVES', 'IRONCLAD NUTRITION', 'HALO APPAREL', 'NIGHT SHIFT', 'VX FIGHT PASS'];
const SHIRTS = ['#1c2541', '#2b2d42', '#3a0ca3', '#0b132b', '#3d405b', '#5c1a1a', '#d9d9d9', '#264653', '#1d3557', '#111111', '#6b2737', '#2f3e46', '#e9c46a', '#8d99ae'];

/** a seated fan: body, head, two arms (part attribute: 0 body, 1 left arm, 2 right arm, 3 head) */
function fanGeometry() {
  const tag = (g0: THREE.BufferGeometry, part: number) => { const g = g0.index ? g0.toNonIndexed() : g0; g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(part), 1)); return g; };
  const body = tag(new THREE.BoxGeometry(.42, .52, .26).translate(0, .5, 0), 0);
  const armL = tag(new THREE.BoxGeometry(.1, .42, .1).translate(-.27, .52, 0), 1);
  const armR = tag(new THREE.BoxGeometry(.1, .42, .1).translate(.27, .52, 0), 2);
  const head = tag(new THREE.IcosahedronGeometry(.12, 1).translate(0, .88, 0), 3);
  for (const g of [body, armL, armR, head]) { g.deleteAttribute('uv'); }
  return mergeGeometries([body, armL, armR, head])!;
}

function canvasTex(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  // glTF UVs run top-down, so canvas textures go on unflipped
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false;
  return {c, ctx: c.getContext('2d')!, t};
}

export class Stadium {
  crowd: THREE.InstancedMesh | null = null;
  private uniforms = {uTime: {value: 0}, uHype: {value: .25}};
  private flashes: THREE.Points | null = null;
  private flashU = {uTime: {value: 0}, uRate: {value: .2}, uScale: {value: 1}};
  private beams: {mesh: THREE.Mesh; a: number; speed: number; tilt: number}[] = [];
  private ribbon = canvasTex(2048, 128); private ledFloor = canvasTex(2048, 128);
  private score = canvasTex(1024, 576); private monitor = canvasTex(256, 160);
  private ribbonTex: THREE.Texture[] = [];
  private glow: THREE.Material[] = [];
  private live: THREE.WebGLRenderTarget | null = null; liveCam = new THREE.PerspectiveCamera(30, 16 / 9, .1, 80);
  private liveMat: THREE.MeshBasicMaterial | null = null; private liveMeshes: THREE.Mesh[] = [];
  private hype = .25; private frame = 0; private scoreT = 0; private shotT = 0; private shot = 0;
  excitement = 0;

  constructor(private scene: THREE.Scene, arena: THREE.Object3D, seats: number[] | null, private names: [string, string], lowSpec: boolean) {
    this.paintRibbon(this.ribbon, '#ffffff', '#0b0d14', 72); this.paintRibbon(this.ledFloor, '#e9f0ff', '#0a1430', 80);
    this.paintMonitor();
    this.live = lowSpec ? null : new THREE.WebGLRenderTarget(512, 288, {colorSpace: THREE.SRGBColorSpace});
    if (this.live) { this.live.texture.repeat.set(-1, -1); this.live.texture.offset.set(1, 1); }   // render targets are bottom-up
    // swap the named Blender materials for live ones
    arena.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const name = (m.material as THREE.Material).name;
      if (name === 'ribbon' || name === 'led_floor') {
        const src = name === 'ribbon' ? this.ribbon.t : this.ledFloor.t;
        const t = src.clone(); t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; this.ribbonTex.push(t);
        m.material = new THREE.MeshBasicMaterial({map: t, toneMapped: false});
      } else if (name === 'screen_live') {
        this.liveMeshes.push(m);
        this.liveMat ??= new THREE.MeshBasicMaterial({map: this.live?.texture ?? this.score.t, toneMapped: false});
        m.material = this.liveMat;
      } else if (name === 'screen_score') m.material = new THREE.MeshBasicMaterial({map: this.score.t, toneMapped: false});
      else if (name === 'monitor') m.material = new THREE.MeshBasicMaterial({map: this.monitor.t, toneMapped: false});
      else if (name === 'apron_led') m.material = new THREE.MeshBasicMaterial({vertexColors: true, toneMapped: false, color: new THREE.Color(.85, .85, .85)});
      else if (/^(lamp|lamp_blue|board_halo|tunnel_led|suite)$/.test(name)) { const mm = m.material as THREE.MeshStandardMaterial; mm.toneMapped = false; if (name === 'tunnel_led') mm.emissiveIntensity *= .35; if (name === 'board_halo') mm.emissiveIntensity *= .4; this.glow.push(mm); }
    });
    if (seats) this.buildCrowd(seats, lowSpec);
    this.buildBeams(lowSpec ? 4 : 8);
    this.paintScore(null);
  }

  private paintRibbon({c, ctx, t}: ReturnType<typeof canvasTex>, fg: string, bg: string, size: number) {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = `900 ${size}px system-ui, sans-serif`; ctx.textBaseline = 'middle'; ctx.fillStyle = fg;
    let x = 30; let i = 0;
    while (x < c.width) {
      const s = SPONSORS[i++ % SPONSORS.length];
      ctx.fillStyle = s === 'VERSUS' ? '#c6f04d' : fg; ctx.fillText(s, x, c.height / 2 + 4);
      x += ctx.measureText(s).width + 70;
      ctx.fillStyle = '#ff3a55'; ctx.beginPath(); ctx.arc(x - 35, c.height / 2, 9, 0, Math.PI * 2); ctx.fill();
    }
    t.needsUpdate = true;
  }
  private paintMonitor() {
    const {c, ctx, t} = this.monitor;
    ctx.fillStyle = '#071330'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#c6f04d'; ctx.font = '900 34px system-ui'; ctx.fillText('VERSUS', 18, 52);
    ctx.fillStyle = '#9fb4ff'; ctx.font = '700 18px system-ui';
    ['STRIKES', 'TAKEDOWNS', 'CONTROL'].forEach((s, i) => { ctx.fillText(s, 18, 90 + i * 24); ctx.fillRect(140, 78 + i * 24, 60 + i * 20, 10); });
    t.needsUpdate = true;
  }
  /** scoreboard face: names, round, clock, health */
  private paintScore(g: LiveFight | null) {
    const {c, ctx, t} = this.score;
    const grd = ctx.createLinearGradient(0, 0, c.width, 0); grd.addColorStop(0, '#3a0710'); grd.addColorStop(.5, '#05070d'); grd.addColorStop(1, '#071a44');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, c.width, c.height);
    ctx.textAlign = 'center'; ctx.fillStyle = '#c6f04d'; ctx.font = '900 92px system-ui'; ctx.fillText('VERSUS', c.width / 2, 120);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 30px system-ui'; ctx.fillText('UNSEEN INTERACTIVE PRESENTS', c.width / 2, 170);
    const last = (n: string) => n.split(' ').slice(-1)[0].toUpperCase();
    ctx.font = '900 66px system-ui';
    ctx.fillStyle = '#ff4d63'; ctx.fillText(last(this.names[0]), c.width * .25, 290);
    ctx.fillStyle = '#5b8cff'; ctx.fillText(last(this.names[1]), c.width * .75, 290);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 44px system-ui'; ctx.fillText('VS', c.width / 2, 285);
    if (g) {
      g.f.forEach((f, i) => {
        const x0 = i ? c.width * .55 : c.width * .05, w = c.width * .4;
        ctx.fillStyle = '#ffffff22'; ctx.fillRect(x0, 330, w, 26);
        ctx.fillStyle = i ? '#5b8cff' : '#ff4d63'; ctx.fillRect(i ? x0 + w * (1 - Math.max(0, f.hp) / 100) : x0, 330, w * Math.max(0, f.hp) / 100, 26);
      });
      const s = Math.max(0, Math.ceil(g.clock));
      ctx.fillStyle = '#ffffff'; ctx.font = '900 110px system-ui';
      ctx.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, c.width / 2, 480);
      ctx.font = '800 40px system-ui'; ctx.fillStyle = '#ffd27a'; ctx.fillText(g.phase === 'break' ? 'BETWEEN ROUNDS' : `ROUND ${g.round} OF ${g.rounds}`, c.width / 2, 540);
    }
    t.needsUpdate = true;
  }

  private buildCrowd(seats: number[], lowSpec: boolean) {
    const stride = 5, total = seats.length / stride;
    const step = lowSpec ? 2 : 1, n = Math.floor(total / step);
    const geo = fanGeometry();
    const mat = new THREE.MeshLambertMaterial({color: '#ffffff'});
    const u = this.uniforms;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uHype; attribute float aPart; attribute vec2 aSeed;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          // each fan has his own rhythm; hype makes them bounce harder and throw their arms up
          float cheer = clamp(uHype * (0.55 + aSeed.y), 0.0, 1.4);
          float beat = abs(sin(uTime * (2.6 + aSeed.y * 2.0) + aSeed.x * 6.283));
          float stand = smoothstep(0.55, 1.0, cheer) * 0.35;
          if (aPart > 0.5 && aPart < 2.5) {
            float side = aPart < 1.5 ? -1.0 : 1.0;
            float ang = side * cheer * (2.2 + 0.5 * beat);
            vec2 o = vec2(transformed.x - side * 0.27, transformed.y - 0.72);
            transformed.x = side * 0.27 + o.x * cos(ang) - o.y * sin(ang);
            transformed.y = 0.72 + o.x * sin(ang) + o.y * cos(ang);
          }
          transformed.y += stand + beat * (0.02 + 0.09 * cheer);`);
    };
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const seed = new Float32Array(n * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const heads: number[] = [], phases: number[] = [];
    for (let i = 0, k = 0; i < total && k < n; i += step, k++) {
      const x = seats[i * stride], y = seats[i * stride + 1], z = seats[i * stride + 2], yaw = seats[i * stride + 3];
      p.set(x, y + .05, z); q.setFromAxisAngle(up, yaw + (Math.random() - .5) * .3);
      const sc = .92 + Math.random() * .16; s.set(sc, sc, sc);
      m4.compose(p, q, s); mesh.setMatrixAt(k, m4);
      // shirts, darkened for a dark house, tinted by the side of the bowl like coloured house lights
      col.set(SHIRTS[Math.floor(Math.random() * SHIRTS.length)]).multiplyScalar(.32);
      const side = x / (Math.hypot(x, z) || 1);
      col.lerp(side > 0 ? new THREE.Color('#8a1420') : new THREE.Color('#14307a'), .15 + Math.abs(side) * .2);
      mesh.setColorAt(k, col);
      seed[k * 2] = Math.random(); seed[k * 2 + 1] = Math.random();
      heads.push(x, y + .95, z); phases.push(Math.random());
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 2));
    mesh.frustumCulled = false; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh); this.crowd = mesh;
    // phone lights + camera flashes from the stands
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(heads, 3));
    pg.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    const pm = new THREE.ShaderMaterial({
      uniforms: this.flashU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime; uniform float uRate; uniform float uScale; attribute float aPhase; varying float vA;
        float h(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float slot = floor(uTime * 12.0 + aPhase * 97.0);
          float flash = step(1.0 - uRate * 0.02, h(slot + aPhase * 311.0));        // camera flash
          float phone = step(0.93, aPhase) * (0.35 + 0.15 * sin(uTime * 2.0 + aPhase * 40.0)); // steady phone screens
          vA = max(flash, phone);
          gl_PointSize = (flash > 0.5 ? 22.0 : 7.0) * uScale * (12.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (vA < 0.01 || d > 0.25) discard;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.9), vA * smoothstep(0.25, 0.0, d)); }`,
    });
    this.flashes = new THREE.Points(pg, pm); this.flashes.frustumCulled = false; this.scene.add(this.flashes);
  }

  /** big volumetric beams from the roof that sweep the stands and the cage */
  private buildBeams(n: number) {
    for (let i = 0; i < n; i++) {
      const len = 34;
      const geo = new THREE.ConeGeometry(2.2, len, 24, 1, true).translate(0, -len / 2, 0);
      const mat = new THREE.MeshBasicMaterial({color: i % 3 === 0 ? '#6fb4ff' : i % 3 === 1 ? '#ffffff' : '#c6f04d', transparent: true, opacity: .035, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide});
      const mesh = new THREE.Mesh(geo, mat);
      const a = i / n * Math.PI * 2;
      mesh.position.set(Math.cos(a) * 16, 30, Math.sin(a) * 14);
      this.scene.add(mesh); this.beams.push({mesh, a, speed: .15 + Math.random() * .2, tilt: .5 + Math.random() * .35});
    }
  }

  /** a landed strike / knockdown / takedown: the building reacts */
  excite(power: number) { this.excitement = Math.min(1.6, this.excitement + power); }

  update(dt: number, g: LiveFight, renderer: THREE.WebGLRenderer, view: {intro: number}) {
    const t = (this.uniforms.uTime.value += dt);
    this.flashU.uTime.value = t;
    this.excitement = Math.max(0, this.excitement - dt * .35);
    const target = .22 + this.excitement * .7 + (g.phase === 'intro' ? .55 : 0) + (g.phase === 'over' ? .9 : 0) + (g.clock < 10 && g.phase === 'fight' ? .25 : 0);
    this.hype += (target - this.hype) * Math.min(1, dt * 3);
    this.uniforms.uHype.value = this.hype;
    this.flashU.uRate.value = .15 + this.hype * 1.3;
    for (const tx of this.ribbonTex) tx.offset.x = (tx.offset.x + dt * .045) % 1;
    const pulse = 1 + .35 * Math.sin(t * 3) * this.hype;
    for (const m of this.glow) { const mm = m as THREE.MeshStandardMaterial; if (mm.emissiveIntensity !== undefined) mm.emissiveIntensity = (mm.userData.base ??= mm.emissiveIntensity) * pulse; }
    // beams sweep slowly; faster and wilder during the walkout and when it goes off
    const wild = Math.max(view.intro, Math.min(1, this.excitement));
    for (const b of this.beams) {
      b.a += dt * b.speed * (1 + wild * 3);
      const tgt = new THREE.Vector3(Math.cos(b.a) * (8 + 14 * (1 - wild * .5)), 0, Math.sin(b.a * 1.3) * (8 + 10 * (1 - wild * .5)));
      b.mesh.lookAt(tgt); b.mesh.rotateX(-Math.PI / 2);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = .018 + .022 * wild;
    }
    // scoreboard redraw ~4x a second
    if ((this.scoreT -= dt) <= 0) { this.scoreT = .25; this.paintScore(g); }
    // live feed: a tight broadcast angle on the action, switching cameras every few seconds
    if (this.live && (this.frame++ % 2 === 0)) {
      if ((this.shotT -= dt * 2) <= 0) { this.shotT = 3 + Math.random() * 3; this.shot = (this.shot + 1) % 3; }
      const ax = g.f[0].x * .82, az = g.f[0].z * .82, bx = g.f[1].x * .82, bz = g.f[1].z * .82;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const ang = Math.atan2(bz - az, bx - ax) + Math.PI / 2 + [0, .7, -.9][this.shot];
      const dist = [2.6, 3.4, 2.2][this.shot], hgt = [1.6, 2.4, 1.2][this.shot];
      this.liveCam.position.set(mx + Math.cos(ang) * dist, .9 + hgt, mz + Math.sin(ang) * dist);
      this.liveCam.lookAt(mx, .9 + 1.15, mz);
      const prevFog = this.scene.fog; this.scene.fog = null;
      for (const m of this.liveMeshes) m.visible = false;   // never sample the target we're drawing into
      renderer.setRenderTarget(this.live); renderer.render(this.scene, this.liveCam); renderer.setRenderTarget(null);
      for (const m of this.liveMeshes) m.visible = true;
      this.scene.fog = prevFog;
    }
  }

  degrade() {
    if (this.crowd) this.crowd.count = Math.floor(this.crowd.count / 2);
    if (this.live) { this.live.dispose(); this.live = null; if (this.liveMat) { this.liveMat.map = this.score.t; this.liveMat.needsUpdate = true; } }
    for (const b of this.beams.slice(4)) b.mesh.visible = false;
  }
  dispose() { this.live?.dispose(); for (const x of [this.ribbon, this.ledFloor, this.score, this.monitor]) x.t.dispose(); for (const t of this.ribbonTex) t.dispose(); }
}
