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
    # ---- roster: one original body per Quick Fight fighter ----
    'okafor': dict(race={'african': .9, 'caucasian': .1, 'asian': 0}, skin='young_african_male', hair='short01', brow='eyebrow002',
                   shorts='#c2242f', trim='#f1f1f3', glove='#141416', glove_trim='#f1f1f3', muscle=.95, weight=.45, height=.62, proportions=.85, age=.5),
    'volkov': dict(race={'caucasian': 1, 'african': 0, 'asian': 0}, skin='young_caucasian_male', hair='short03', brow='eyebrow010',
                   shorts='#1c2a4a', trim='#c9a227', glove='#141416', glove_trim='#c9a227', muscle=1.0, weight=.78, height=.5, proportions=.7, age=.6),
    'takeda': dict(race={'asian': .95, 'caucasian': .05, 'african': 0}, skin='young_asian_male', hair='short02', brow='eyebrow005',
                   shorts='#f1f1f3', trim='#c2242f', glove='#141416', glove_trim='#c2242f', muscle=.85, weight=.42, height=.42, proportions=.8, age=.55),
    'ashford': dict(race={'caucasian': .85, 'african': .15, 'asian': 0}, skin='middleage_caucasian_male', hair='short04', brow='eyebrow011',
                    shorts='#111216', trim='#e8722a', glove='#141416', glove_trim='#e8722a', muscle=.95, weight=.95, height=.72, proportions=.55, age=.7),
    'kalani': dict(race={'african': .45, 'asian': .45, 'caucasian': .1}, skin='young_african_male', hair='afro01', brow='eyebrow004',
                   shorts='#0f7a6c', trim='#f1f1f3', glove='#141416', glove_trim='#18b5a0', muscle=1.0, weight=.85, height=.68, proportions=.6, age=.55),
    'bianchi': dict(race={'caucasian': .95, 'african': 0, 'asian': .05}, skin='young_caucasian_male2', hair='ponytail01', brow='eyebrow008',
                    shorts='#e9c873', trim='#111216', glove='#141416', glove_trim='#e9c873', muscle=.8, weight=.35, height=.7, proportions=.9, age=.45),
    'mwangi': dict(race={'african': 1, 'caucasian': 0, 'asian': 0}, skin='middleage_african_male', hair='short01', brow='eyebrow001',
                   shorts='#5a2a86', trim='#f1f1f3', glove='#141416', glove_trim='#9b6bd6', muscle=1.0, weight=.72, height=.55, proportions=.7, age=.62),
    'delacroix': dict(race={'caucasian': .7, 'african': .2, 'asian': .1}, skin='middleage_caucasian_male', hair='short03', brow='eyebrow012',
                      shorts='#2f6b2f', trim='#111216', glove='#141416', glove_trim='#7fd16b', muscle=.9, weight=.58, height=.6, proportions=.75, age=.72),
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
macro = {'gender': 1.0, 'age': V.get('age', .62), 'muscle': V['muscle'], 'weight': V['weight'], 'proportions': V['proportions'], 'height': V['height'],
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

# ---- match Mixamo's rest pose, so the captured rotations play back exactly ----------
# Re-pose every bone to the orientation it has in the Mixamo source skeleton (T-pose),
# bake that into the meshes, then make it the new rest pose.
from mathutils import Matrix
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, ANIMS[0][0]))
src_new = [o for o in bpy.data.objects if o not in before]
src = next(o for o in src_new if o.type == 'ARMATURE')
src_rest = {b.name: (src.matrix_world @ b.matrix_local).to_quaternion() for b in src.data.bones}
for o in src_new: bpy.data.objects.remove(o, do_unlink=True)
for a in [a for a in bpy.data.actions if a.users == 0]: bpy.data.actions.remove(a)
for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
arm_inv = rig.matrix_world.to_quaternion().inverted()
def depth(b): return 0 if not b.parent else 1 + depth(b.parent)
for pb in sorted(rig.pose.bones, key=lambda p: depth(p.bone)):
    q = src_rest.get(pb.name)
    if q is None: continue
    head = pb.matrix.translation.copy()
    m = (arm_inv @ q).to_matrix().to_4x4(); m.translation = head
    pb.matrix = m
    bpy.context.view_layer.update()
