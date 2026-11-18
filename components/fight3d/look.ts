// Dress a fighter body in three.js from a Look: kit colours, tattoos (ink masks baked in Blender into
// the shared skin UV layout, multiplied onto this body's own skin texture) and gear (meshes skinned to the
// same skeleton, re-bound to this body's bones so they move with every animation).
import * as THREE from 'three';
import type {GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {Look} from '../../lib/cosmetics';

type Manifest = {size: number; tattoos: Record<string, {x: number; y: number; w: number; h: number}>};
let manifest: Promise<Manifest | null> | null = null;
const masks = new Map<string, Promise<HTMLImageElement | null>>();
const img = (src: string) => new Promise<HTMLImageElement | null>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

/** fetch everything a look needs (call before building the rig) */
export async function loadLookAssets(look: Look | undefined) {
  if (!look?.tattoos.length) return {manifest: null, masks: new Map<string, HTMLImageElement>()};
  manifest ??= fetch('/cosmetics/tattoos.json').then(r => r.ok ? r.json() as Promise<Manifest> : null).catch(() => null);
  const m = await manifest;
  const out = new Map<string, HTMLImageElement>();
  await Promise.all(look.tattoos.map(async id => {
    if (!m?.tattoos[id]) return;
    let p = masks.get(id); if (!p) { p = img(`/cosmetics/tattoos/${id}.png`); masks.set(id, p); }
    const i = await p; if (i) out.set(id, i);
  }));
  return {manifest: m, masks: out};
}
export type LookAssets = Awaited<ReturnType<typeof loadLookAssets>> & {gear?: GLTF | null};

const INK = '#23262e';
/** paint the tattoos onto a copy of the body's skin texture (2048 canvas, the size the masks were baked at) */
function inkSkin(mat: THREE.MeshStandardMaterial, a: LookAssets, ids: string[]) {
  const src = mat.map?.image as CanvasImageSource | undefined; if (!src || !a.manifest) return;
  const S = a.manifest.size, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!; ctx.drawImage(src, 0, 0, S, S);
  for (const id of ids) {
    const r = a.manifest.tattoos[id], m = a.masks.get(id); if (!r || !m) continue;
    const t = document.createElement('canvas'); t.width = r.w; t.height = r.h;
    const tc = t.getContext('2d')!; tc.drawImage(m, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = INK; tc.fillRect(0, 0, r.w, r.h);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .92; ctx.drawImage(t, r.x, r.y);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  const old = mat.map!;
  tex.flipY = old.flipY; tex.colorSpace = old.colorSpace; tex.wrapS = old.wrapS; tex.wrapT = old.wrapT; tex.anisotropy = 4;
  mat.map = tex; mat.needsUpdate = true;
}

/** apply a look to a cloned fighter body; returns the walkout-only gear meshes (hidden once the fight starts) */
export function applyLook(body: THREE.Object3D, look: Look | undefined, a: LookAssets | undefined): THREE.Object3D[] {
  if (!look) return [];
  const bones = new Map<string, THREE.Bone>();
  let skinParent: THREE.Object3D | null = null, skinMesh: THREE.SkinnedMesh | null = null;
  body.traverse(o => {
    if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      if (mat.name === 'shorts' && look.shorts) mat.color.set(look.shorts);
      else if (mat.name === 'shorts_trim' && look.trim) mat.color.set(look.trim);
      else if (/^glove/.test(mat.name) && look.gloves) mat.color.set(look.gloves);
      else if (mat.name === 'Human.body') { skinMesh = m as THREE.SkinnedMesh; skinParent = m.parent; if (look.tattoos.length && a) inkSkin(mat, a, look.tattoos); }
    }
  });
  const walkout: THREE.Object3D[] = [];
  if (!a?.gear || !skinParent || !look.gear.length) return walkout;
  const parent = skinParent as THREE.Object3D, ref = skinMesh as THREE.SkinnedMesh | null;
  a.gear.scene.traverse(o => {
    const sm = o as THREE.SkinnedMesh; if (!sm.isSkinnedMesh) return;
    const id = sm.name.replace(/^gear_/, '').split('_')[0];
    if (!look.gear.includes(id)) return;
    const copy = new THREE.SkinnedMesh(sm.geometry, (sm.material as THREE.Material).clone());
    copy.name = sm.name; copy.castShadow = true; copy.receiveShadow = true; copy.frustumCulled = false;
    copy.position.copy(sm.position); copy.quaternion.copy(sm.quaternion); copy.scale.copy(sm.scale);
    const sk = new THREE.Skeleton(sm.skeleton.bones.map(b => bones.get(b.name) ?? b), sm.skeleton.boneInverses);
    parent.add(copy);
    copy.bind(sk, sm.bindMatrix.clone()); void ref;
    if (id === 'chain' || id === 'band') walkout.push(copy);
  });
  return walkout;
}
