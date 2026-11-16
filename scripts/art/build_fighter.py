"""Build the VERSUS fighter: Mixamo rig + animations -> skinned, dressed GLB.

Run: blender -b --factory-startup -P scripts/art/build_fighter.py -- <mixamo_dir> <out.glb> [preview.png]
Source FBX files are licensed Mixamo assets kept out of git (assets-src/).
"""
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = args[0], args[1]
PREVIEW = args[2] if len(args) > 2 else None
ANIMS = [('Fighting Idle.fbx', 'idle'), ('Mma Idle.fbx', 'idle_alt'), ('Mma Kick.fbx', 'kick_a'), ('Mma Kick (1).fbx', 'kick_b'), ('Mma Kick (2).fbx', 'kick_c'), ('Punch To Elbow Combo.fbx', 'combo')]

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c) + (1,)

def material(name, color, rough=.5, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = srgb(color); p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal; p.inputs['Coat Weight'].default_value = coat
    return m

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, ANIMS[0][0]))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
arm.animation_data.action.name = ANIMS[0][1]

# pull every other clip onto this rig
for fn, name in ANIMS[1:]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, fn))
    new = [o for o in bpy.data.objects if o not in before]
    other = next(o for o in new if o.type == 'ARMATURE')
    act = other.animation_data.action; act.name = name; act.use_fake_user = True
    for o in new: bpy.data.objects.remove(o, do_unlink=True)

# one NLA track per clip so the glTF exporter writes them as separate animations
ad = arm.animation_data
for act in [a for a in bpy.data.actions]:
    tr = ad.nla_tracks.new(); tr.name = act.name
    st = tr.strips.new(act.name, int(act.frame_range[0]), act)
    if hasattr(st, 'action_slot') and len(act.slots): st.action_slot = act.slots[0]
    tr.mute = True
ad.action = None

# rest pose for measuring
bpy.context.scene.frame_set(1)
for pb in arm.pose.bones: pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
bpy.context.view_layer.update()
bone = lambda n: arm.matrix_world @ arm.data.bones['mixamorig:' + n].head_local
hip_z, knee_z = bone('Hips').z, bone('LeftLeg').z
head_z, top_z = bone('Head').z, bone('HeadTop_End').z if 'mixamorig:HeadTop_End' in arm.data.bones else bone('Head').z + .2
short_lo, short_hi = knee_z + .42 * (hip_z - knee_z), hip_z + .09

skin = material('skin', '#c48a63', .52)
shorts = material('shorts', '#1d1d22', .62)
band = material('band', '#f2f2f2', .45)
hair = material('hair', '#1a1411', .85)
glove = material('glove', '#141416', .4, coat=.3)
glove_trim = material('glove_trim', '#d22c3a', .45)

for o in meshes:
    o.data.materials.clear()
    for m in (skin, shorts, band, hair): o.data.materials.append(m)
    mw = o.matrix_world
    gi = {g.index: g.name for g in o.vertex_groups}
    head_w = {}
    for v in o.data.vertices:
        head_w[v.index] = sum(g.weight for g in v.groups if gi.get(g.group, '').endswith(('Head', 'HeadTop_End')))
    for f in o.data.polygons:
        zs = [(mw @ o.data.vertices[i].co).z for i in f.vertices]
        z = sum(zs) / len(zs)
        hw = sum(head_w[i] for i in f.vertices) / len(f.vertices)
        if short_lo < z < short_hi: f.material_index = 2 if z > short_hi - .045 else 1
        elif hw > .6 and z > head_z + .62 * (top_z - head_z): f.material_index = 3
        else: f.material_index = 0
    for f in o.data.polygons: f.use_smooth = True

# gloves: padded knuckle block + wrist strap, parented to the hand bones
def glove_for(side):
    hb = arm.data.bones[f'mixamorig:{side}Hand']
    head, tail = arm.matrix_world @ hb.head_local, arm.matrix_world @ hb.tail_local
    d = (tail - head); L = max(d.length, .05)
    rot = d.to_track_quat('Y', 'Z').to_matrix().to_4x4()
    objs = []
    bpy.ops.mesh.primitive_cube_add(size=1)
    pad = bpy.context.object; pad.name = f'Glove{side}'; pad.scale = (.095, L * 1.9, .085)
    bpy.ops.object.transform_apply(scale=True)
    bv = pad.modifiers.new('bevel', 'BEVEL'); bv.width = .03; bv.segments = 5
    bpy.ops.object.modifier_apply(modifier='bevel')
    pad.matrix_world = Matrix.Translation(head + d.normalized() * L * .95) @ rot
    pad.data.materials.append(glove); objs.append(pad)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=.05, depth=.06)
    strap = bpy.context.object; strap.name = f'Strap{side}'
    strap.matrix_world = Matrix.Translation(head + d.normalized() * .005) @ rot @ Matrix.Rotation(math.pi / 2, 4, 'X')
    strap.data.materials.append(glove_trim); objs.append(strap)
    for o in objs:
        for p in o.data.polygons: p.use_smooth = True
        mwk = o.matrix_world.copy()
        o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = hb.name
        o.matrix_world = mwk
    return objs

gl = glove_for('Left') + glove_for('Right')

if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 700, 900
    sc.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = srgb('#20283a'); w.node_tree.nodes['Background'].inputs[1].default_value = .8
    ad.nla_tracks['idle'].mute = False; sc.frame_set(30)
    cd = bpy.data.cameras.new('c'); cd.lens = 55; cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (1.6, -4.2, 1.35); cam.rotation_euler = (math.radians(86), 0, math.radians(21))
    for loc, e, col in [((2.5, -3, 4), 900, '#fff2e6'), ((-3, 2, 3), 700, '#5a8cff'), ((3, 3, 2), 500, '#ff6070')]:
        ld = bpy.data.lights.new('l', 'AREA'); ld.energy = e; ld.size = 3; ld.color = srgb(col)[:3]
        lo = bpy.data.objects.new('l', ld); sc.collection.objects.link(lo); lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = PREVIEW; bpy.ops.render.render(write_still=True)
    ad.nla_tracks['idle'].mute = True

bpy.ops.object.select_all(action='DESELECT')
for o in [arm] + meshes + gl: o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_yup=True, export_apply=False, export_morph=False)
print('EXPORTED', OUT, [t.name for t in ad.nla_tracks])