for o in parts:
    bpy.context.view_layer.objects.active = o
    if o.data.shape_keys: o.shape_key_clear() if o is not body else None
    if o is body and o.data.shape_keys:
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for md in list(o.modifiers):
        if md.type == 'ARMATURE':
            name = md.name
            bpy.ops.object.modifier_apply(modifier=name)
            nm = o.modifiers.new('Armature', 'ARMATURE'); nm.object = rig
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
print('REST', 'matched to Mixamo T-pose for', len(src_rest), 'bones')

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

# ---- authored poses for states without motion capture (ground game, shots, knockouts) ----
# Each limb is aimed along a world direction in the standing frame (character faces -Y,
# left side is +X); the whole body is then tipped from the hips and dropped onto the mat.
from mathutils import Vector, Quaternion
def reset_pose():
    for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
def aim(name, d):
    pb = rig.pose.bones['mixamorig:' + name]
    wm = rig.matrix_world @ pb.matrix
    cur = (rig.matrix_world @ pb.tail) - (rig.matrix_world @ pb.head)
    rot = cur.normalized().rotation_difference(Vector(d).normalized())
    head = wm.translation.copy()
    new_w = Matrix.Translation(head) @ rot.to_matrix().to_4x4() @ Matrix.Translation(-head) @ wm
    pb.matrix = rig.matrix_world.inverted() @ new_w
    bpy.context.view_layer.update()
def tip_body(axis_angle):
    pb = rig.pose.bones['mixamorig:Hips']
    wm = rig.matrix_world @ pb.matrix; head = wm.translation.copy()
    r = Quaternion(*axis_angle).to_matrix().to_4x4()
    pb.matrix = rig.matrix_world.inverted() @ (Matrix.Translation(head) @ r @ Matrix.Translation(-head) @ wm)
    bpy.context.view_layer.update()
def drop_to_floor(clear=.04):
    pts = []
    for pb in rig.pose.bones:
        if 'Hand' in pb.name and pb.name[-1].isdigit(): continue
        pts += [(rig.matrix_world @ pb.head).z, (rig.matrix_world @ pb.tail).z]
    dz = min(pts) - clear
    pb = rig.pose.bones['mixamorig:Hips']
    wm = rig.matrix_world @ pb.matrix; wm.translation.z -= dz
    pb.matrix = rig.matrix_world.inverted() @ wm
    bpy.context.view_layer.update()
def limbs(spec):
    for side, s in (('Left', 1), ('Right', -1)):
        for part, d in spec.items():
            if part.startswith(('L:', 'R:')):
                if part[0] != side[0]: continue
                part = part[2:]
            elif part in ('Spine', 'Spine1', 'Spine2', 'Neck', 'Head'):
                if side == 'Right': continue
                aim(part, d); continue
            aim(side + part, (d[0] * s, d[1], d[2]))
def key_pose(action, frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        if pb.name == 'mixamorig:Hips': pb.keyframe_insert('location', frame=frame)
def make_action(name, frames):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data.action = act
    for fr, build in frames:
        reset_pose(); build(); key_pose(act, fr)
    rig.animation_data.action = None
    tr = rig.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, int(act.frame_range[0]), act)
    if hasattr(st, 'action_slot') and len(act.slots): st.action_slot = act.slots[0]
    tr.mute = True
    reset_pose()

LIE = ((1, 0, 0), -math.radians(88))      # tip backwards onto the back
def guard_back():   # on your back, knees up, forearms covering the face
    limbs({'UpLeg': (.28, -.8, -.5), 'Leg': (.05, .3, -.95), 'Arm': (.3, -.55, -.78), 'ForeArm': (-.15, -.5, .85), 'Spine2': (0, -.08, 1), 'Head': (0, -.35, .94)})
    tip_body(LIE); drop_to_floor(.06)
