"""Generate an original VERSUS fighter with MakeHuman (MPFB, CC0 assets), rig it with the
Mixamo-compatible rig, dress it for MMA and attach the Mixamo animation clips.

Run: blender -b -P scripts/art/build_fighter_mh.py -- <mixamo_dir> <out.glb> <variant> [preview.png]
variant: red | blue
"""
import bpy, sys, os, glob, math, importlib, addon_utils
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, VARIANT = args[0], args[1], args[2]
PREVIEW = args[3] if len(args) > 3 else None
MOD = 'bl_ext.blender_org.mpfb'
addon_utils.enable(MOD, default_set=True)
HS = importlib.import_module(MOD + '.services.humanservice').HumanService
LS = importlib.import_module(MOD + '.services.locationservice').LocationService
UD = LS.get_user_data('')

VARIANTS = {
    'red': dict(race={'caucasian': .75, 'african': .05, 'asian': .2}, skin='young_caucasian_male2', hair='short02', brow='eyebrow007',
                shorts='#1f6b3a', trim='#0c0d10', glove='#141416', glove_trim='#c2242f', muscle=1.0, weight=.62, height=.55, proportions=.85),
    'blue': dict(race={'caucasian': .25, 'african': .65, 'asian': .1}, skin='young_african_male', hair='short04', brow='eyebrow003',
                 shorts='#f1f1f3', trim='#16181d', glove='#141416', glove_trim='#2459d6', muscle=1.0, weight=.66, height=.6, proportions=.8),
}
V = VARIANTS[VARIANT]
ANIMS = [('Mma Idle.fbx', 'idle'), ('Fighting Idle.fbx', 'idle_box'), ('Mma Kick.fbx', 'kick_high'), ('Mma Kick (1).fbx', 'kick_feint'),
         ('Mma Kick (2).fbx', 'kick_lead'), ('Punch To Elbow Combo.fbx', 'combo')]

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c) + (1,)
def material(name, color, rough=.55, coat=0.):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = srgb(color); p.inputs['Roughness'].default_value = rough; p.inputs['Coat Weight'].default_value = coat
    return m
def asset(kind, name):
    hits = glob.glob(os.path.join(UD, kind, name, '*.mhclo')) or glob.glob(os.path.join(UD, kind, name, '**', '*.mhclo'), recursive=True)
    return hits[0] if hits else None

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable(MOD, default_set=True)

# ---- body --------------------------------------------------------------
macro = {'gender': 1.0, 'age': .62, 'muscle': V['muscle'], 'weight': V['weight'], 'proportions': V['proportions'], 'height': V['height'],
         'cupsize': .5, 'firmness': .5, 'race': V['race']}
body = HS.create_human(macro_detail_dict=macro, feet_on_ground=True, scale=0.1)
rig = HS.add_builtin_rig(body, 'mixamo')
HS.set_character_skin(os.path.join(UD, 'skins', V['skin'], V['skin'] + '.mhmat'), body, skin_type='GAMEENGINE')
for kind, name, at in [('eyes', 'high-poly', 'Eyes'), ('eyebrows', V['brow'], 'Eyebrows'), ('eyelashes', 'eyelashes01', 'Eyelashes'), ('hair', V['hair'], 'Hair')]:
    f = asset(kind, name)
    if f: HS.add_mhclo_asset(f, body, asset_type=at, subdiv_levels=0, material_type='MAKESKIN')
    print('ASSET', at, os.path.basename(f) if f else 'MISSING ' + name)
parts = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig]
print('PARTS', [(o.name, len(o.data.vertices), [m.name for m in o.data.materials if m]) for o in parts])
print('BODYGROUP', bool(body.vertex_groups.get('body')))

# ---- shorts: recolour body faces between mid-thigh and waist -------------------
bpy.context.view_layer.update()
bonew = lambda n: rig.matrix_world @ rig.data.bones['mixamorig:' + n].head_local
hip_z, knee_z = bonew('Hips').z, bonew('LeftLeg').z
lo, hi = knee_z + .5 * (hip_z - knee_z), hip_z + .035
m_sh, m_tr = material('shorts', V['shorts'], .62), material('shorts_trim', V['trim'], .5)
body.data.materials.append(m_sh); body.data.materials.append(m_tr)
i_sh, i_tr = len(body.data.materials) - 2, len(body.data.materials) - 1
bg = body.vertex_groups.get('body')
mw = body.matrix_world
legs = {body.vertex_groups[n].index for n in ('mixamorig:Hips', 'mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg', 'mixamorig:Spine') if body.vertex_groups.get(n)}
legw = {v.index: sum(g.weight for g in v.groups if g.group in legs) for v in body.data.vertices}
in_body = set()
if bg:
    for v in body.data.vertices:
        if any(g.group == bg.index and g.weight > .5 for g in v.groups): in_body.add(v.index)
