"""Render a tale-of-the-tape portrait for each fighter model: waist-up, guard up, studio key light with
red/blue rims, transparent background -> public/fighters/<model>.webp

Run: blender -b --factory-startup -P scripts/art/render_portraits.py -- <models_dir> <out_dir> okafor volkov ...
"""
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
MODELS, OUT = args[0], args[1]
names = [a for a in args[2:] if not a.startswith('--only=')]
ONLY = next((a[7:].split(',') for a in args[2:] if a.startswith('--only=')), [])   # e.g. --only=stance
os.makedirs(OUT, exist_ok=True)

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)

for name in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, f'fighter-{name}.glb'))
    for o in [o for o in bpy.data.objects if o.name.startswith('Icosphere')]: bpy.data.objects.remove(o, do_unlink=True)
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    # a few body triangles inside the shorts kept the skin material (a dark patch at the crotch): give them the shorts' cloth
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        names = [m.name if m else '' for m in o.data.materials]
        if 'Human.body' not in names or 'shorts' not in names: continue
        skin, cloth, me = names.index('Human.body'), names.index('shorts'), o.data
        pts = [me.vertices[v].co for p in me.polygons if p.material_index == cloth for v in p.vertices]
        z0, z1 = min(p.z for p in pts), max(p.z for p in pts); cx = sum(p.x for p in pts) / len(pts); cy = sum(p.y for p in pts) / len(pts)
        rad = max(math.hypot(p.x - cx, p.y - cy) for p in pts)
        for p in me.polygons:
            c = p.center
            if p.material_index == skin and z0 + (z1 - z0) * .12 < c.z < z1 - (z1 - z0) * .06 and math.hypot(c.x - cx, c.y - cy) < rad * .97: p.material_index = cloth
    ad = rig.animation_data or rig.animation_data_create()
    for t in ad.nla_tracks: t.mute = True
    act = bpy.data.actions.get('idle')
    ad.action = act
    if act.slots: ad.action_slot = act.slots[0]
    sc = bpy.context.scene; sc.frame_set(12); bpy.context.view_layer.update()
    # broadcast stance: standing tall, square to camera, arms relaxed at the sides, fists closed.
    # Keep the closed fists from the clip, drop everything else back to the rest pose, then aim the limbs.
    fingers = {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones if 'Hand' in pb.name and pb.name[-1].isdigit()}
    ad.action = None
    for pb in rig.pose.bones: pb.matrix_basis.identity()
    for n, m in fingers.items(): rig.pose.bones[n].matrix_basis = m
    bpy.context.view_layer.update()
    def aim(name, d):
        pb = rig.pose.bones['mixamorig:' + name]
        wm = rig.matrix_world @ pb.matrix
        cur = (rig.matrix_world @ pb.tail) - (rig.matrix_world @ pb.head)
        rot = cur.normalized().rotation_difference(Vector(d).normalized())
        h = wm.translation.copy()
        pb.matrix = rig.matrix_world.inverted() @ (Matrix.Translation(h) @ rot.to_matrix().to_4x4() @ Matrix.Translation(-h) @ wm)
        bpy.context.view_layer.update()
    for side, s in (('Left', 1), ('Right', -1)):          # character faces -Y, his left is +X
        aim(side + 'UpLeg', (s * .1, 0, -1)); aim(side + 'Leg', (s * .03, .02, -1)); aim(side + 'Foot', (s * .15, -.8, -.55))
        aim(side + 'Arm', (s * .32, .04, -1)); aim(side + 'ForeArm', (s * .14, -.18, -1)); aim(side + 'Hand', (s * .05, -.12, -1))
    aim('Spine', (0, .02, 1)); aim('Spine1', (0, .0, 1)); aim('Spine2', (0, -.02, 1)); aim('Neck', (0, -.06, 1)); aim('Head', (0, -.04, 1))
    bpy.context.view_layer.update()
    head = rig.matrix_world @ rig.pose.bones['mixamorig:Head'].head
    hips = rig.matrix_world @ rig.pose.bones['mixamorig:Hips'].head
    focus = (head + hips) / 2 + Vector((0, 0, .02))
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = True
    sc.render.film_transparent = True; sc.render.resolution_x, sc.render.resolution_y = 720, 1100
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.render.image_settings.file_format = 'WEBP'; sc.render.image_settings.quality = 86; sc.render.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (*srgb('#10131c'), 1); w.node_tree.nodes['Background'].inputs[1].default_value = .4
    cd = bpy.data.cameras.new('c'); cd.lens = 72; cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
    # head to knees, slightly low and to the side so he looms (broadcast hero framing)
    cam.location = focus + Vector((.3, -3.3, -.22)); cam.rotation_euler = (focus - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for loc, e, col, size in [((1.4, -2.4, 2.2), 260, '#fff1e2', 2.0), ((-2.0, 1.0, 1.6), 380, '#ff3a55', 1.0), ((2.2, 1.0, 1.4), 380, '#3a6bff', 1.0), ((0, -3, 0), 45, '#ffffff', 3)]:
        ld = bpy.data.lights.new('l', 'AREA'); ld.energy = e; ld.size = size; ld.color = srgb(col)
        lo = bpy.data.objects.new('l', ld); sc.collection.objects.link(lo); lo.location = focus + Vector(loc)
        lo.rotation_euler = (focus - lo.location).to_track_quat('-Z', 'Y').to_euler()
    if 'stance' not in ONLY:
        sc.render.filepath = os.path.join(OUT, f'{name}.webp')
        bpy.ops.render.render(write_still=True)
        print('PORTRAIT', name)

    # ---- stance version (loading / tale of the tape): hands up in his fighting guard, same framing ----
    standing = {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones}
    ad.action = act
    if act.slots: ad.action_slot = act.slots[0]
    sc.frame_set(12); bpy.context.view_layer.update()
    if not ONLY or 'stance' in ONLY:
        sc.render.filepath = os.path.join(OUT, f'{name}-stance.webp')
        bpy.ops.render.render(write_still=True)
        print('PORTRAIT', name, 'stance')
    ad.action = None
    for pb in rig.pose.bones: pb.matrix_basis = standing[pb.name]
    bpy.context.view_layer.update()
    # ---- two-division champion: a title belt over each shoulder, a fist on each strap ----
    if 'double' in ONLY:
        import belt
        M = belt.materials(); W = rig.matrix_world
        for side, s in (('Right', -1), ('Left', 1)):
            aim(side + 'Arm', (s * .3, -.2, -.93)); aim(side + 'ForeArm', (-s * .3, -.55, .78)); aim(side + 'Hand', (-s * .3, -.5, .8))
        bpy.context.view_layer.update()
        B = lambda n: W @ rig.pose.bones['mixamorig:' + n].head
        neck, chest = B('Neck'), B('Spine2')
        for side, s in (('Right', -1), ('Left', 1)):
            sh, hand = B(side + 'Arm'), W @ rig.pose.bones[f'mixamorig:{side}Hand'].tail
            sx = sh.x * .55 + neck.x * .45; fy = chest.y - .15
            pts = [(hand.x, hand.y - .03, hand.z - .03), (sx, fy, chest.z + .02), (sx, fy + .02, sh.z - .02), (sx, chest.y - .07, sh.z + .09),
                   (sx, chest.y + .02, sh.z + .13), (sx, chest.y + .1, sh.z + .08), (sx, chest.y + .15, sh.z - .12), (sx, chest.y + .15, sh.z - .38)]
            nrm = [(0, -1, 0), (0, -1, .05), (0, -.95, .3), (0, -.6, .8), (0, 0, 1), (0, .6, .8), (0, .98, .2), (0, 1, 0)]
            belt.ribbon(M, pts, nrm, width=.075, thick=.009)
            plate = belt.make_plate(M, scale=.74)
            belt.place(plate, Vector((sh.x * .72 + neck.x * .28, fy - .05, chest.z - .03)), Vector((s * .1, -1, .12)), tilt=s * .06)
        sc.render.filepath = os.path.join(OUT, f'{name}-double.webp')
        bpy.ops.render.render(write_still=True)
        print('PORTRAIT', name, 'double')
        continue
    if ONLY and 'champ' not in ONLY: continue

    # ---- champion version: the title belt slung over the right shoulder, right hand gripping the strap ----
    import belt
    aim('RightArm', (-.16, -.32, -.93)); aim('RightForeArm', (.86, -.48, .02)); aim('RightHand', (.92, -.34, .05))
    bpy.context.view_layer.update()
    W = rig.matrix_world
    B = lambda n: W @ rig.pose.bones['mixamorig:' + n].head
    sh, neck, chest, hand = B('RightArm'), B('Neck'), B('Spine2'), W @ rig.pose.bones['mixamorig:RightHand'].tail
    M = belt.materials()
    # path over the shoulder: from the fist on the chest, up the front of the shoulder (plate), over the top, down the back
    sx = sh.x * .42 + neck.x * .58                  # between the neck and the shoulder joint, over the collarbone
    fy = chest.y - .13                              # front of the chest (character faces -Y)
    pts = [(hand.x - .02, hand.y - .035, hand.z - .06), (sx, fy, chest.z - .06), (sx, fy + .02, sh.z - .02), (sx, chest.y - .07, sh.z + .09),
           (sx, chest.y + .02, sh.z + .13), (sx, chest.y + .1, sh.z + .08), (sx + .01, chest.y + .15, sh.z - .12), (sx + .02, chest.y + .15, sh.z - .38)]
    nrm = [(0, -1, 0), (0, -1, .05), (0, -.95, .3), (0, -.6, .8), (0, 0, 1), (0, .6, .8), (0, .98, .2), (0, 1, 0)]
    P, N = belt.ribbon(M, pts, nrm, width=.085, thick=.009)
    plate = belt.make_plate(M, scale=.95)
    belt.place(plate, Vector((sx + (neck.x - sh.x) * .15, fy - .014, chest.z + .07)), Vector((.1, -1, .15)), tilt=-.1)
    for i in (len(P) // 7, len(P) * 5 // 7):     # side plates along the strap
        sp = belt.make_side_plate(M); belt.place(sp, P[i] + N[i] * .011, N[i])
    sc.render.filepath = os.path.join(OUT, f'{name}-champ.webp')
    bpy.ops.render.render(write_still=True)
    print('PORTRAIT', name, 'champ')