def knocked():      # out cold: limbs loose, arms flung out
    limbs({'L:UpLeg': (.2, -.15, -.97), 'R:UpLeg': (.12, -.45, -.88), 'L:Leg': (.1, .05, -1), 'R:Leg': (.05, .4, -.92),
           'L:Arm': (.92, .05, .38), 'R:Arm': (.85, -.2, .1), 'L:ForeArm': (.6, .1, .8), 'R:ForeArm': (.95, -.1, -.3), 'Head': (.25, .15, .95)})
    tip_body(LIE); drop_to_floor(.06)
def top_base(punch):  # low, chest-to-chest top control (like UFC half guard / side control), right hand ground-and-pound
    limbs({'UpLeg': (.45, -.15, -.88), 'Leg': (.05, .99, -.1),
           'Spine': (0, -.85, .52), 'Spine1': (0, -.95, .3), 'Spine2': (0, -.98, .18), 'Head': (0, -.9, .42),
           'L:Arm': (.55, -.55, -.62), 'L:ForeArm': (-.15, -.3, -.94)})
    if punch: limbs({'R:Arm': (.05, -.55, -.83), 'R:ForeArm': (.15, -.45, -.88)})
    else: limbs({'R:Arm': (.4, .3, .5), 'R:ForeArm': (-.15, -.75, .65)})
    drop_to_floor(.05)
def shoot(phase=1.0):   # level change, penetration step, arms wrapping the legs (double leg)
    limbs({'L:UpLeg': (.2, -.8, -.56), 'L:Leg': (0, .45 * phase, -.9), 'R:UpLeg': (.2, .5, -.85), 'R:Leg': (0, .97, -.25 * phase),
           'Spine': (0, -.6, .8), 'Spine1': (0, -.78, .62), 'Spine2': (0, -.88, .47), 'Head': (.25, -.85, .45),
           'Arm': (.45 - .3 * phase, -.85, -.3), 'ForeArm': (-.55 * phase, -.8, -.25)})
    drop_to_floor(.03)
def sprawl():       # hips down, legs kicked back
    limbs({'UpLeg': (.25, .85, -.45), 'Leg': (.05, .99, .05),
           'Spine': (0, -.8, .6), 'Spine1': (0, -.85, .5), 'Spine2': (0, -.9, .42), 'Head': (0, -.85, .52),
           'Arm': (.35, -.75, -.55), 'ForeArm': (-.05, -.6, -.8)})
    drop_to_floor(.04)
make_action('ground_back', [(1, guard_back)])
make_action('knocked', [(1, knocked)])
make_action('ground_top', [(1, lambda: top_base(False)), (7, lambda: top_base(True)), (13, lambda: top_base(False))])
make_action('shoot', [(1, lambda: shoot(.4)), (8, lambda: shoot(1.0))])
make_action('sprawl', [(1, sprawl)])

# ===================== MOVE LIBRARY (authored from the Mixamo fighting stance) =====================
# References: UFC 6 striking/grapple clips + standard MMA technique. Lead side = Left (orthodox).
# Each move starts and ends in the real captured guard so it blends with motion capture.
idle_act = bpy.data.actions['idle']
rig.animation_data.action = idle_act
if hasattr(rig.animation_data, 'action_slot') and idle_act.slots: rig.animation_data.action_slot = idle_act.slots[0]
bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
GUARD = {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy()) for pb in rig.pose.bones}
rig.animation_data.action = None
def guard():
    for pb in rig.pose.bones:
        q, l = GUARD[pb.name]; pb.rotation_quaternion = q; pb.location = l
    bpy.context.view_layer.update()
def wpos(name, tail=False):
    pb = rig.pose.bones['mixamorig:' + name]
    return rig.matrix_world @ (pb.tail if tail else pb.head)
def turn(name, axis, ang):
    pb = rig.pose.bones['mixamorig:' + name]
    wm = rig.matrix_world @ pb.matrix; h = wm.translation.copy()
    r = Quaternion(axis, ang).to_matrix().to_4x4()
    pb.matrix = rig.matrix_world.inverted() @ (Matrix.Translation(h) @ r @ Matrix.Translation(-h) @ wm)
    bpy.context.view_layer.update()
