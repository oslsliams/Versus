"""Build the game model for Dario Vale (UNSEEN Interactive's customizable fighter) from his .blend.

His skeleton uses Unreal-style names (pelvis, spine_01, upperarm_l ...) and an A-pose. The game's 48 fight clips
target the Mixamo skeleton in a T-pose. So we:
  1. rename his bones and vertex groups to the Mixamo names,
  2. re-pose every bone to the orientation it has in the game's rig (T-pose), bake that into the meshes and make
     it his rest pose (so clip rotations copy straight across),
  3. copy all clips from an existing fighter GLB, scaling the hip travel to his height,
  4. keep every hairstyle, tattoo and pair of shorts as a named, switchable part (var_hair_*, var_ink_*, var_shorts_*).

Run: blender -b --disable-autoexec -P scripts/art/build_dario.py -- <dario.blend> <clips_source_fighter.glb> <out.glb>
"""
import bpy, sys, re
from mathutils import Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
SRC_BLEND, CLIPS_GLB, OUT = args[0], args[1], args[2]

MAP = {'pelvis': 'Hips', 'spine_01': 'Spine', 'spine_02': 'Spine1', 'spine_03': 'Spine2', 'neck_01': 'Neck', 'head': 'Head'}
for s, S in (('l', 'Left'), ('r', 'Right')):
    MAP.update({f'clavicle_{s}': f'{S}Shoulder', f'upperarm_{s}': f'{S}Arm', f'lowerarm_{s}': f'{S}ForeArm', f'hand_{s}': f'{S}Hand',
                f'thigh_{s}': f'{S}UpLeg', f'calf_{s}': f'{S}Leg', f'foot_{s}': f'{S}Foot', f'ball_{s}': f'{S}ToeBase'})
    for f, F in (('index', 'Index'), ('middle', 'Middle'), ('ring', 'Ring'), ('pinky', 'Pinky'), ('thumb', 'Thumb')):
        for i in (1, 2, 3): MAP[f'{f}_0{i}_{s}'] = f'{S}Hand{F}{i}'

bpy.ops.wm.open_mainfile(filepath=SRC_BLEND, load_ui=False)
scene = bpy.context.scene
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
rig.name = 'Dario'
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
for o in bpy.data.objects:   # everything visible and selectable while we work
    o.hide_set(False); o.hide_viewport = False; o.hide_render = False; o.hide_select = False
print('SOURCE', rig.name, len(rig.data.bones), 'bones,', len(meshes), 'skinned meshes')

# ---- 1. names ------------------------------------------------------------------------------
for b in rig.data.bones:
    if b.name in MAP: b.name = 'mixamorig:' + MAP[b.name]   # renaming a bone renames the matching vertex groups too
missing = [k for k in MAP.values() if ('mixamorig:' + k) not in rig.data.bones]
print('RENAMED, missing:', missing)
# the hips must be the top bone (like the Mixamo rig): under his Z-up 'Root' bone the game's in-place filter
# would freeze the wrong axes (height instead of travel)
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = rig.data.edit_bones; rb = eb.get('Root')
if rb:
    for ch in list(rb.children): ch.parent = None
    eb.remove(rb)
bpy.ops.object.mode_set(mode='OBJECT')
for o in bpy.data.objects:
    g = o.vertex_groups.get('Root') if o.type == 'MESH' else None
    if g: o.vertex_groups.remove(g)
print('ROOT removed:', 'Root' not in rig.data.bones)

# ---- shorts and tattoos: their 3-4 hand-set weight groups make the panels move rigidly and tear at the seams;
#      give them the body's own skin weights (nearest surface, interpolated) so they deform with the skin
body_obj = max((o for o in meshes if 'skin' in ' '.join(s.material.name for s in o.material_slots if s.material).lower()), key=lambda o: len(o.data.vertices))
for o in meshes:
    if not (o.name.startswith('Shorts') or o.name.startswith('UNSEEN') or o.name.startswith('Ink')): continue
    for g in list(o.vertex_groups): o.vertex_groups.remove(g)
    dt = o.modifiers.new('wt', 'DATA_TRANSFER'); dt.object = body_obj
    dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.datalayout_transfer(modifier='wt')
        bpy.ops.object.modifier_move_to_index(modifier='wt', index=0); bpy.ops.object.modifier_apply(modifier='wt')
print('WEIGHTS transferred from', body_obj.name, 'to shorts and tattoos')

# ---- heavy hair: decimate the two dense coil meshes so the file stays web-sized ------------
for o in meshes:
    if len(o.data.vertices) > 30000 and not o.name.startswith('Hair 01'):   # the default close coils stay at full detail
        d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = .4
        bpy.context.view_layer.objects.active = o
        with bpy.context.temp_override(object=o, active_object=o): bpy.ops.object.modifier_move_to_index(modifier='dec', index=0); bpy.ops.object.modifier_apply(modifier='dec')
        print('DECIMATED', o.name, len(o.data.vertices))

