"""The VERSUS title belt for the 3D fights: for every fighter body, a belt slung over the right shoulder (and a
second over the left, for a double champion), skinned to the chest bone so it moves with the walk. Also renders a
flat picture of the belt for the broadcast graphics.

Run: blender -b --factory-startup -P scripts/art/build_belts.py -- <models_dir> <out_models_dir> <out_art_png> okafor volkov ...
"""
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import belt

a = sys.argv[sys.argv.index('--') + 1:]
MODELS, OUT, ART, NAMES = a[0], a[1], a[2], a[3:]

def new_objects(before):
    return [o for o in bpy.data.objects if o not in before]

def bake(objs, name):
    """turn the belt parts (meshes, text, empties) into one mesh object in world space"""
    bpy.ops.object.select_all(action='DESELECT')
    meshes = []
    for o in objs:
        if o.type == 'FONT':
            o.data.resolution_u = 2; o.data.bevel_resolution = 0   # small lettering: keep the polygon count down for the web
            bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    bpy.context.view_layer.update()
    for o in objs:
        if o.name not in bpy.data.objects or o.type != 'MESH': continue
        for m in list(o.modifiers):
            bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=m.name)
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw; meshes.append(o)
    for o in objs:
        if o.name in bpy.data.objects and o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    out = bpy.context.view_layer.objects.active; out.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return out

for name in NAMES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, f'fighter-{name}.glb'))
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    if rig.animation_data: rig.animation_data.action = None
    for pb in rig.pose.bones: pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    W = rig.matrix_world
    B = lambda n: W @ rig.pose.bones['mixamorig:' + n].head
    neck, chest, spine = B('Neck'), B('Spine2'), B('Spine1')
    M = belt.materials()
    made = []
    for side, s in (('R', -1), ('L', 1)):
        before = set(bpy.data.objects)
        sh = B('RightArm' if side == 'R' else 'LeftArm')
        sx = sh.x * .5 + neck.x * .5; fy = chest.y - .13          # over the collarbone, on the front of the chest (faces -Y)
        pts = [(sx + s * .04, fy + .01, spine.z + .02), (sx, fy, chest.z - .02), (sx, fy + .02, sh.z - .02), (sx, chest.y - .07, sh.z + .085),
               (sx, chest.y + .02, sh.z + .125), (sx, chest.y + .1, sh.z + .075), (sx, chest.y + .15, sh.z - .12), (sx + s * .02, chest.y + .15, sh.z - .4)]
        nrm = [(0, -1, 0), (0, -1, .05), (0, -.95, .3), (0, -.6, .8), (0, 0, 1), (0, .6, .8), (0, .98, .2), (0, 1, 0)]
        P, N = belt.ribbon(M, pts, nrm, width=.08, thick=.009)
        plate = belt.make_plate(M, scale=.74)
        belt.place(plate, Vector((sx + s * .045, fy - .03, chest.z - .05)), Vector((s * .06, -1, .1)), tilt=s * -.08)
        for i in (len(P) // 6, len(P) * 4 // 6):
            sp = belt.make_side_plate(M); belt.place(sp, P[i] + N[i] * .011, N[i])
        o = bake(new_objects(before), f'belt_{side}')
        g = o.vertex_groups.new(name='mixamorig:Spine2'); g.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
        o.data.transform(rig.matrix_world.inverted()); o.matrix_world = rig.matrix_world.copy()
        o.parent = rig; o.matrix_parent_inverse.identity()
        mod = o.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
        made.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in made: o.select_set(True)
    rig.select_set(True); bpy.context.view_layer.objects.active = rig
    path = os.path.join(OUT, f'belt-{name}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_yup=True, export_apply=False, export_morph=False)
    print('BELT', name, os.path.getsize(path))

# ---- a flat picture of the belt for the broadcast graphics (front on, strap laid straight) ----
bpy.ops.wm.read_factory_settings(use_empty=True)
M = belt.materials()
pts = [(-.62, 0, 0), (-.3, 0, .005), (0, 0, .01), (.3, 0, .005), (.62, 0, 0)]
P, N = belt.ribbon(M, pts, [(0, -1, 0)] * 5, width=.11, thick=.01)
plate = belt.make_plate(M, scale=1.0); belt.place(plate, Vector((0, -.02, .005)), Vector((0, -1, 0)))
for x in (-.42, -.27, .27, .42):
    sp = belt.make_side_plate(M, r=.05); belt.place(sp, Vector((x, -.012, 0)), Vector((0, -1, 0)))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = True
sc.render.film_transparent = True; sc.render.resolution_x, sc.render.resolution_y = 1000, 420
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = .6
cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 1.42
cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -3, .02); cam.rotation_euler = (math.pi / 2, 0, 0)
for loc, e in [((1.5, -2.5, 2), 380), ((-2, -2, -.5), 160), ((0, -3, 0), 60)]:
    ld = bpy.data.lights.new('l', 'AREA'); ld.energy = e; ld.size = 2
    lo = bpy.data.objects.new('l', ld); sc.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
sc.render.image_settings.file_format = 'WEBP'; sc.render.image_settings.quality = 90; sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = ART; bpy.ops.render.render(write_still=True)
print('ART', ART)