def torso(twist=0., lean_fwd=0., lean_side=0., hips=0.):
    if hips: turn('Hips', (0, 0, 1), hips)
    for b, k in (('Spine', .4), ('Spine1', .3), ('Spine2', .3)):
        if twist: turn(b, (0, 0, 1), twist * k)
        if lean_fwd: turn(b, (1, 0, 0), lean_fwd * k)
        if lean_side: turn(b, (0, 1, 0), lean_side * k)
def level(dz):  # bend the knees: lower the hips (feet stay roughly planted)
    pb = rig.pose.bones['mixamorig:Hips']; wm = rig.matrix_world @ pb.matrix; wm.translation.z -= dz
    pb.matrix = rig.matrix_world.inverted() @ wm; bpy.context.view_layer.update()
REACH = .62
def target(height='head', side_off=0.):
    h = wpos('Head'); c = wpos('Spine1')
    z = h.z - .02 if height == 'head' else c.z - .05
    return Vector((h.x * .3 + side_off, h.y - REACH, z))
def straight(side, tgt, ext=1.0):
    sh = wpos(side + 'Arm'); d = (tgt - sh)
    aim(side + 'Arm', d); aim(side + 'ForeArm', d.lerp(Vector((0, -.2, 1)), 1 - ext) if ext < 1 else d)
SX = {'Left': 1, 'Right': -1}
def hook(side, low=False):
    s = SX[side]
    aim(side + 'Arm', (s * .75, -.6, -.25 if low else .12)); aim(side + 'ForeArm', (-s * .85, -.5, -.1 if low else .02))
def upper(side):
    s = SX[side]
    aim(side + 'Arm', (s * .1, -.85, -.35)); aim(side + 'ForeArm', (-s * .1, -.2, .98))
def elbow(side):
    s = SX[side]
    aim(side + 'Arm', (s * .55, -.7, .45)); aim(side + 'ForeArm', (-s * .95, .1, -.1))
def chamber(side):  # pull the hand back by the chin (loading / recovering)
    s = SX[side]; aim(side + 'Arm', (s * .3, -.35, -.88)); aim(side + 'ForeArm', (-s * .2, -.45, .87))
def guard_hands():
    chamber('Left'); chamber('Right')
def F(*steps):      # build a key: apply each step function in order, starting from the guard
    def build():
        guard()
        for st in steps: st()
    return build
def move(name, keys):
    make_action(name, [(fr, F(*steps)) for fr, steps in keys])

# ---- punches (lead = Left, rear = Right) ----
move('jab_head', [(1, []), (4, [lambda: torso(-.18), lambda: straight('Left', target())]), (9, [])])
move('jab_body', [(1, []), (3, [lambda: level(.12)]), (6, [lambda: level(.16), lambda: torso(-.2, .25), lambda: straight('Left', target('body'))]), (12, [])])
move('cross_head', [(1, []), (5, [lambda: torso(.55, .05, 0, .2), lambda: straight('Right', target()), lambda: chamber('Left')]), (12, [])])
move('cross_body', [(1, []), (4, [lambda: level(.1)]), (7, [lambda: level(.17), lambda: torso(.5, .3, 0, .18), lambda: straight('Right', target('body'))]), (14, [])])
move('lead_hook', [(1, []), (3, [lambda: torso(.18)]), (7, [lambda: torso(-.6, 0, 0, -.22), lambda: hook('Left'), lambda: chamber('Right')]), (13, [])])
move('lead_body_hook', [(1, []), (4, [lambda: level(.12), lambda: torso(.2, .1)]), (8, [lambda: level(.16), lambda: torso(-.55, .2, .15, -.2), lambda: hook('Left', True)]), (15, [])])
move('rear_hook', [(1, []), (4, [lambda: torso(-.15)]), (8, [lambda: torso(.65, 0, 0, .25), lambda: hook('Right'), lambda: chamber('Left')]), (14, [])])
move('lead_uppercut', [(1, []), (4, [lambda: level(.1), lambda: torso(.15, .1, .15)]), (8, [lambda: torso(-.35, -.1, -.1), lambda: upper('Left')]), (14, [])])
move('rear_uppercut', [(1, []), (4, [lambda: level(.12), lambda: torso(-.1, .1, -.15)]), (8, [lambda: torso(.45, -.1, .1, .15), lambda: upper('Right')]), (14, [])])
move('overhand', [(1, []), (5, [lambda: torso(-.2, -.1)]), (10, [lambda: level(.08), lambda: torso(.7, .3, .2, .25), lambda: aim('RightArm', (-.1, -.7, .7)), lambda: aim('RightForeArm', (.15, -.75, -.4))]), (17, [])])
move('lead_elbow', [(1, []), (6, [lambda: torso(-.55, .1, 0, -.2), lambda: elbow('Left')]), (12, [])])
move('superman', [(1, []), (6, [lambda: aim('RightUpLeg', (0, .75, -.66)), lambda: aim('RightLeg', (0, .9, .2)), lambda: torso(.2, -.1)]),
                  (11, [lambda: torso(.6, .15, 0, .25), lambda: straight('Right', target()), lambda: aim('RightUpLeg', (0, .3, -.95))]), (19, [])])