# ---- 2. rest pose = the game rig's T-pose -------------------------------------------------
before = set(bpy.data.objects); before_a = set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=CLIPS_GLB)
src_objs = [o for o in bpy.data.objects if o not in before]
src = next(o for o in src_objs if o.type == 'ARMATURE')
SW = src.matrix_world
src_rest = {b.name: (SW @ b.matrix_local).to_quaternion() for b in src.data.bones}
src_hips_z = (SW @ src.data.bones['mixamorig:Hips'].matrix_local).translation.z
src_head_z = (SW @ src.data.bones['mixamorig:Head'].matrix_local).translation.z
src_actions = [a for a in bpy.data.actions if a not in before_a]
print('CLIPS', len(src_actions), [a.name for a in src_actions][:6])

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
for o in meshes:
    for md in list(o.modifiers):
        if md.type == 'ARMATURE':
            with bpy.context.temp_override(object=o, active_object=o): bpy.ops.object.modifier_apply(modifier=md.name)
            nm = o.modifiers.new('Armature', 'ARMATURE'); nm.object = rig
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
# solidify (gloves, shorts) is baked so the exporter sees real thickness
for o in meshes:
    for md in list(o.modifiers):
        if md.type == 'SOLIDIFY':
            with bpy.context.temp_override(object=o, active_object=o): bpy.ops.object.modifier_move_to_index(modifier=md.name, index=0); bpy.ops.object.modifier_apply(modifier=md.name)
print('REST', 'matched to the game rig T-pose')

# ---- 3. clips ------------------------------------------------------------------------------
RW = rig.matrix_world
tgt_hips_z = (RW @ rig.data.bones['mixamorig:Hips'].matrix_local).translation.z
tgt_head_z = (RW @ rig.data.bones['mixamorig:Head'].matrix_local).translation.z
hscale = tgt_hips_z / src_hips_z
print('HEIGHT', 'head', round(tgt_head_z, 3), 'vs', round(src_head_z, 3), 'hips scale', round(hscale, 3))
rig.animation_data_create()
names = []
for a in src_actions:
    name = re.sub(r'(_mixamorig.*|_Armature.*|\.\d+)$', '', a.name)
    act = a.copy(); act.name = name; act.use_fake_user = True
    for fc in getattr(act, 'fcurves', []) or []:
        pass
    # Blender 5.x: f-curves live in channelbags per layer/strip/slot
    def curves(ac):
        out = []
        for layer in getattr(ac, 'layers', []):
            for strip in layer.strips:
                for cb in strip.channelbags: out.extend(cb.fcurves)
        return out or list(getattr(ac, 'fcurves', []))
    for fc in curves(act):
        if fc.data_path.endswith('location') and 'mixamorig:Hips' in fc.data_path:
            for k in fc.keyframe_points: k.co[1] *= hscale; k.handle_left[1] *= hscale; k.handle_right[1] *= hscale
        elif fc.data_path.endswith('location') or fc.data_path.endswith('scale'):
            # only the hips travel; other bones' translation/scale tracks would pull his proportions toward the source body
            for k in fc.keyframe_points: pass
    # drop non-hip location and all scale curves (they encode the source body's proportions)
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for cb in strip.channelbags:
                for fc in [f for f in cb.fcurves if (f.data_path.endswith('location') and 'mixamorig:Hips' not in f.data_path) or f.data_path.endswith('scale')]:
                    cb.fcurves.remove(fc)
    f0, f1 = act.frame_range
    tr = rig.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, int(f0), act)
    if hasattr(st, 'action_slot') and len(act.slots): st.action_slot = act.slots[0]
    tr.mute = True; names.append(name)
print('CLIPS COPIED', len(names), names)
for o in src_objs: bpy.data.objects.remove(o, do_unlink=True)
for a in src_actions: bpy.data.actions.remove(a)

