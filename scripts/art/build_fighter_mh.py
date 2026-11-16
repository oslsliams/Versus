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
parts = [o for o in bpy.data.objects if o.type == 'MESH']
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

# ---- gloves skinned to the hand bones ------------------------------------------
gloves = []
m_gl, m_gt = material('glove', V['glove'], .38, .35), material('glove_trim', V['glove_trim'], .45)
for side in ('Left', 'Right'):
    hb = rig.data.bones[f'mixamorig:{side}Hand']
    head = rig.matrix_world @ hb.head_local
    knuckle = rig.matrix_world @ rig.data.bones[f'mixamorig:{side}HandMiddle1'].head_local
    tip = rig.matrix_world @ rig.data.bones[f'mixamorig:{side}HandMiddle3'].head_local
    d = knuckle - head; L = d.length
    rot = d.to_track_quat('Y', 'Z').to_matrix().to_4x4()
    print('HAND', side, round(L, 3), round((tip - knuckle).length, 3))
    for (name, size, off, m, bev) in [(f'Glove{side}', (.1, L * 1.6, .085), .68, m_gl, .034), (f'Strap{side}', (.078, .055, .07), .02, m_gt, .02)]:
        bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.object; o.name = name; o.scale = size
        bpy.ops.object.transform_apply(scale=True)
        b = o.modifiers.new('bv', 'BEVEL'); b.width = bev; b.segments = 5; bpy.ops.object.modifier_apply(modifier='bv')
        o.matrix_world = Matrix.Translation(head + d.normalized() * L * off) @ rot
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for p in o.data.polygons: p.use_smooth = True
        o.data.materials.append(m)
        vg = o.vertex_groups.new(name=hb.name); vg.add([v.index for v in o.data.vertices], 1.0, 'REPLACE')
        o.parent = rig; am = o.modifiers.new('Armature', 'ARMATURE'); am.object = rig
        gloves.append(o)

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
    rig.animation_data.nla_tracks['idle'].mute = True

bpy.ops.object.select_all(action='DESELECT')
for o in [rig] + parts + gloves: o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_yup=True, export_apply=True, export_morph=False, export_image_format='JPEG', export_jpeg_quality=82)
print('EXPORTED', OUT, [t.name for t in rig.animation_data.nla_tracks], len(parts), 'meshes')