for f in body.data.polygons:
    if bg and not all(i in in_body for i in f.vertices): continue
    if sum(legw[i] for i in f.vertices) / len(f.vertices) < .55: continue
    z = sum((mw @ body.data.vertices[i].co).z for i in f.vertices) / len(f.vertices)
    if lo < z < hi:
        f.material_index = i_tr if (z > hi - .035 or z < lo + .02) else i_sh

# ---- gloves painted into the hand skin --------------------------------------------
# The glove is part of the body surface: hand faces get the glove material and are puffed
# outwards slightly, so it deforms exactly with the fist and can never separate.
import bmesh
gloves = []
m_gl, m_gt = material('glove', V['glove'], .42, .3), material('glove_trim', V['glove_trim'], .45)
bpy.context.view_layer.objects.active = body
body.select_set(True)
if body.data.shape_keys:
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)   # bake the MakeHuman shape
body.data.materials.append(m_gl); body.data.materials.append(m_gt)
i_gl, i_gt = len(body.data.materials) - 2, len(body.data.materials) - 1
hand_ids = {g.index for g in body.vertex_groups if g.name.endswith('Hand') or ('Hand' in g.name and g.name[-1] in '12' and 'Thumb' not in g.name)}
thumb_ids = {g.index for g in body.vertex_groups if 'Thumb1' in g.name}
arm_ids = {g.index for g in body.vertex_groups if g.name.endswith('ForeArm') or g.name.endswith('Hand')}
wrist = [rig.matrix_world @ rig.data.bones[f'mixamorig:{s}Hand'].head_local for s in ('Left', 'Right')]
all_hand = {g.index for g in body.vertex_groups if 'Hand' in g.name}
hand_segs = [(lambda h, k: (h + (k - h) * .12, k))(rig.matrix_world @ rig.data.bones[f'mixamorig:{s}Hand'].head_local, rig.matrix_world @ rig.data.bones[f'mixamorig:{s}HandMiddle1'].head_local) for s in ('Left', 'Right')]
def seg_dist(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length
mw = body.matrix_world
bm = bmesh.new(); bm.from_mesh(body.data)
dl = bm.verts.layers.deform.active
gw, sw = {}, {}
for v in bm.verts:
    d = v[dl]
    gw[v.index] = sum(w for g, w in d.items() if g in hand_ids) + .6 * sum(w for g, w in d.items() if g in thumb_ids)
    if True:  # rest pose: hands are far from the body, so distance alone is safe
        pw = mw @ v.co
        dist = min(seg_dist(pw, a, b) for a, b in hand_segs)
        if dist < .085: gw[v.index] = max(gw[v.index], 1.0 if dist < .072 else .6)
    p = mw @ v.co
    near = min((p - c).length for c in wrist)
    sw[v.index] = 1.0 if (sum(w for g, w in d.items() if g in arm_ids) > .5 and near < .05) else 0.0
bm.normal_update()
for v in bm.verts:
    g = min(1.0, gw[v.index]); s = sw[v.index]
    if g > .05: v.co += v.normal * .009 * g
    elif s: v.co += v.normal * .005
for f in bm.faces:
    vs = [v.index for v in f.verts]
    if sorted(gw[i] for i in vs)[len(vs) // 2] > .45: f.material_index = i_gl
    elif sum(sw[i] for i in vs) / len(vs) > .5: f.material_index = i_gt
bm.to_mesh(body.data); bm.free()

# ---- animations from the Mixamo clips ---------------------------------------------
for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
if not rig.animation_data: rig.animation_data_create()
for fn, name in ANIMS:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, fn))
    new = [o for o in bpy.data.objects if o not in before]
    src_arm = next(o for o in new if o.type == 'ARMATURE')
    act = src_arm.animation_data.action; act.name = name; act.use_fake_user = True
    k = src_arm.scale.x / rig.scale.x
    for fc in (act.fcurves if hasattr(act, 'fcurves') else [c for l in act.layers for s in l.strips for cb in s.channelbags for c in cb.fcurves]):
        if fc.data_path.endswith('location'):
            for kp in fc.keyframe_points:
                kp.co.y *= k; kp.handle_left.y *= k; kp.handle_right.y *= k
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, int(act.frame_range[0]), act)
    if hasattr(st, 'action_slot') and len(act.slots): st.action_slot = act.slots[0]
    tr.mute = True
rig.animation_data.action = None

# ---- fists: find which way each finger joint curls toward the palm, then lock a fist ----
from mathutils import Quaternion
def tip_of(side, finger):
    b = rig.pose.bones.get(f'mixamorig:{side}Hand{finger}4') or rig.pose.bones[f'mixamorig:{side}Hand{finger}3']
    return rig.matrix_world @ (b.tail if b.name.endswith('3') else b.head)
FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
fist = {}
bpy.context.scene.frame_set(1)
for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0)
bpy.context.view_layer.update()
for side in ('Left', 'Right'):
    h = rig.matrix_world @ rig.pose.bones[f'mixamorig:{side}Hand'].head
    m1 = rig.matrix_world @ rig.pose.bones[f'mixamorig:{side}HandMiddle1'].head
    i1 = rig.matrix_world @ rig.pose.bones[f'mixamorig:{side}HandIndex1'].head
    p1 = rig.matrix_world @ rig.pose.bones[f'mixamorig:{side}HandPinky1'].head
    # rest pose: palms face down; take world -Z, made perpendicular to the finger direction
    fdir = (m1 - h).normalized(); normal = Vector((0, 0, -1)); normal = (normal - fdir * normal.dot(fdir)).normalized()
    print('PALM', side, [round(x, 2) for x in (i1 - h).cross(p1 - h).normalized()], [round(x, 2) for x in normal])

    for finger in FINGERS:
        angles = [.7, .8, .6] if finger == 'Thumb' else [1.6, 1.85, 1.45]
        for seg, ang in zip((1, 2, 3), angles):
            pb = rig.pose.bones.get(f'mixamorig:{side}Hand{finger}{seg}')
            if not pb: continue
            best = None
            for axis in ((1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1)):
                q = Quaternion(axis, ang)
                pb.rotation_quaternion = q; bpy.context.view_layer.update()
                t = tip_of(side, finger)
                palm = (h + m1) / 2 + normal * .03 if finger != 'Thumb' else (i1 + m1) / 2 + normal * .03
                d = (t - palm).length
                if best is None or d < best[0]: best = (d, q.copy())
            pb.rotation_quaternion = best[1]; bpy.context.view_layer.update()
            fist[pb.name] = best[1]
print('FIST', len(fist), 'finger joints')

def channelbags(act):
    return [cb for l in act.layers for s in l.strips for cb in s.channelbags]
for act in [a for a in bpy.data.actions]:
    for cb in channelbags(act):
        for fc in list(cb.fcurves):
            if any(f'"{n}"' in fc.data_path for n in fist): cb.fcurves.remove(fc)
        f0 = act.frame_range[0]
        for name, q in fist.items():
            for i in range(4):
                fc = cb.fcurves.new(f'pose.bones["{name}"].rotation_quaternion', index=i, group_name=name)
                fc.keyframe_points.insert(f0, q[i])
for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0)

# ---- textures: keep the download small ----------------------------------------------
for img in bpy.data.images:
    if img.size[0] > 1024: img.scale(1024, int(1024 * img.size[1] / img.size[0]))

if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 800, 1000
    sc.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = srgb('#1b2436'); w.node_tree.nodes['Background'].inputs[1].default_value = .7
    rig.animation_data.nla_tracks['idle'].mute = False; sc.frame_set(20)
    cd = bpy.data.cameras.new('c'); cd.lens = 50; cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (1.5, -2.5, 1.45); cam.rotation_euler = (math.radians(86), 0, math.radians(31))
    for loc, e, col in [((2.5, -3, 4), 900, '#fff1e4'), ((-3, 2, 3), 650, '#4f7dff'), ((3, 3, 2.2), 450, '#ff5a6a')]:
        ld = bpy.data.lights.new('l', 'AREA'); ld.energy = e; ld.size = 3; ld.color = srgb(col)[:3]
        lo_ = bpy.data.objects.new('l', ld); sc.collection.objects.link(lo_); lo_.location = loc
        lo_.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = PREVIEW; bpy.ops.render.render(write_still=True)
    for t in rig.animation_data.nla_tracks: t.mute = t.name != 'combo'
    sc.frame_set(25); bpy.context.view_layer.update()
    hp = rig.matrix_world @ rig.pose.bones['mixamorig:LeftHand'].head
    cam.location = hp + Vector((.25, -.55, .12)); cam.rotation_euler = (hp - cam.location).to_track_quat('-Z', 'Y').to_euler(); cd.lens = 60
    sc.render.resolution_x, sc.render.resolution_y = 700, 700
    sc.render.filepath = PREVIEW.replace('.png', '-hand.png'); bpy.ops.render.render(write_still=True)
    for t in rig.animation_data.nla_tracks: t.mute = True

bpy.ops.object.select_all(action='DESELECT')
for o in [rig] + parts + gloves: o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_yup=True, export_apply=True, export_morph=False, export_image_format='JPEG', export_jpeg_quality=82)
print('EXPORTED', OUT, [t.name for t in rig.animation_data.nla_tracks], len(parts), 'meshes')