# ---- materials the glTF exporter can't read ------------------------------------------------
# skin: vertex colours multiplied by a tone in the shader -> bake the tone into the vertex colours, link them directly
import numpy as np
def srgb_to_lin(c): return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
def lin_to_srgb(c): c = np.clip(c, 0, 1); return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)
for m in bpy.data.materials:
    if not m.use_nodes: continue
    nt = m.node_tree; p = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not p or not p.inputs['Base Color'].is_linked: continue
    src_node = p.inputs['Base Color'].links[0].from_node
    if src_node.type == 'MIX_RGB' and src_node.inputs['Color1'].is_linked and src_node.inputs['Color1'].links[0].from_node.type == 'VERTEX_COLOR':
        tone = np.array(src_node.inputs['Color2'].default_value[:3])
        attr_node = src_node.inputs['Color1'].links[0].from_node
        for o in meshes:
            if m.name not in [s.material.name for s in o.material_slots if s.material]: continue
            ca = o.data.color_attributes.get(attr_node.layer_name) if attr_node.layer_name else o.data.color_attributes.active_color
            if not ca: continue
            n = len(ca.data); buf = np.empty(n * 4, dtype=np.float32); ca.data.foreach_get('color', buf); buf = buf.reshape(n, 4)
            buf[:, :3] *= tone; ca.data.foreach_set('color', buf.ravel())
            o.data.color_attributes.active_color = ca
        nt.links.new(attr_node.outputs['Color'], p.inputs['Base Color'])
        print('BAKED skin tone into vertex colours', m.name, tone.round(3))
        # the scalp under the hair: darken it so the gaps between coils read as dense hair, not bare skin
        from mathutils.kdtree import KDTree
        hair = next((o for o in meshes if o.name.startswith('Hair 01')), None)
        body = next((o for o in meshes if m.name in [s.material.name for s in o.material_slots if s.material] and len(o.data.vertices) > 5000), None)
        if hair and body:
            kd = KDTree(len(hair.data.vertices))
            for i, v in enumerate(hair.data.vertices): kd.insert(hair.matrix_world @ v.co, i)
            kd.balance()
            ca = body.data.color_attributes.active_color
            dark = np.array([.035, .022, .018]); n_dark = 0
            corner = ca.domain == 'CORNER'
            vert_of = [l.vertex_index for l in body.data.loops] if corner else None
            near = {}
            for vi, v in enumerate(body.data.vertices):
                co, _, dist = kd.find(body.matrix_world @ v.co)
                if dist < .012: near[vi] = 1 - dist / .012
            for idx, item in enumerate(ca.data):
                vi = vert_of[idx] if corner else idx
                t = near.get(vi)
                if t is None: continue
                c = np.array(item.color[:3]); item.color = (*(c + (dark - c) * min(1, t * 1.4)), 1); n_dark += 1
            print('SCALP darkened', n_dark, 'colour entries')
    elif src_node.type == 'VALTORGB':
        # a colour ramp over a greyscale print -> render the ramp into a real texture
        ramp = src_node.color_ramp; fac = src_node.inputs['Fac']
        img_node = fac.links[0].from_node if fac.is_linked else None
        if not img_node or img_node.type != 'TEX_IMAGE' or not img_node.image: continue
        im = img_node.image; w, h = im.size
        px = np.empty(w * h * 4, dtype=np.float32); im.pixels.foreach_get(px); px = px.reshape(-1, 4)
        lin = srgb_to_lin(px[:, :3]) if im.colorspace_settings.name == 'sRGB' else px[:, :3]
        v = lin @ np.array([.2126, .7152, .0722])
        pos = np.array([e.position for e in ramp.elements]); cols = np.array([e.color[:3] for e in ramp.elements])
        out = np.stack([np.interp(v, pos, cols[:, k]) for k in range(3)], 1)
        new = bpy.data.images.new(f'{m.name} baked', w, h, alpha=False)
        new.pixels.foreach_set(np.concatenate([lin_to_srgb(out), np.ones((len(out), 1))], 1).astype(np.float32).ravel())
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = new
        if img_node.inputs['Vector'].is_linked: nt.links.new(img_node.inputs['Vector'].links[0].from_socket, t.inputs['Vector'])
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
        print('BAKED ramp texture', m.name)

# ---- 4. switchable parts ---------------------------------------------------------------------
def slug(s): return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')
parts = []
for o in meshes:
    n = o.name
    m = re.match(r'Hair (\d+)\s*[-|]\s*(.+)', n)
    if m: o.name = f'var_hair_{int(m.group(1)):02d}'; parts.append((o.name, m.group(2).strip())); continue
    m = re.match(r'Ink (\d+)\s*\|\s*(.+)', n)
    if m: o.name = f'var_ink_{int(m.group(1)):02d}'; parts.append((o.name, m.group(2).strip())); continue
    m = re.match(r'(?:Shorts\s*[-|]\s*|UNSEEN \| )(.+?)(?: Fight Shorts)?$', n)
    if m and 'Shorts' in n: o.name = f'var_shorts_{slug(m.group(1))}'; parts.append((o.name, m.group(1).strip())); continue
print('PARTS', parts)
bpy.ops.object.select_all(action='DESELECT')
for o in [rig] + meshes: o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_yup=True, export_apply=False, export_morph=False, export_image_format='JPEG', export_jpeg_quality=82)
print('EXPORTED', OUT)
