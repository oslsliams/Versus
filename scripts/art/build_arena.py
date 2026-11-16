"""Build the VERSUS arena (original design, references: modern MMA arenas).
White canvas octagon with VERSUS / Unseen Interactive marks, black padded cage with
chain-link fence, raised apron, tiered crowd, lighting truss and hanging screens.

Run: blender -b --factory-startup -P scripts/art/build_arena.py -- <out.glb> <unseen_icon.svg> [preview.png]
"""
import bpy, bmesh, sys, math, random
import numpy as np
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
OUT, ICON = args[0], args[1]
PREVIEW = args[2] if len(args) > 2 else None
random.seed(7)
R = 4.6          # octagon radius (to the corner), metres
H = 1.85         # fence height
PLAT = .9        # mat height above arena floor

def srgb(h, a=1):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c) + (a,)

def mat(name, color, rough=.6, metal=0., emit=None, strength=1.):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = srgb(color); p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metal
    if emit: p.inputs['Emission Color'].default_value = srgb(emit); p.inputs['Emission Strength'].default_value = strength
    return m

def link(o): bpy.context.collection.objects.link(o); return o
def mesh_obj(name, bm, m):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(m)
    for p in me.polygons: p.use_smooth = False
    return link(bpy.data.objects.new(name, me))

bpy.ops.wm.read_factory_settings(use_empty=True)
corners = [Vector((R * math.cos(math.pi / 8 + i * math.pi / 4), R * math.sin(math.pi / 8 + i * math.pi / 4), 0)) for i in range(8)]

M = dict(
    canvas=mat('canvas', '#f2f3f5', .78), ink=mat('ink', '#111216', .7), lime=mat('lime', '#9fd13a', .6),
    pad=mat('pad', '#16171b', .55), fence=None, apron=mat('apron', '#0d0e12', .7), floor=mat('floor', '#08090c', .8),
    seat=mat('seat', '#101320', .8), truss=mat('truss', '#2a2d36', .35, .8), white=mat('white', '#e9ebf0', .5),
    screen_a=mat('screen_a', '#000000', .4, emit='#2b6cff', strength=4.), screen_b=mat('screen_b', '#000000', .4, emit='#ff3550', strength=4.),
    lamp=mat('lamp', '#000000', .2, emit='#ffffff', strength=25.),
)

# --- chain-link fence texture (alpha mask) --------------------------------
S = 256
yy, xx = np.mgrid[0:S, 0:S] / S * 8
d1 = np.abs(((xx + yy) % 1) - .5); d2 = np.abs(((xx - yy) % 1) - .5)
wire = (np.minimum(d1, d2) < .06).astype(np.float32)
img = bpy.data.images.new('chainlink', S, S, alpha=True)
px = np.zeros((S, S, 4), np.float32); px[..., 0:3] = .05; px[..., 3] = wire
img.pixels = px.ravel(); img.pack()
fm = bpy.data.materials.new('fence'); fm.use_nodes = True
nt = fm.node_tree; p = nt.nodes['Principled BSDF']
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
nt.links.new(tex.outputs['Color'], p.inputs['Base Color']); nt.links.new(tex.outputs['Alpha'], p.inputs['Alpha'])
p.inputs['Roughness'].default_value = .4; p.inputs['Metallic'].default_value = .6
fm.blend_method = 'CLIP' if hasattr(fm, 'blend_method') else None
M['fence'] = fm

# --- mat ------------------------------------------------------------------
bm = bmesh.new(); ring = [bm.verts.new((c.x, c.y, PLAT)) for c in corners]; bm.faces.new(ring)
mesh_obj('mat', bm, M['canvas'])
# octagon inner line (black band) at 86% radius
bm = bmesh.new()
for i in range(8):
    a, b = corners[i] * .86, corners[(i + 1) % 8] * .86
    a2, b2 = corners[i] * .875, corners[(i + 1) % 8] * .875
    vs = [bm.verts.new((v.x, v.y, PLAT + .003)) for v in (a, b, b2, a2)]; bm.faces.new(vs)
mesh_obj('mat_line', bm, M['ink'])
# apron / platform sides
bm = bmesh.new()
top = [bm.verts.new((c.x * 1.08, c.y * 1.08, PLAT - .001)) for c in corners]
bot = [bm.verts.new((c.x * 1.08, c.y * 1.08, 0)) for c in corners]
inner = [bm.verts.new((c.x, c.y, PLAT - .001)) for c in corners]
for i in range(8):
    j = (i + 1) % 8
    bm.faces.new([bot[i], bot[j], top[j], top[i]]); bm.faces.new([inner[i], inner[j], top[j], top[i]])
mesh_obj('apron', bm, M['apron'])

def text(body, size, loc, rot_z, m, extrude=.002, align='CENTER'):
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = body; cu.size = size; cu.extrude = extrude
    cu.align_x = align; cu.align_y = 'CENTER'
    o = link(bpy.data.objects.new('txt_' + body[:8], cu)); o.data.materials.append(m)
    o.location = loc; o.rotation_euler = (0, 0, rot_z)
    return o

