// Live 3D preview of a fighter's look (character customisation): the real game body with its kit
// colours, tattoos and gear, idling in his stance under studio lights. Drag to turn him around.
import * as THREE from 'three';
import {FighterRig, loadDress, loadGlb} from './fight-view';
import type {Look} from '../../lib/cosmetics';

export class LookPreview {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(26, 1, .1, 50);
  rig: FighterRig | null = null; private raf = 0; private last = performance.now(); private yaw = .35; private spin = 0; private drag: number | null = null;
  private token = 0; private disposed = false; focus: 'body' | 'upper' = 'body';
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#c9d6ff', '#1a1420', .7));
    const key = new THREE.DirectionalLight('#fff3e6', 2.4); key.position.set(1.5, 3, 3); s.add(key);
    const rimR = new THREE.DirectionalLight('#ff3a55', 2.2); rimR.position.set(-3, 2, -2); s.add(rimR);
    const rimB = new THREE.DirectionalLight('#3a6bff', 2.2); rimB.position.set(3, 2, -2); s.add(rimB);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(.75, 48), new THREE.MeshBasicMaterial({color: '#000', transparent: true, opacity: .35}));
    floor.rotation.x = -Math.PI / 2; s.add(floor);
    canvas.addEventListener('pointerdown', this.down); window.addEventListener('pointermove', this.move); window.addEventListener('pointerup', this.up);
    this.resize(); this.raf = requestAnimationFrame(this.loop);
  }
  private down = (e: PointerEvent) => { this.drag = e.clientX; this.spin = 0; };
  private move = (e: PointerEvent) => { if (this.drag == null) return; this.yaw += (e.clientX - this.drag) * .012; this.drag = e.clientX; };
  private up = () => { this.drag = null; };
  resize() { const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 400; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  async show(look: Look) {
    const my = ++this.token;
    const [g, dress] = await Promise.all([loadGlb(`/models/fighter-${look.model}.glb`, () => {}), loadDress(look)]);
    if (my !== this.token || this.disposed) return;
    const rig = new FighterRig({scene: (g as any).scene, clips: (g as any).animations}, look, dress);
    if (this.rig) this.scene.remove(this.rig.root);
    this.rig = rig; this.scene.add(rig.root);
  }
  private loop = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    if (this.drag == null) this.yaw += dt * .25;
    if (this.rig) { this.rig.root.rotation.y = this.yaw; this.rig.mixer.update(dt); }
    const up = this.focus === 'upper';
    this.camera.position.set(0, up ? 1.32 : 1.0, up ? 2.9 : 4.4); this.camera.lookAt(0, up ? 1.22 : .92, 0);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.down); window.removeEventListener('pointermove', this.move); window.removeEventListener('pointerup', this.up);
    this.renderer.dispose();
  }
}
