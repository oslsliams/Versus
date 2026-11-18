"""Visual check for the cosmetics: composites tattoo masks onto a fighter's skin (the same way the game
does), loads the gear GLB on top, and renders front / back / side views to one contact sheet.

Run: blender -b --factory-startup -P scripts/art/check_cosmetics.py -- <models_dir> <cosmetics_dir> <out.png> <body> [tattoo,ids] [gear,ids]
"""
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
MODELS, COS, OUT, BODY = a[0], a[1], a[2], a[3]
TATS = a[4].split(',') if len(a) > 4 and a[4] != '-' else None
GEAR = a[5].split(',') if len(a) > 5 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, f'fighter-{BODY}.glb'))
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
if rig.animation_data: rig.animation_data.action = None
rig.data.pose_position = 'REST'
for o in [o for o in bpy.data.objects if o.name.startswith('Icosphere')]: bpy.data.objects.remove(o, do_unlink=True)
man = json.load(open(os.path.join(COS, 'tattoos.json')))
S = man['size']
mat = bpy.data.materials['Human.body']
tex = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE')
src = tex.image; src.scale(S, S)
px = np.empty(S * S * 4, np.float32); src.pixels.foreach_get(px); px = px.reshape(S, S, 4)
ink = np.array([.16, .17, .2], np.float32)
for tid, r in man['tattoos'].items():
    if TATS and tid not in TATS: continue
    m = bpy.data.images.load(os.path.join(COS, 'tattoos', f'{tid}.png'))
    mp = np.empty(r['w'] * r['h'] * 4, np.float32); m.pixels.foreach_get(mp); mp = mp.reshape(r['h'], r['w'], 4)[:, :, 3:4] * .9
    y0 = S - (r['y'] + r['h'])                    # back to Blender's bottom-left rows
    reg = px[y0:y0 + r['h'], r['x']:r['x'] + r['w'], :3]
    px[y0:y0 + r['h'], r['x']:r['x'] + r['w'], :3] = reg * (1 - mp) + reg * ink * mp * 1.0
src.pixels.foreach_set(px.ravel()); src.update()
gp = os.path.join(COS, f'gear-{BODY}.glb')
if os.path.exists(gp) and GEAR != ['-']:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=gp)
    for o in set(bpy.data.objects) - before:
        if o.type == 'MESH' and not o.name.startswith('Icosphere'):
            if GEAR and not any(g in o.name for g in GEAR): o.hide_render = True
            for md in o.modifiers:
                if md.type == 'ARMATURE': md.object = rig
            o.parent = rig
        elif o.type in ('ARMATURE',) or o.name.startswith('Icosphere'): o.hide_render = True
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[1].default_value = 1.2
sc.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'
for loc, e in [((2, -3, 3), 4), ((-2, 3, 2), 3)]:
    l = bpy.data.objects.new('l', bpy.data.lights.new('l', 'SUN')); l.data.energy = e; sc.collection.objects.link(l)
    l.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
shots = []
for i, (d, zc, sc_) in enumerate([((0, -1, 0), .95, 2.0), ((0, 1, 0), .95, 2.0), ((1, 0, 0), .95, 2.0), ((-1, 0, 0), .95, 2.0), ((0, -1, 0), 1.3, .7), ((-1, -.3, 0), 1.25, .8)]):
    cam.data.ortho_scale = sc_
    cam.location = Vector((0, 0, zc)) + Vector(d).normalized() * 3
    cam.rotation_euler = (-Vector(d)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = 600, 900
    p = OUT.replace('.png', f'_{i}.png'); sc.render.filepath = p; bpy.ops.render.render(write_still=True); shots.append(p)
# contact sheet
imgs = [bpy.data.images.load(p) for p in shots]
W, H = 600, 900
sheet = np.zeros((H * 2, W * 3, 4), np.float32)
for k, im in enumerate(imgs):
    q = np.empty(W * H * 4, np.float32); im.pixels.foreach_get(q); q = q.reshape(H, W, 4)
    r, c = 1 - k // 3, k % 3
    sheet[r * H:(r + 1) * H, c * W:(c + 1) * W] = q
out = bpy.data.images.new('sheet', W * 3, H * 2, alpha=True); out.pixels.foreach_set(sheet.ravel())
out.filepath_raw = OUT; out.file_format = 'PNG'; out.save()
for p in shots: os.remove(p)
print('SHEET', OUT)