# ---- kicks and knees ----
def rkick(height):  # rear roundhouse: pivot, hips turn over, shin through the target
    z = {'low': -.35, 'body': .15, 'calf': -.6}[height]
    torso(.75, -.25, -.25, .55)
    aim('RightUpLeg', (.45, -.8, z * .6 + .05)); aim('RightLeg', (.55, -.8, z))
    aim('RightArm', (-.6, .5, -.4)); aim('RightForeArm', (-.3, .2, -.9)); chamber('Left')
move('rear_low_kick', [(1, []), (5, [lambda: torso(.35, 0, 0, .25), lambda: level(.05)]), (10, [lambda: rkick('low')]), (18, [])])
move('calf_kick', [(1, []), (4, [lambda: torso(.3, 0, 0, .2)]), (9, [lambda: rkick('calf')]), (16, [])])
move('body_kick', [(1, []), (5, [lambda: torso(.4, 0, 0, .3)]), (11, [lambda: rkick('body')]), (20, [])])
move('teep', [(1, []), (5, [lambda: aim('LeftUpLeg', (.1, -.95, .25)), lambda: aim('LeftLeg', (0, -.15, -.99)), lambda: torso(0, -.15)]),
              (9, [lambda: aim('LeftUpLeg', (.1, -.97, .15)), lambda: aim('LeftLeg', (.05, -.98, .2)), lambda: torso(0, -.3)]), (16, [])])
move('rear_knee', [(1, []), (4, [lambda: straight('Left', target('head', .1), .7), lambda: straight('Right', target('head', -.1), .7)]),
                   (8, [lambda: torso(0, -.25), lambda: aim('RightUpLeg', (.15, -.72, .66)), lambda: aim('RightLeg', (0, .35, -.94)),
                        lambda: aim('LeftForeArm', (-.3, -.6, -.75)), lambda: aim('RightForeArm', (.3, -.6, -.75))]), (15, [])])

# ---- defense ----
move('slip_out', [(1, []), (4, [lambda: level(.06), lambda: torso(-.15, .1, .35)]), (10, [])])
move('slip_in', [(1, []), (4, [lambda: level(.06), lambda: torso(.2, .1, -.35)]), (10, [])])
move('roll', [(1, []), (4, [lambda: level(.12), lambda: torso(.1, .35, .3)]), (8, [lambda: level(.18), lambda: torso(0, .5, 0)]), (12, [lambda: level(.12), lambda: torso(-.1, .35, -.3)]), (17, [])])
def high_guard():
    for side, s in SX.items(): aim(side + 'Arm', (s * .3, -.75, -.25)); aim(side + 'ForeArm', (-s * .2, -.15, .97))
    turn('Head', (1, 0, 0), .25)
move('block_high', [(1, []), (3, [high_guard, lambda: level(.04)])])
def body_guard():
    for side, s in SX.items(): aim(side + 'Arm', (s * .15, -.25, -.95)); aim(side + 'ForeArm', (-s * .25, -.6, .75))
    torso(0, .25)
