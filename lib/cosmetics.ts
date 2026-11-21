// VERSUS character customisation: what a fighter can wear. The art is built in Blender by
// scripts/art/build_cosmetics.py (tattoo ink masks baked into the shared skin UV layout, gear meshes
// fitted and skinned to every body). Pure data so career saves and the UI can use it without three.js.
import {NPC_MODELS, type FighterModel} from './fight3d/tape';

export type Look = {
  model: FighterModel;              // the body (each has its own face, skin and build)
  /** kit colours; left out = the body's own kit */
  shorts?: string; trim?: string; gloves?: string;
  tattoos: string[]; gear: string[];
  /** solid-colour layers painted into the skin texture before the ink (the referee's shirt, pants and shoes) */
  paint?: {id: string; color: string}[];
  /** customizable bodies (Dario): which hairstyle, tattoos and shorts are worn (ids from DARIO_PARTS) */
  parts?: {hair?: string; ink?: string[]; shorts?: string};
};
/** the referee: all black like real MMA officials (shirt, pants, shoes), dark latex gloves, white REFEREE lettering */
export const REFEREE_LOOK = (model: FighterModel): Look => ({model, shorts: '#111216', trim: '#111216', gloves: '#1d2a4a', tattoos: [], gear: [],
  paint: [{id: 'ref_pants', color: '#16171c'}, {id: 'ref_shirt', color: '#0d0e12'}, {id: 'ref_shoes', color: '#0a0a0c'}, {id: 'ref_back', color: '#f2f2f2'}, {id: 'ref_chest', color: '#f2f2f2'}]});
export type Cosmetic = {id: string; name: string; where: string; price: number};

export const TATTOOS: Cosmetic[] = [
  {id: 'chest_wings', name: 'Spread wings', where: 'Chest', price: 0},
  {id: 'sleeve', name: 'Tribal sleeve', where: 'Right upper arm', price: 0},
  {id: 'sleeve_fore', name: 'Tribal forearm', where: 'Right forearm', price: 0},
  {id: 'tribal_band', name: 'Flame band', where: 'Left bicep', price: 0},
  {id: 'script_fore', name: '"Loyalty" script', where: 'Left forearm', price: 0},
  {id: 'back_script', name: '"No Retreat"', where: 'Upper back', price: 2500},
  {id: 'stomach_word', name: '"Blessed"', where: 'Stomach', price: 1500},
  {id: 'rib_script', name: '"Faith" script', where: 'Ribs', price: 1200},
  {id: 'neck_star', name: 'Nautical star', where: 'Neck', price: 800},
  {id: 'mandala', name: 'Mandala', where: 'Left shoulder', price: 1800},
  {id: 'calf_band', name: 'Diamond band', where: 'Right calf', price: 900},
];
export const GEAR: (Cosmetic & {walkout?: boolean})[] = [
  {id: 'ankle', name: 'Ankle sleeves', where: 'Both ankles', price: 0},
  {id: 'knee', name: 'Knee sleeve', where: 'Left knee', price: 0},
  {id: 'tape', name: 'Kinesiology tape', where: 'Right shoulder', price: 0},
  {id: 'chain', name: 'Gold chain', where: 'Walkout', price: 6000, walkout: true},
  {id: 'band', name: 'Red bandana', where: 'Walkout', price: 1500, walkout: true},
];
export const KIT_COLORS = ['#c2242f', '#1c2a4a', '#111216', '#f1f1f3', '#0f7a6c', '#e9c873', '#5a2a86', '#2f6b2f', '#e8722a', '#2459d6', '#e58fb6', '#7a7f8a'];
export const BODIES: {model: FighterModel; label: string}[] = [
  {model: 'okafor', label: 'Lean, long'}, {model: 'volkov', label: 'Thick, sturdy'}, {model: 'takeda', label: 'Compact'}, {model: 'ashford', label: 'Heavy-set'},
  {model: 'kalani', label: 'Powerful'}, {model: 'bianchi', label: 'Rangy'}, {model: 'mwangi', label: 'Dense'}, {model: 'delacroix', label: 'Veteran'},
  {model: 'dario', label: 'Dario Vale (custom)'},
];
/** Dario Vale's parts (UNSEEN Interactive): each is a mesh in fighter-dario.glb named var_<kind>_<id> */
export const DARIO_PARTS = {
  hair: ['Close coils', 'High fade', 'Central crest', 'Brush cut', 'Ivy taper', 'French fringe', 'Flat top', 'Forward quiff', 'Side part', 'Swept pompadour', 'Faux hawk', 'Temple taper afro', 'Rounded afro', 'High top coils', 'Coiled fringe', 'Straight backs', 'Curved cornrows', 'Twin braids', 'Braided crown', 'Short twists', 'Drop locs', 'Crown knot', 'Low ponytail'].map((name, i) => ({id: String(i + 1).padStart(2, '0'), name})),
  ink: ['North star', 'Broken orbit', 'Twin peaks', 'Wave set', 'Solar rays', 'Wing feathers', 'Split arrow', 'Thorn vine', 'Eclipse', 'Compass rose', 'Storm bolt', 'Lotus petals', 'Crescent', 'Ripple rings', 'Three spears', 'Hourglass', 'Rising sun', 'Lattice knot', 'Comet trail', 'Mountain echo'].map((name, i) => ({id: String(i + 1).padStart(2, '0'), name})),
  shorts: [{id: 'twin_serpent', name: 'Twin Serpent'}, {id: 'ember', name: 'Ember'}, {id: 'ivory', name: 'Ivory'}, {id: 'pacific', name: 'Pacific'}, {id: 'night_circuit', name: 'Night Circuit'}, {id: 'sunburst', name: 'Sunburst'}, {id: 'tidal_break', name: 'Tidal Break'}],
};
export const DARIO_DEFAULT = {hair: '01', ink: [] as string[], shorts: 'twin_serpent'};
export const DEFAULT_LOOK: Look = {model: 'kalani', shorts: '#c2242f', trim: '#f1f1f3', gloves: '#141416', tattoos: [], gear: ['ankle']};

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
/** a stable, believable look for any NPC from its name: most fighters carry some ink and tape */
export function lookFor(name: string, model?: FighterModel): Look {
  const h = hash(name), r = (k: number) => ((h >>> k) & 255) / 255;
  const tattoos = TATTOOS.filter((t, i) => r(i % 24) < (i < 5 ? .2 : .1)).map(t => t.id).slice(0, 3);
  const gear = [r(3) < .5 ? 'ankle' : '', r(9) < .12 ? 'knee' : '', r(13) < .1 ? 'tape' : ''].filter(Boolean);
  return {model: model ?? NPC_MODELS[h % NPC_MODELS.length], shorts: KIT_COLORS[h % KIT_COLORS.length], trim: KIT_COLORS[(h >>> 5) % KIT_COLORS.length], gloves: '#141416', tattoos, gear};
}