texts = []
texts.append(text('VERSUS', .62, (0, -2.25, PLAT + .004), 0, M['ink']))
texts.append(text('VERSUS', .62, (0, 2.25, PLAT + .004), math.pi, M['ink']))
texts.append(text('UNSEEN INTERACTIVE', .2, (2.6, 0, PLAT + .004), math.pi / 2, M['ink']))
texts.append(text('UNSEEN INTERACTIVE', .2, (-2.6, 0, PLAT + .004), -math.pi / 2, M['ink']))
for i in range(8):
    a = math.pi / 8 + i * math.pi / 4 + math.pi / 8
    mid = (corners[i] + corners[(i + 1) % 8]) / 2 * .93
    texts.append(text('VERSUS CHAMPIONSHIP', .11, (mid.x, mid.y, PLAT + .004), a - math.pi / 2, M['ink']))

# center logo: the Unseen eye, from the brand SVG
before = set(bpy.data.objects)
bpy.ops.import_curve.svg(filepath=ICON)
svg = [o for o in bpy.data.objects if o not in before]
for o in svg:
    if o.type == 'CURVE' and len(o.data.splines) == 1 and len(o.data.splines[0].bezier_points) == 4:
        pts = [p.co for p in o.data.splines[0].bezier_points]
        if max(p.x for p in pts) - min(p.x for p in pts) > .1:  # the background square
            bpy.data.objects.remove(o, do_unlink=True); continue
eye = [o for o in bpy.data.objects if o not in before]
for o in eye:
    o.data.materials.clear(); o.data.materials.append(M['lime'])
    o.data.extrude = .0003
bpy.ops.object.select_all(action='DESELECT')
for o in eye: o.select_set(True)
bpy.context.view_layer.objects.active = eye[0]
if len(eye) > 1: bpy.ops.object.join()
logo = bpy.context.view_layer.objects.active
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
dims = max(logo.dimensions.x, logo.dimensions.y) or 1
k = 2.2 / dims
logo.location = (0, 0, PLAT + .004); logo.scale = (k, k, k * .05)
logo.data.bevel_depth = .075 / k; logo.data.bevel_resolution = 2; logo.data.fill_mode = 'FULL'; logo.rotation_euler = (0, 0, 0)
texts.append(logo)

# convert text/curves to meshes for export
bpy.ops.object.select_all(action='DESELECT')
for o in texts: o.select_set(True)
bpy.context.view_layer.objects.active = texts[0]
bpy.ops.object.convert(target='MESH')

# --- cage -----------------------------------------------------------------
def box(name, size, loc, m, rot_z=0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    o = mesh_obj(name, bm, m); o.location = loc; o.rotation_euler = (0, 0, rot_z); return o

for i, c in enumerate(corners):
    a = math.atan2(c.y, c.x)
    post = box(f'post{i}', (.22, .22, H + .1), (c.x, c.y, PLAT + (H + .1) / 2), M['pad'], a)
    t = text('VERSUS', .13, (c.x * .965, c.y * .965, PLAT + 1.05), a + math.pi / 2, M['white'], extrude=.001)
    t.rotation_euler = (math.pi / 2, 0, a + math.pi / 2); t.rotation_mode = 'XYZ'
    t.rotation_euler = (math.pi / 2, 0, a - math.pi / 2); t.data.body = 'VERSUS'; t.location = (c.x * .955, c.y * .955, PLAT + 1.05); t.data.size = .12
    t.rotation_mode = 'ZYX'; t.rotation_euler = (math.pi / 2, math.pi / 2, a + math.pi)
    texts.append(t)
for i in range(8):
    a, b = corners[i], corners[(i + 1) % 8]
    mid, L = (a + b) / 2, (b - a).length
    ang = math.atan2(b.y - a.y, b.x - a.x)
    rail = box(f'rail{i}', (L, .16, .16), (mid.x, mid.y, PLAT + H), M['pad'], ang)
    skirt = box(f'skirt{i}', (L, .1, .32), (mid.x, mid.y, PLAT + .16), M['pad'], ang)
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in [(a.x, a.y, PLAT + .3), (b.x, b.y, PLAT + .3), (b.x, b.y, PLAT + H - .08), (a.x, a.y, PLAT + H - .08)]]
    f = bm.faces.new(vs); uv = bm.loops.layers.uv.new()
    for loop, (u, v) in zip(f.loops, [(0, 0), (L / .45, 0), (L / .45, (H - .38) / .45), (0, (H - .38) / .45)]): loop[uv].uv = (u, v)
    mesh_obj(f'fence{i}', bm, M['fence'])