move('block_body', [(1, []), (3, [body_guard, lambda: level(.08)])])
move('check', [(1, []), (4, [lambda: aim('LeftUpLeg', (.55, -.7, .45)), lambda: aim('LeftLeg', (.2, -.25, -.95)), lambda: torso(0, .05)]), (11, [])])

# ---- reactions ----
move('hit_head', [(1, []), (3, [lambda: torso(.1, -.2), guard_hands, lambda: turn('Head', (1, 0, 0), -.6), lambda: level(.03)]), (11, [])])
move('hit_head_l', [(1, []), (3, [lambda: turn('Head', (0, 0, 1), .7), lambda: turn('Head', (0, 1, 0), .3), lambda: torso(.3, -.1, .25)]), (11, [])])
move('hit_head_r', [(1, []), (3, [lambda: turn('Head', (0, 0, 1), -.7), lambda: turn('Head', (0, 1, 0), -.3), lambda: torso(-.3, -.1, -.25)]), (11, [])])
move('hit_body', [(1, []), (3, [lambda: level(.08), lambda: torso(0, .45), body_guard]), (13, [])])
move('hit_leg', [(1, []), (3, [lambda: aim('LeftLeg', (0, .55, -.83)), lambda: level(.1), lambda: torso(0, .1, .2)]), (12, [])])
move('stagger', [(1, []), (4, [lambda: turn('Head', (1, 0, 0), -.7), lambda: torso(.4, -.45, .3), lambda: aim('LeftArm', (.8, .2, -.55)), lambda: aim('RightArm', (-.8, .3, -.5))]),
                 (10, [lambda: level(.1), lambda: torso(-.3, -.2, -.25)]), (18, [])])
move('victory', [(1, []), (8, [lambda: aim('LeftArm', (.35, 0, .94)), lambda: aim('LeftForeArm', (.25, -.1, .96)), lambda: aim('RightArm', (-.35, 0, .94)),
                               lambda: aim('RightForeArm', (-.25, -.1, .96)), lambda: turn('Head', (1, 0, 0), -.35), lambda: torso(0, -.15)])])
print('MOVES', len([t for t in rig.animation_data.nla_tracks]))
print('POSES', [t.name for t in rig.animation_data.nla_tracks])

if PREVIEW:
    sc = bpy.context.scene
    for t in rig.animation_data.nla_tracks: t.mute = True
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x, sc.render.resolution_y = 640, 480
    pcd = bpy.data.cameras.new('pc'); pcd.lens = 35; pcam = bpy.data.objects.new('pc', pcd); sc.collection.objects.link(pcam); sc.camera = pcam
    pcam.location = (3.4, -2.2, 1.2); pcam.rotation_euler = (Vector((0, 0, .45)) - pcam.location).to_track_quat('-Z', 'Y').to_euler()
    PF = {'ground_top': 7, 'shoot': 8, 'jab_head': 4, 'cross_head': 5, 'lead_hook': 7, 'rear_uppercut': 8, 'body_kick': 11, 'teep': 9, 'rear_knee': 8, 'roll': 8, 'hit_head': 3, 'stagger': 4, 'check': 4}
    for pose_name in ('ground_back', 'ground_top', 'knocked', 'shoot', 'jab_head', 'cross_head', 'lead_hook', 'rear_uppercut', 'body_kick', 'teep', 'rear_knee', 'roll', 'hit_head', 'stagger', 'check'):
        rig.animation_data.nla_tracks[pose_name].mute = False; sc.frame_set(PF.get(pose_name, 1)); bpy.context.view_layer.update()
        hz = (rig.matrix_world @ rig.pose.bones['mixamorig:Hips'].head).z
        print('POSEHIP', pose_name, round(hz, 3))
        sc.render.filepath = PREVIEW.replace('.png', f'-pose-{pose_name}.png'); bpy.ops.render.render(write_still=True)
        rig.animation_data.nla_tracks[pose_name].mute = True
    bpy.data.objects.remove(pcam, do_unlink=True)

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
