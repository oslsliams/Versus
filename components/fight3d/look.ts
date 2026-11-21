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
  const ids = [...(look?.paint ?? []).map(p => p.id), ...(look?.tattoos ?? [])];
  if (!ids.length) return {manifest: null, masks: new Map<string, HTMLImageElement>()};
  manifest ??= fetch('/cosmetics/tattoos.json').then(r => r.ok ? r.json() as Promise<Manifest> : null).catch(() => null);
  const m = await manifest;
  const out = new Map<string, HTMLImageElement>();
  await Promise.all(ids.map(async id => {
    if (!m?.tattoos[id]) return;
    let p = masks.get(id); if (!p) { p = img(`/cosmetics/tattoos/${id}.png`); masks.set(id, p); }
    const i = await p; if (i) out.set(id, i);
  }));
  return {manifest: m, masks: out};
}
export type LookAssets = Awaited<ReturnType<typeof loadLookAssets>> & {gear?: GLTF | null};

const INK = '#23262e';
/** paint the tattoos onto a copy of the body's skin texture (2048 canvas, the size the masks were baked at) */
function inkSkin(mat: THREE.MeshStandardMaterial, a: LookAssets, ids: string[], paint: {id: string; color: string}[] = []) {
  const src = mat.map?.image as CanvasImageSource | undefined; if (!src || !a.manifest) return;
  const S = a.manifest.size, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!; ctx.drawImage(src, 0, 0, S, S);
  // solid layers (clothing): the colour replaces the skin; the 3D lighting still gives the cloth its shape
  for (const p of paint) {
    const r = a.manifest.tattoos[p.id], m = a.masks.get(p.id); if (!r || !m) continue;
    const t = document.createElement('canvas'); t.width = r.w; t.height = r.h;
    const tc = t.getContext('2d')!; tc.drawImage(m, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = p.color; tc.fillRect(0, 0, r.w, r.h);
    ctx.drawImage(t, r.x, r.y);
  }
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

/** Fix for the fighter models: a few body triangles inside the shorts kept the skin material (a bare patch at
 *  the crotch). Three.js loads each material as its own mesh, so instead of moving triangles we paint those
 *  triangles' patch of the skin texture in the shorts colour. The triangle list is cached per geometry. */
function shortsGap(skin: THREE.Mesh, shorts: THREE.Mesh): number[] {
  const g = skin.geometry; if (g.userData.shortsGap) return g.userData.shortsGap;
  const sp = shorts.geometry.attributes.position, pos = g.attributes.position, uv = g.attributes.uv, idx = g.index;
  const out: number[] = []; g.userData.shortsGap = out;
  if (!sp || !pos || !uv || !idx) return out;
  let y0 = Infinity, y1 = -Infinity, cx = 0, cz = 0;
  for (let i = 0; i < sp.count; i++) { const y = sp.getY(i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); cx += sp.getX(i); cz += sp.getZ(i); }
  cx /= sp.count; cz /= sp.count;
  let rad = 0; for (let i = 0; i < sp.count; i++) rad = Math.max(rad, Math.hypot(sp.getX(i) - cx, sp.getZ(i) - cz));
  const a = idx.array;
  for (let i = 0; i < a.length; i += 3) {
    const v = [a[i], a[i + 1], a[i + 2]];
    const y = (pos.getY(v[0]) + pos.getY(v[1]) + pos.getY(v[2])) / 3, x = (pos.getX(v[0]) + pos.getX(v[1]) + pos.getX(v[2])) / 3, z = (pos.getZ(v[0]) + pos.getZ(v[1]) + pos.getZ(v[2])) / 3;
    if (y > y0 + (y1 - y0) * .12 && y < y1 - (y1 - y0) * .06 && Math.hypot(x - cx, z - cz) < rad * .97) for (const k of v) out.push(uv.getX(k), uv.getY(k));
  }
  return out;
}
function fillShortsGap(mat: THREE.MeshStandardMaterial, tris: number[], color: THREE.Color) {
  if (!tris.length || !mat.map?.image) return;
  let cv = (mat.map as THREE.CanvasTexture).image as HTMLCanvasElement;
  const fresh = !(cv instanceof HTMLCanvasElement);
  if (fresh) { const src = mat.map.image as CanvasImageSource; cv = document.createElement('canvas'); cv.width = cv.height = 2048; cv.getContext('2d')!.drawImage(src, 0, 0, 2048, 2048); }
  const ctx = cv.getContext('2d')!, S = cv.width;
  ctx.fillStyle = ctx.strokeStyle = '#' + color.getHexString(); ctx.lineWidth = 3; ctx.lineJoin = 'round';
  for (let i = 0; i < tris.length; i += 6) {
    ctx.beginPath(); ctx.moveTo(tris[i] * S, tris[i + 1] * S); ctx.lineTo(tris[i + 2] * S, tris[i + 3] * S); ctx.lineTo(tris[i + 4] * S, tris[i + 5] * S); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (fresh) { const old = mat.map, tex = new THREE.CanvasTexture(cv); tex.flipY = old.flipY; tex.colorSpace = old.colorSpace; tex.wrapS = old.wrapS; tex.wrapT = old.wrapT; tex.anisotropy = 4; mat.map = tex; mat.needsUpdate = true; }
  else mat.map.needsUpdate = true;
}
export function patchShorts(body: THREE.Object3D) {
  let skin: THREE.Mesh | null = null, shorts: THREE.Mesh | null = null;
  body.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const name = (m.material as THREE.Material).name; if (name === 'Human.body') skin = m; else if (name === 'shorts') shorts = m; });
  if (!skin || !shorts) return;
  const sk = skin as THREE.Mesh, sh = shorts as THREE.Mesh;
  fillShortsGap(sk.material as THREE.MeshStandardMaterial, shortsGap(sk, sh), (sh.material as THREE.MeshStandardMaterial).color);
}
/** customizable bodies ship every part: show only the chosen hairstyle, tattoos and shorts (defaults when none chosen) */
export function applyParts(body: THREE.Object3D, parts: Look['parts']) {
  const hair = parts?.hair ?? '01', shorts = parts?.shorts ?? 'twin_serpent', ink = new Set(parts?.ink ?? []);
  body.traverse(o => {
    const m = /^var_(hair|ink|shorts)_(.+)$/.exec(o.name); if (!m) return;
    const [, kind, id] = m;
    o.visible = kind === 'hair' ? id === hair : kind === 'shorts' ? id === shorts : ink.has(id);
  });
}
/** apply a look to a cloned fighter body; returns the walkout-only gear meshes (hidden once the fight starts) */
export function applyLook(body: THREE.Object3D, look: Look | undefined, a: LookAssets | undefined): THREE.Object3D[] {
  applyParts(body, look?.parts);
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
      else if (mat.name === 'Human.body') { skinMesh = m as THREE.SkinnedMesh; skinParent = m.parent; if ((look.tattoos.length || look.paint?.length) && a) inkSkin(mat, a, look.tattoos, look.paint); }
    }
  });
  const walkout: THREE.Object3D[] = [];
  if (!a?.gear || !skinParent || !look.gear.length || look.model === 'dario') return walkout;
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