# --- arena bowl: floor, seating tiers, crowd --------------------------------
bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, radius=40, segments=48)
mesh_obj('arena_floor', bm, M['floor'])
crowd_bm = bmesh.new(); seat_bm = bmesh.new()
shirt = [srgb(c) for c in ['#1c2541', '#2b2d42', '#3a0ca3', '#7209b7', '#0b132b', '#3d405b', '#5c1a1a', '#e5e5e5', '#264653', '#1d3557']]
col_layer = crowd_bm.loops.layers.color.new('Col')
for tier in range(12):
    r = 9.5 + tier * 1.05; z = .4 + tier * .62
    seg = 72
    ring_in = [Vector((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), z)) for k in range(seg)]
    ring_out = [p * ((r + 1.05) / r) for p in ring_in]
    vi = [seat_bm.verts.new(p) for p in ring_in]; vo = [seat_bm.verts.new(p) for p in ring_out]
    vd = [seat_bm.verts.new((p.x, p.y, z - .62)) for p in ring_in]
    for k in range(seg):
        j = (k + 1) % seg
        seat_bm.faces.new([vi[k], vi[j], vo[j], vo[k]]); seat_bm.faces.new([vd[k], vd[j], vi[j], vi[k]])
    n = int(2 * math.pi * r / .62)
    for k in range(n):
        if random.random() < .12: continue
        a = 2 * math.pi * k / n + random.uniform(-.02, .02)
        base = Vector((math.cos(a) * (r + .5), math.sin(a) * (r + .5), z))
        h = random.uniform(.55, .7); w = random.uniform(.34, .44)
        col = random.choice(shirt)
        for (sz, off, c) in [((w, w * .7, h), h / 2, col), ((.2, .2, .22), h + .12, srgb(random.choice(['#c68a65', '#8d5a3b', '#e8c1a0', '#5a3825'])))]:
            res = bmesh.ops.create_cube(crowd_bm, size=1)
            rot = Matrix.Rotation(a + math.pi / 2, 3, 'Z')
            for v in res['verts']:
                v.co = rot @ Vector((v.co.x * sz[0], v.co.y * sz[1], v.co.z * sz[2])) + base + Vector((0, 0, off))
            faces = {f for v in res['verts'] for f in v.link_faces}
            for f in faces:
                for loop in f.loops: loop[col_layer] = c
mesh_obj('seating', seat_bm, M['seat'])
cm = bpy.data.materials.new('crowd'); cm.use_nodes = True
vc = cm.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
cm.node_tree.links.new(vc.outputs['Color'], cm.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
cm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .9
mesh_obj('crowd', crowd_bm, cm)

# --- lighting truss, fixtures, screens ---------------------------------------
TZ = 9.0
for i in range(8):
    a, b = corners[i] * 1.5, corners[(i + 1) % 8] * 1.5
    mid, L, ang = (a + b) / 2, (b - a).length, math.atan2(b.y - a.y, b.x - a.x)
    for dz in (0, .55):
        box(f'truss{i}_{dz}', (L, .12, .12), (mid.x, mid.y, TZ + dz), M['truss'], ang)
    for k in range(4):
        p = a + (b - a) * (k + .5) / 4
        box(f'fix{i}_{k}', (.28, .28, .22), (p.x, p.y, TZ - .2), M['truss'])
        bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, radius=.11, segments=16)
        lamp = mesh_obj(f'lens{i}_{k}', bm, M['lamp']); lamp.location = (p.x, p.y, TZ - .315); lamp.rotation_euler = (math.pi, 0, 0)
for i, c in enumerate(corners[::2]):
    ang = math.atan2(c.y, c.x)
    pos = c * 1.25
    box(f'screen{i}', (3.6, .2, 2.1), (pos.x, pos.y, TZ - 1.6), M['truss'], ang + math.pi / 2)
    face = box(f'screenface{i}', (3.4, .02, 1.9), (pos.x - math.cos(ang) * .11, pos.y - math.sin(ang) * .11, TZ - 1.6), M['screen_a' if i % 2 else 'screen_b'], ang + math.pi / 2)

if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 40; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = srgb('#0a1530'); w.node_tree.nodes['Background'].inputs[1].default_value = .6
    cd = bpy.data.cameras.new('c'); cd.lens = 28; cam = link(bpy.data.objects.new('c', cd)); sc.camera = cam
    cam.location = (0.6, -3.9, PLAT + 1.45); cam.rotation_euler = (math.radians(84), 0, math.radians(8))
    cd.lens = 24
    for k in range(4):
        ld = bpy.data.lights.new('spot', 'SPOT'); ld.energy = 5000; ld.spot_size = math.radians(55); ld.color = (1, .97, .92)
        lo = link(bpy.data.objects.new('spot', ld)); a = k * math.pi / 2 + .4
        lo.location = (math.cos(a) * 3, math.sin(a) * 3, TZ - .3); lo.rotation_euler = (Vector((0, 0, PLAT)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    for col, x in (('#2f6bff', -14), ('#ff3a55', 14)):
        ld = bpy.data.lights.new('fill', 'AREA'); ld.energy = 30000; ld.size = 12; ld.color = srgb(col)[:3]
        lo = link(bpy.data.objects.new('fill', ld)); lo.location = (x, 8, 7); lo.rotation_euler = (Vector((0, 0, 3)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = PREVIEW; bpy.ops.render.render(write_still=True)
    for o in [o for o in bpy.data.objects if o.type in ('LIGHT', 'CAMERA')]: bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_lights=False, export_cameras=False, export_vertex_color='ACTIVE')
print('EXPORTED', OUT, len(bpy.data.objects))
