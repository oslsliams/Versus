"""Render VERSUS Bubble Night 3D art (original, no third-party assets).

Run:  blender -b --factory-startup -P scripts/art/render_art.py -- <out_dir> [names...]
Outputs transparent WEBP images used across the site.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else "public/art")
ONLY = set(argv[1:])
os.makedirs(OUT, exist_ok=True)

def hexc(h, a=1.0):
    h = h.lstrip('#'); r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)

PAL = dict(lime='#bfe36b', pink='#e58fb6', sky='#86c4dc', sun='#e9c873', violet='#968fd6',
           night='#1b1838', ink='#f6f4ff', deep='#100d22')

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = 64
    s.cycles.use_denoising = True
    s.render.film_transparent = True
    s.render.resolution_x = s.render.resolution_y = 900
    s.render.image_settings.file_format = 'WEBP'
    s.render.image_settings.color_mode = 'RGBA'
    s.render.image_settings.quality = 88
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = hexc('#6a62a8')
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.4
    return s

def mat(name, color, metal=0.0, rough=0.35, coat=0.6, emit=None, transmission=0.0, ior=1.45):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = hexc(color)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = 0.08
    if transmission:
        p.inputs['Transmission Weight'].default_value = transmission
        p.inputs['IOR'].default_value = ior
    if emit:
        p.inputs['Emission Color'].default_value = hexc(emit[0])
        p.inputs['Emission Strength'].default_value = emit[1]
    return m

def assign(o, m):
    o.data.materials.clear(); o.data.materials.append(m); return o

def bevel(o, w=0.04, seg=6):
    b = o.modifiers.new('bevel', 'BEVEL'); b.width = w; b.segments = seg; b.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = o
    return o

def smooth(o):
    for p in o.data.polygons: p.use_smooth = True
    return o

def light(name, loc, energy, size, color='#ffffff'):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.size = size; d.color = hexc(color)[:3]
    o = bpy.data.objects.new(name, d); bpy.context.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o

def rig(target=(0, 0, 0), dist=7.5, elev=24, azim=-35, lens=60):
    a, e = math.radians(azim), math.radians(elev)
    loc = Vector(target) + Vector((dist * math.cos(e) * math.sin(a), -dist * math.cos(e) * math.cos(a), dist * math.sin(e)))
    cd = bpy.data.cameras.new('cam'); cd.lens = lens
    c = bpy.data.objects.new('cam', cd); bpy.context.collection.objects.link(c); c.location = loc
    c.rotation_euler = (Vector(target) - loc).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = c
    light('key', (loc.x + 4, loc.y - 2, loc.z + 5), 900, 5)
    light('rim_pink', (-5, 4, 3), 600, 4, PAL['pink'])
    light('rim_sky', (5, 5, 2), 500, 4, PAL['sky'])
    light('fill', (0, -6, -1), 150, 6, PAL['violet'])

def text(body, size=1.0, extrude=0.12, m=None):
    bpy.ops.object.text_add()
    t = bpy.context.object; t.data.body = body; t.data.size = size; t.data.extrude = extrude
    t.data.bevel_depth = 0.025; t.data.bevel_resolution = 3
    t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
    if m: t.data.materials.append(m)
    return t

def render(name):
    bpy.context.scene.render.filepath = os.path.join(OUT, name + '.webp')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)

# ---------------------------------------------------------------- scenes
def coin():
    reset()
    gold = mat('gold', '#f0c95a', metal=0.45, rough=0.25, coat=0.8)
    gold2 = mat('gold2', '#fbe7a6', metal=0.5, rough=0.18, coat=0.9)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.35, depth=0.32)
    c = smooth(bevel(assign(bpy.context.object, gold), 0.08, 8))
    bpy.ops.mesh.primitive_torus_add(major_radius=1.12, minor_radius=0.06, major_segments=96, minor_segments=16, location=(0, 0, 0.17))
    smooth(assign(bpy.context.object, gold2))
    t = text('VS', 1.15, 0.08, gold2); t.location = (0, 0, 0.16)
    for o in (c, bpy.data.objects['Torus'], t): o.rotation_euler = (math.radians(68), 0, math.radians(-14))
    t.location = (0, -0.15, 0.06)
    bpy.data.objects['Torus'].location = (0, -0.16, 0.06)
    rig(dist=7.2, elev=8, azim=-8, lens=70)
    render('coin')

def octagon():
    reset()
    floor_m = mat('floor', '#2a2550', rough=0.5, coat=0.3)
    center_m = mat('center', PAL['lime'], rough=0.3, coat=0.7)
    post_m = mat('post', PAL['ink'], rough=0.25, coat=0.8)
    pad_m = mat('pad', PAL['pink'], rough=0.35, coat=0.7)
    fence_m = mat('fence', '#3a3566', metal=0.6, rough=0.3, coat=0.2)
    R = 2.2
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=R + 0.25, depth=0.35, location=(0, 0, -0.175))
    o = bevel(assign(bpy.context.object, floor_m), 0.06, 6); o.rotation_euler.z = math.radians(22.5)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.75, depth=0.04, location=(0, 0, 0.02))
    assign(bpy.context.object, center_m)
    t = text('VS', 0.7, 0.03, mat('vsink', PAL['night'], rough=0.4)); t.location = (0, 0, 0.05)
    H = 1.35
    pts = [(R * math.cos(math.radians(22.5 + 45 * i)), R * math.sin(math.radians(22.5 + 45 * i))) for i in range(8)]
    for x, y in pts:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.07, depth=H, location=(x, y, H / 2))
        smooth(assign(bpy.context.object, post_m))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(x, y, H + 0.02))
        smooth(assign(bpy.context.object, pad_m))
    for i in range(8):
        (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % 8]
        if i in (5, 6):  # leave the front open so the cage reads from the camera
            continue
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        L = math.hypot(x2 - x1, y2 - y1)
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=14, y_subdivisions=10, size=1, location=(mx, my, H / 2 + 0.05))
        g = bpy.context.object; g.scale = (L - 0.12, H - 0.15, 1)
        g.rotation_euler = (math.radians(90), 0, math.atan2(y2 - y1, x2 - x1))
        bpy.ops.object.transform_apply(scale=True)
        w = g.modifiers.new('wire', 'WIREFRAME'); w.thickness = 0.012
        assign(g, fence_m)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.05, depth=L, location=(mx, my, H))
        rail = smooth(assign(bpy.context.object, pad_m))
        rail.rotation_euler = (0, math.radians(90), math.atan2(y2 - y1, x2 - x1))
    rig(target=(0, 0, 0.45), dist=9.5, elev=30, azim=-25, lens=50)
    render('octagon')

def trophy():
    reset()
    gold = mat('tgold', '#f0c95a', metal=0.45, rough=0.22, coat=0.8)
    base_m = mat('tbase', PAL['violet'], rough=0.3, coat=0.8)
    plate = mat('plate', PAL['lime'], rough=0.3, coat=0.8)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.3)); b = bpy.context.object; b.scale = (1.3, 1.3, 0.6)
    bevel(assign(b, base_m), 0.08, 6)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.66, 0.3)); p = bpy.context.object; p.scale = (0.8, 0.02, 0.28)
    bevel(assign(p, plate), 0.01, 3)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.5, depth=0.18, location=(0, 0, 0.69)); smooth(bevel(assign(bpy.context.object, gold), 0.04, 4))
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.14, depth=0.7, location=(0, 0, 1.12)); smooth(assign(bpy.context.object, gold))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.9, location=(0, 0, 2.2))
    cup = bpy.context.object; cup.scale = (1, 1, 0.95)
    bpy.ops.object.mode_set(mode='EDIT'); bm = bmesh.from_edit_mesh(cup.data)
    for v in [v for v in bm.verts if v.co.z > 0.25]: bm.verts.remove(v)
    bmesh.update_edit_mesh(cup.data); bpy.ops.object.mode_set(mode='OBJECT')
    s = cup.modifiers.new('solid', 'SOLIDIFY'); s.thickness = 0.08
    smooth(assign(cup, gold))
    for side in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.36, minor_radius=0.07, location=(side * 0.95, 0, 2.2), rotation=(math.radians(90), 0, 0))
        smooth(assign(bpy.context.object, gold))
    rig(target=(0, 0, 1.35), dist=8.2, elev=12, azim=-28, lens=55)
    render('trophy')

def gem():
    reset()
    gm = mat('gem', PAL['pink'], rough=0.05, coat=1.0, transmission=0.85, ior=1.6)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.25)
    g = assign(bpy.context.object, gm); g.scale = (1, 1, 1.25); g.rotation_euler = (0.3, 0.2, 0.5)
    spark = mat('spark', PAL['sun'], rough=0.2, coat=0.8, emit=(PAL['sun'], 2.0))
    for (x, y, z, r) in [(1.4, -0.3, 1.2, 0.16), (-1.3, 0.2, 0.9, 0.11), (1.1, 0.4, -1.1, 0.1)]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=0, radius=r, location=(x, y, z))
        assign(bpy.context.object, spark)
    rig(dist=8, elev=14, azim=-20, lens=60)
    render('gem')

def vs_badge():
    reset()
    pink = mat('vpink', PAL['pink'], rough=0.3, coat=0.9)
    lime = mat('vlime', PAL['lime'], rough=0.3, coat=0.9)
    edge = mat('vedge', PAL['ink'], rough=0.3, coat=0.9)
    bpy.ops.mesh.primitive_cube_add(size=1); b = bpy.context.object; b.scale = (3.0, 0.5, 2.0)
    bpy.ops.object.transform_apply(scale=True); bevel(assign(b, edge), 0.45, 10); smooth(b)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.08, 0)); f = bpy.context.object; f.scale = (2.7, 0.5, 1.7)
    bpy.ops.object.transform_apply(scale=True); bevel(assign(f, pink), 0.38, 10); smooth(f)
    t = text('VS', 1.55, 0.18, lime); t.rotation_euler = (math.radians(90), 0, 0); t.location = (0, -0.36, -0.05)
    for o in (b, f, t): o.rotation_euler.y += math.radians(-8)
    rig(dist=8.5, elev=6, azim=-18, lens=60)
    render('vs-badge')

def gloves():
    reset()
    red = mat('gred', PAL['pink'], rough=0.35, coat=0.9)
    blue = mat('gblue', PAL['sky'], rough=0.35, coat=0.9)
    cuff = mat('gcuff', PAL['ink'], rough=0.4, coat=0.6)
    def glove(m, x, rot):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.9, location=(x, 0, 0.35))
        fist = bpy.context.object; fist.scale = (0.85, 1.05, 0.95); smooth(assign(fist, m))
        sd = fist.modifiers.new('sub', 'SUBSURF'); sd.levels = 1
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=0.32, location=(x - 0.55 * (1 if x > 0 else -1), -0.55, 0.15))
        smooth(assign(bpy.context.object, m))
        thumb = bpy.context.object
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.55, depth=0.75, location=(x, 0.1, -0.6))
        c = smooth(bevel(assign(bpy.context.object, cuff), 0.1, 6))
        bpy.ops.mesh.primitive_torus_add(major_radius=0.56, minor_radius=0.05, location=(x, 0.1, -0.35))
        band = smooth(assign(bpy.context.object, m))
        bpy.ops.object.empty_add(location=(x, 0, 0)); e = bpy.context.object
        for o in (fist, thumb, c, band): o.parent = e; o.matrix_parent_inverse = e.matrix_world.inverted()
        e.rotation_euler = rot
    glove(red, -0.95, (math.radians(-10), math.radians(-18), math.radians(12)))
    glove(blue, 0.95, (math.radians(-10), math.radians(18), math.radians(-12)))
    rig(target=(0, 0, 0), dist=8.5, elev=14, azim=-10, lens=55)
    render('gloves')

SCENES = dict(coin=coin, octagon=octagon, trophy=trophy, gem=gem, vs_badge=vs_badge, gloves=gloves)
for name, fn in SCENES.items():
    if ONLY and name not in ONLY: continue
    fn()
