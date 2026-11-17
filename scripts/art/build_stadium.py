"""VERSUS stadium: a full fight-night arena around the octagon (original design; references: modern
MMA arena nights). Built procedurally so it stays light enough for the web:

  octagon   white canvas with VERSUS / Unseen Interactive / made-up sponsor marks, black padded cage,
            chain-link fence, raised apron with a red-to-blue LED skirt
  floor     cageside judge + commentary tables with glowing monitors, a low barrier wrapped in LED
            boards, floor-seat rows, an entrance walkway and an arched tunnel
  bowl      oval lower bowl (18 rows) and steeper upper bowl (16 rows), red seat rows, aisles,
            a glowing LED ring between the levels, suites ringing the top, dark roof with catwalks
  rigging   four-sided centre-hung video board with a halo ring, an eight-arm lighting "spider"
            sweeping down over the cage, an inner fixture ring and speaker clusters

The crowd, live screens, scrolling LED text, flashes and moving beams are added by the game
(components/fight3d/stadium.ts); this script writes the seat positions for the crowd to
public/models/arena-crowd.json and names the screen/LED materials so the game can drive them.

Run: blender -b --factory-startup -P scripts/art/build_stadium.py -- <out.glb> <crowd.json> <unseen_icon.svg> [preview.png]
"""
import bpy, bmesh, sys, math, random, json
import numpy as np
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
OUT, CROWD_OUT, ICON = args[0], args[1], args[2]
PREVIEW = args[3] if len(args) > 3 else None
random.seed(11)
R = 4.6          # octagon radius (to the corner), metres
H = 1.85         # fence height
PLAT = .9        # mat height above the arena floor
ELL = .86        # the bowl is an oval: y radius = x radius * ELL

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
def mesh_obj(name, bm, m, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for mm in (m if isinstance(m, list) else [m]): me.materials.append(mm)
    for p in me.polygons: p.use_smooth = smooth
    return link(bpy.data.objects.new(name, me))

bpy.ops.wm.read_factory_settings(use_empty=True)
corners = [Vector((R * math.cos(math.pi / 8 + i * math.pi / 4), R * math.sin(math.pi / 8 + i * math.pi / 4), 0)) for i in range(8)]

M = dict(
    canvas=mat('canvas', '#f2f3f5', .78), ink=mat('ink', '#111216', .7), lime=mat('lime', '#9fd13a', .6),
    red=mat('logo_red', '#d8283c', .6), blue=mat('logo_blue', '#2457d6', .6), gold=mat('logo_gold', '#e0a92e', .55),
    pad=mat('pad', '#16171b', .55), apron=mat('apron', '#0d0e12', .7), floor=mat('floor', '#07080b', .85),
    bowl=mat('bowl', '#0b0c10', .9), seat=mat('seat_red', '#5a0f17', .75), seat_dark=mat('seat_dark', '#1a0b10', .8),
    wall=mat('wall', '#0a0b0f', .9), roof=mat('roof', '#050608', .95), truss=mat('truss', '#2a2d36', .35, .8),
    white=mat('white', '#e9ebf0', .5), table=mat('table', '#0e0f13', .4, .2), cloth=mat('cloth', '#141826', .9),
    lamp=mat('lamp', '#000000', .2, emit='#ffffff', strength=25.), lamp_blue=mat('lamp_blue', '#000000', .2, emit='#6fb4ff', strength=30.),
    suite=mat('suite', '#000000', .5, emit='#ffcf8a', strength=1.6),
    # driven by the game: canvas textures / render targets replace these
    ribbon=mat('ribbon', '#000000', .5, emit='#ffffff', strength=3.), led_floor=mat('led_floor', '#000000', .5, emit='#2b6cff', strength=3.),
    screen_live=mat('screen_live', '#000000', .4, emit='#2b6cff', strength=3.), screen_score=mat('screen_score', '#000000', .4, emit='#ff3550', strength=3.),
    monitor=mat('monitor', '#000000', .3, emit='#7fb2ff', strength=2.), board_halo=mat('board_halo', '#000000', .4, emit='#9fd13a', strength=5.),
    tunnel_led=mat('tunnel_led', '#000000', .4, emit='#9fd13a', strength=6.),
)
# apron skirt: red on one side fading to blue on the other (vertex colours; the game renders it unlit and glowing)
apron_led = bpy.data.materials.new('apron_led'); apron_led.use_nodes = True
_vc = apron_led.node_tree.nodes.new('ShaderNodeVertexColor'); _vc.layer_name = 'Col'
apron_led.node_tree.links.new(_vc.outputs['Color'], apron_led.node_tree.nodes['Principled BSDF'].inputs['Emission Color'])
apron_led.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 3
apron_led.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0, 0, 0, 1)
M['apron_led'] = apron_led

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
M['fence'] = fm

def box(name, size, loc, m, rot_z=0, rot=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    o = mesh_obj(name, bm, m); o.location = loc
    if rot is not None: o.rotation_euler = rot
    else: o.rotation_euler = (0, 0, rot_z)
    return o

def beam(name, a, b, w, m):
    """a box from point a to point b (truss members, cables)"""
    a, b = Vector(a), Vector(b); d = b - a
    o = box(name, (w, w, d.length), (a + b) / 2, m)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return o

# ============================================================== OCTAGON
bm = bmesh.new(); ring = [bm.verts.new((c.x, c.y, PLAT)) for c in corners]; bm.faces.new(ring)
mesh_obj('mat', bm, M['canvas'])
bm = bmesh.new()
for i in range(8):
    a, b = corners[i] * .86, corners[(i + 1) % 8] * .86
    a2, b2 = corners[i] * .875, corners[(i + 1) % 8] * .875
    vs = [bm.verts.new((v.x, v.y, PLAT + .003)) for v in (a, b, b2, a2)]; bm.faces.new(vs)
mesh_obj('mat_line', bm, M['ink'])
# apron top + LED skirt (red -> blue round the octagon)
bm = bmesh.new()
top = [bm.verts.new((c.x * 1.12, c.y * 1.12, PLAT - .001)) for c in corners]
inner = [bm.verts.new((c.x, c.y, PLAT - .001)) for c in corners]
for i in range(8):
    j = (i + 1) % 8; bm.faces.new([inner[i], inner[j], top[j], top[i]])
mesh_obj('apron', bm, M['apron'])
bm = bmesh.new(); col = bm.loops.layers.color.new('Col')
top = [bm.verts.new((c.x * 1.12, c.y * 1.12, PLAT - .001)) for c in corners]
bot = [bm.verts.new((c.x * 1.12, c.y * 1.12, 0)) for c in corners]
for i in range(8):
    j = (i + 1) % 8
    f = bm.faces.new([bot[i], bot[j], top[j], top[i]])
    for loop in f.loops:
        t = (loop.vert.co.x / (R * 1.12) + 1) / 2          # 0 on the blue side (-x) .. 1 on the red side (+x)
        c1, c2 = srgb('#2a5cff'), srgb('#ff2a3c')
        loop[col] = tuple(c1[k] * (1 - t) + c2[k] * t for k in range(3)) + (1,)
mesh_obj('apron_led', bm, M['apron_led'])

def text(body, size, loc, rot_z, m, extrude=.002, prefix='logo_'):
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = body; cu.size = size; cu.extrude = extrude
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    o = link(bpy.data.objects.new(prefix + body[:8], cu)); o.data.materials.append(m)
    o.location = loc; o.rotation_euler = (0, 0, rot_z)
    return o

texts = []
# canvas: big marks + made-up sponsors (no real brands)
texts.append(text('VERSUS', .62, (0, -2.3, PLAT + .004), 0, M['ink']))
texts.append(text('VERSUS', .62, (0, 2.3, PLAT + .004), math.pi, M['ink']))
texts.append(text('UNSEEN INTERACTIVE', .2, (2.75, 0, PLAT + .004), math.pi / 2, M['ink']))
texts.append(text('UNSEEN INTERACTIVE', .2, (-2.75, 0, PLAT + .004), -math.pi / 2, M['ink']))
for (body, m, x, y, rz, s) in [('RIPTIDE', 'red', 1.75, 1.55, math.pi * .75, .3), ('APEX GLOVES', 'blue', -1.75, 1.55, -math.pi * .75, .22),
                               ('IRONCLAD', 'ink', 1.75, -1.55, math.pi * .25, .26), ('HALO', 'gold', -1.75, -1.55, -math.pi * .25, .36),
                               ('NIGHT SHIFT ENERGY', 'lime', 0, -3.2, 0, .14), ('VX FIGHT PASS', 'blue', 0, 3.2, math.pi, .16)]:
    texts.append(text(body, s, (x, y, PLAT + .004), rz, M[m]))
for i in range(8):
    a = math.pi / 8 + i * math.pi / 4 + math.pi / 8
    mid = (corners[i] + corners[(i + 1) % 8]) / 2 * .93
    texts.append(text('VERSUS CHAMPIONSHIP', .11, (mid.x, mid.y, PLAT + .004), a - math.pi / 2, M['ink']))

# centre logo: the Unseen eye
before = set(bpy.data.objects)
bpy.ops.import_curve.svg(filepath=ICON)
for o in [o for o in bpy.data.objects if o not in before]:
    if o.type == 'CURVE' and len(o.data.splines) == 1 and len(o.data.splines[0].bezier_points) == 4:
        pts = [p.co for p in o.data.splines[0].bezier_points]
        if max(p.x for p in pts) - min(p.x for p in pts) > .1: bpy.data.objects.remove(o, do_unlink=True)
eye = [o for o in bpy.data.objects if o not in before]
for o in eye: o.data.materials.clear(); o.data.materials.append(M['lime']); o.data.extrude = .0003
bpy.ops.object.select_all(action='DESELECT')
for o in eye: o.select_set(True)
bpy.context.view_layer.objects.active = eye[0]
if len(eye) > 1: bpy.ops.object.join()
logo = bpy.context.view_layer.objects.active
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
k = 2.2 / (max(logo.dimensions.x, logo.dimensions.y) or 1)
logo.location = (0, 0, PLAT + .004); logo.scale = (k, k, k * .05)
logo.data.bevel_depth = .075 / k; logo.data.bevel_resolution = 2; logo.data.fill_mode = 'FULL'
logo.name = 'logo_eye'
texts.append(logo)

# cage: posts, rails, skirt, fence (names matter: the game hides the cage pieces on the camera's side)
for i, c in enumerate(corners):
    a = math.atan2(c.y, c.x)
    box(f'post{i}', (.22, .22, H + .1), (c.x, c.y, PLAT + (H + .1) / 2), M['pad'], a)
    t = text('VERSUS', .12, (c.x * .955, c.y * .955, PLAT + 1.05), 0, M['white'], extrude=.001, prefix='txt_post')
    t.rotation_mode = 'ZYX'; t.rotation_euler = (math.pi / 2, math.pi / 2, a + math.pi)
    texts.append(t)
for i in range(8):
    a, b = corners[i], corners[(i + 1) % 8]
    mid, L = (a + b) / 2, (b - a).length
    ang = math.atan2(b.y - a.y, b.x - a.x)
    box(f'rail{i}', (L, .16, .16), (mid.x, mid.y, PLAT + H), M['pad'], ang)
    box(f'skirt{i}', (L, .1, .32), (mid.x, mid.y, PLAT + .16), M['pad'], ang)
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in [(a.x, a.y, PLAT + .3), (b.x, b.y, PLAT + .3), (b.x, b.y, PLAT + H - .08), (a.x, a.y, PLAT + H - .08)]]
    f = bm.faces.new(vs); uv = bm.loops.layers.uv.new()
    for loop, (u, v) in zip(f.loops, [(0, 0), (L / .45, 0), (L / .45, (H - .38) / .45), (0, (H - .38) / .45)]): loop[uv].uv = (u, v)
    mesh_obj(f'fence{i}', bm, M['fence'])
    # fence-top sponsor pads
    t = text(['VERSUS', 'RIPTIDE', 'VERSUS', 'APEX', 'VERSUS', 'HALO', 'VERSUS', 'IRONCLAD'][i], .1, (mid.x * 1.018, mid.y * 1.018, PLAT + H), 0, M['white'], extrude=.001, prefix='txt_rail')
    t.rotation_mode = 'ZYX'; t.rotation_euler = (math.pi / 2, 0, ang + math.pi)
    texts.append(t)

bpy.ops.object.select_all(action='DESELECT')
for o in texts: o.select_set(True)
bpy.context.view_layer.objects.active = texts[0]
bpy.ops.object.convert(target='MESH')

# ============================================================== FLOOR LEVEL
bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, radius=60, segments=64)
mesh_obj('arena_floor', bm, M['floor'])
crowd = []   # (x, y, z, yaw, tier) in Blender space; written out for the game's instanced crowd
def seat_at(x, y, z, tier):
    crowd.append((x, y, z, math.atan2(-y, -x), tier))

def oval(r, a): return Vector((r * math.cos(a), r * ELL * math.sin(a), 0))
TUNNEL_A = -math.pi / 2           # the entrance tunnel sits on the -y side
def in_walkway(x, y): return y < 0 and abs(x) < 1.4    # the walkway from the tunnel to the cage stays clear

# cageside: judges on three sides, commentary on the fourth, glowing monitors on each table
for k, a in enumerate([0, math.pi / 2, math.pi, math.pi * 1.5 + .35]):
    c = Vector((math.cos(a), math.sin(a), 0)) * 6.4
    box(f'table{k}', (2.6, .7, .08), (c.x, c.y, .76), M['table'], a + math.pi / 2)
    box(f'tablecloth{k}', (2.6, .05, .72), (c.x + math.cos(a) * .33, c.y + math.sin(a) * .33, .38), M['cloth'], a + math.pi / 2)
    for m in (-.8, 0, .8):
        off = Vector((-math.sin(a), math.cos(a), 0)) * m
        mon = box(f'monitor{k}_{m}', (.5, .03, .32), (c.x + off.x - math.cos(a) * .1, c.y + off.y - math.sin(a) * .1, 1.0), M['monitor'], a + math.pi / 2)
        mon.rotation_euler = (math.radians(-12), 0, a + math.pi / 2)
        seat_at(c.x + off.x + math.cos(a) * .55, c.y + off.y + math.sin(a) * .55, 0, 0)
# barrier wrapped in LED boards (UVs repeat round the ring so the game can scroll sponsor text)
def band(name, rx, z0, z1, segs, m, rep, ell=ELL, skip=None):
    bm = bmesh.new(); uv = bm.loops.layers.uv.new()
    for s in range(segs):
        a0, a1 = 2 * math.pi * s / segs, 2 * math.pi * (s + 1) / segs
        if skip and skip((a0 + a1) / 2): continue
        p0 = Vector((rx * math.cos(a0), rx * ell * math.sin(a0), 0)); p1 = Vector((rx * math.cos(a1), rx * ell * math.sin(a1), 0))
        vs = [bm.verts.new((p0.x, p0.y, z0)), bm.verts.new((p1.x, p1.y, z0)), bm.verts.new((p1.x, p1.y, z1)), bm.verts.new((p0.x, p0.y, z1))]
        f = bm.faces.new(vs)
        for loop, (u, v) in zip(f.loops, [(s / segs * rep, 0), ((s + 1) / segs * rep, 0), ((s + 1) / segs * rep, 1), (s / segs * rep, 1)]): loop[uv].uv = (u, v)
    return mesh_obj(name, bm, m)
walk_gap = lambda a: abs(math.atan2(math.sin(a - TUNNEL_A), math.cos(a - TUNNEL_A))) < .2
band('led_floor_ring', 7.4, .1, .75, 96, M['led_floor'], 10, ell=1, skip=walk_gap)
band('barrier', 7.36, 0, .78, 96, M['pad'], 1, ell=1, skip=walk_gap)
# floor seats: rows of chairs between the barrier and the bowl
for row in range(6):
    r = 8.0 + row * .95
    n = int(2 * math.pi * r / .62)
    for k in range(n):
        a = 2 * math.pi * k / n
        x, y = r * math.cos(a), r * math.sin(a)
        if in_walkway(x, y) or (k % 22 == 0): continue
        seat_at(x, y, 0, 0)
# floor seat bases as one long dark strip per row (cheap)
for row in range(6):
    band(f'chairs{row}', 8.0 + row * .95 + .25, 0, .45, 72, M['seat_dark'], 1, ell=1, skip=lambda a: abs(math.atan2(math.sin(a - TUNNEL_A), math.cos(a - TUNNEL_A))) < .12)

# ============================================================== BOWL
def tiers(name, r0, z0, rows, depth, rise, tier, tunnel_rows=0):
    """stepped oval seating: tread + riser per row, a red seat-back strip, crowd seats with aisles"""
    bm = bmesh.new(); seg = 120
    sections = 18
    for row in range(rows):
        r, z = r0 + row * depth, z0 + row * rise
        for s in range(seg):
            a0, a1 = 2 * math.pi * s / seg, 2 * math.pi * (s + 1) / seg
            if row < tunnel_rows and walk_gap((a0 + a1) / 2): continue
            p0, p1 = oval(r, a0), oval(r, a1); q0, q1 = oval(r + depth, a0), oval(r + depth, a1)
            bm.faces.new([bm.verts.new((p0.x, p0.y, z)), bm.verts.new((p1.x, p1.y, z)), bm.verts.new((q1.x, q1.y, z)), bm.verts.new((q0.x, q0.y, z))])
            bm.faces.new([bm.verts.new((p0.x, p0.y, z - rise)), bm.verts.new((p1.x, p1.y, z - rise)), bm.verts.new((p1.x, p1.y, z)), bm.verts.new((p0.x, p0.y, z))])
        circ = 2 * math.pi * r * (1 + ELL) / 2
        n = int(circ / .56)
        for k in range(n):
            a = 2 * math.pi * k / n
            sec = (a / (2 * math.pi)) * sections
            if abs(sec - round(sec)) * circ / sections < .55: continue          # aisles
            if row < tunnel_rows and walk_gap(a): continue
            if random.random() < .06: continue                                 # the odd empty seat
            p = oval(r + depth * .55, a)
            seat_at(p.x, p.y, z, tier)
    mesh_obj(name, bm, M['bowl'])
    # seat backs: one coloured strip per row
    for row in range(rows):
        r, z = r0 + row * depth + depth * .85, z0 + row * rise
        band(f'{name}_seats{row}', r, z, z + .42, 120, M['seat'], 1, skip=(lambda a: walk_gap(a)) if row < tunnel_rows else None)

LOW_R0, LOW_Z0, LOW_ROWS, LOW_D, LOW_RISE = 13.5, 1.1, 18, .9, .46
tiers('bowl_lower', LOW_R0, LOW_Z0, LOW_ROWS, LOW_D, LOW_RISE, 1, tunnel_rows=7)
low_top_r = LOW_R0 + LOW_ROWS * LOW_D; low_top_z = LOW_Z0 + LOW_ROWS * LOW_RISE
# the glowing LED ring between the levels (fascia), with a dark lip above it
band('ribbon_ring', low_top_r + .3, low_top_z + .2, low_top_z + 1.3, 160, M['ribbon'], 14)
band('fascia', low_top_r + .32, low_top_z + 1.3, low_top_z + 2.4, 120, M['wall'], 1)
UP_R0 = low_top_r + 1.6; UP_Z0 = low_top_z + 2.6
tiers('bowl_upper', UP_R0, UP_Z0, 16, .85, .7, 2)
up_top_r = UP_R0 + 16 * .85; up_top_z = UP_Z0 + 16 * .7
# suites ring + back wall + roof with catwalk trusses
band('suites', up_top_r + .4, up_top_z + .6, up_top_z + 2.2, 120, M['suite'], 1)
band('back_wall', up_top_r + .5, 0, up_top_z + 9, 96, M['wall'], 1)
bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, radius=up_top_r + 2, segments=64)
roof = mesh_obj('roof', bm, M['roof']); roof.location.z = up_top_z + 9; roof.scale.y = ELL
for k in range(-4, 5):
    beam(f'catwalk_x{k}', (-up_top_r, k * 6, up_top_z + 8.4), (up_top_r, k * 6, up_top_z + 8.4), .35, M['truss'])
    beam(f'catwalk_y{k}', (k * 7, -up_top_r * ELL, up_top_z + 8.6), (k * 7, up_top_r * ELL, up_top_z + 8.6), .3, M['truss'])
# entrance tunnel: an arch with LED trim at the bottom of the lower bowl, and a walkway carpet to the cage
tc = oval(LOW_R0 + 1.5, TUNNEL_A)
box('tunnel_left', (.6, 1.2, 4.2), (tc.x - 2.3, tc.y, 2.1), M['wall']); box('tunnel_right', (.6, 1.2, 4.2), (tc.x + 2.3, tc.y, 2.1), M['wall'])
box('tunnel_top', (5.2, 1.2, .8), (tc.x, tc.y, 4.4), M['wall'])
box('tunnel_led_l', (.08, .08, 4.2), (tc.x - 2.0, tc.y + .62, 2.1), M['tunnel_led']); box('tunnel_led_r', (.08, .08, 4.2), (tc.x + 2.0, tc.y + .62, 2.1), M['tunnel_led'])
box('tunnel_led_t', (4.1, .08, .08), (tc.x, tc.y + .62, 4.0), M['tunnel_led'])
box('walkway', (2.4, abs(tc.y) - 5, .03), (0, (tc.y - 5) / 2, .015), M['cloth'])

# ============================================================== RIGGING
BOARD_Z0, BOARD_Z1, BW = 15.5, 20.5, 9.0
for k, (m, rz) in enumerate([('screen_live', 0), ('screen_score', math.pi / 2), ('screen_live', math.pi), ('screen_score', -math.pi / 2)]):
    bm = bmesh.new(); uv = bm.loops.layers.uv.new()
    rot = Matrix.Rotation(rz, 3, 'Z')
    pts = [rot @ Vector(v) for v in [(-BW / 2, -BW / 2, BOARD_Z0), (BW / 2, -BW / 2, BOARD_Z0), (BW / 2, -BW / 2, BOARD_Z1), (-BW / 2, -BW / 2, BOARD_Z1)]]
    f = bm.faces.new([bm.verts.new(p) for p in pts])
    for loop, (u, v) in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]): loop[uv].uv = (u, v)
    mesh_obj(f'board_{m}_{k}', bm, M[m])
box('board_body', (BW - .2, BW - .2, BOARD_Z1 - BOARD_Z0 + .3), (0, 0, (BOARD_Z0 + BOARD_Z1) / 2), M['wall'])
band('board_halo', BW * .62, BOARD_Z0 - .9, BOARD_Z0 - .5, 64, M['board_halo'], 1, ell=1)
band('board_halo_top', BW * .62, BOARD_Z1 + .3, BOARD_Z1 + .55, 64, M['ribbon'], 4, ell=1)
for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    beam(f'cable{k}', (math.cos(a) * 4, math.sin(a) * 4, BOARD_Z1), (math.cos(a) * 6, math.sin(a) * 6, up_top_z + 8.4), .05, M['truss'])
# the lighting spider: eight truss arms sweeping down from under the board to above the cage edge
HUB_Z, ARM_Z, ARM_R = BOARD_Z0 - 1.2, 9.4, 8.2
for i in range(8):
    a = i * math.pi / 4 + math.pi / 8
    d = Vector((math.cos(a), math.sin(a), 0)); side = Vector((-d.y, d.x, 0)) * .32
    p0 = d * 2.6 + Vector((0, 0, HUB_Z)); p1 = d * ARM_R + Vector((0, 0, ARM_Z))
    for s in (side, -side):
        beam(f'arm{i}_{s.x:.2f}', p0 + s, p1 + s, .1, M['truss'])
        beam(f'arm{i}_lo{s.x:.2f}', p0 + s - Vector((0, 0, .45)), p1 + s - Vector((0, 0, .45)), .08, M['truss'])
    for k in range(8):   # lattice + fixtures
        t = k / 7; p = p0.lerp(p1, t)
        beam(f'arm{i}_x{k}', p + side, p - side - Vector((0, 0, .45)), .05, M['truss'])
        if k % 2 == 1:
            bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, radius=.14, segments=12)
            lens = mesh_obj(f'lens_arm{i}_{k}', bm, M['lamp_blue'] if k < 5 else M['lamp']); lens.location = p - Vector((0, 0, .55))
            lens.rotation_mode = 'QUATERNION'; lens.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((Vector((0, 0, PLAT)) - lens.location).normalized())
            box(f'can_arm{i}_{k}', (.34, .34, .3), p - Vector((0, 0, .4)), M['truss'])
band('hub_ring', 2.8, HUB_Z - .2, HUB_Z + .3, 32, M['truss'], 1, ell=1)
# inner fixture ring right over the cage
TZ = 8.6
for i in range(8):
    a, b = corners[i] * 1.45, corners[(i + 1) % 8] * 1.45
    mid, L, ang = (a + b) / 2, (b - a).length, math.atan2(b.y - a.y, b.x - a.x)
    for dz in (0, .5): box(f'truss{i}_{dz}', (L, .12, .12), (mid.x, mid.y, TZ + dz), M['truss'], ang)
    for k in range(3):
        p = a + (b - a) * (k + .5) / 3
        box(f'fix{i}_{k}', (.3, .3, .24), (p.x, p.y, TZ - .2), M['truss'])
        bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, radius=.12, segments=16)
        lamp = mesh_obj(f'lens{i}_{k}', bm, M['lamp']); lamp.location = (p.x, p.y, TZ - .33); lamp.rotation_euler = (math.pi, 0, 0)
# speaker clusters
for k in range(4):
    a = k * math.pi / 2
    box(f'speaker{k}', (1.2, 1.0, 3.2), (math.cos(a) * 13, math.sin(a) * 13 * ELL, 17), M['wall'], a)

print('CROWD SEATS', len(crowd))
# game space (glTF y-up): (x, y, z)_blender -> (x, z, -y)
with open(CROWD_OUT, 'w') as fh:
    json.dump({'v': 1, 'seats': [round(v, 2) for s in crowd for v in (s[0], s[2], -s[1], -s[3] + math.pi / 2, s[4])]}, fh, separators=(',', ':'))

if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = srgb('#050812'); w.node_tree.nodes['Background'].inputs[1].default_value = .3
    for k in range(6):
        ld = bpy.data.lights.new('spot', 'SPOT'); ld.energy = 9000; ld.spot_size = math.radians(40); ld.color = (1, .97, .92)
        lo = link(bpy.data.objects.new('spot', ld)); a = k * math.pi / 3
        lo.location = (math.cos(a) * 6, math.sin(a) * 6, 12); lo.rotation_euler = (Vector((0, 0, PLAT)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    for col, x in (('#2f6bff', -20), ('#ff3a55', 20)):
        ld = bpy.data.lights.new('fill', 'AREA'); ld.energy = 120000; ld.size = 20; ld.color = srgb(col)[:3]
        lo = link(bpy.data.objects.new('fill', ld)); lo.location = (x, 0, 14); lo.rotation_euler = (Vector((x * 1.4, 0, 6)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    cd = bpy.data.cameras.new('c'); cd.lens = 20; cam = link(bpy.data.objects.new('c', cd)); sc.camera = cam
    for name, loc, tgt in [('wide', (12, -15, 9), (0, 0, 3)), ('cage', (2.2, -9.5, 3.4), (0, 0, 2.2))]:
        cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = PREVIEW.replace('.png', f'-{name}.png'); bpy.ops.render.render(write_still=True)
    for o in [o for o in bpy.data.objects if o.type in ('LIGHT', 'CAMERA')]: bpy.data.objects.remove(o, do_unlink=True)

# join static pieces by material to keep the draw-call count sane (cage pieces stay separate: the game hides them per side)
keep = lambda o: o.name.startswith(('post', 'rail', 'skirt', 'fence', 'txt_', 'board_screen', 'apron_led', 'mat'))
groups = {}
for o in [o for o in bpy.data.objects if o.type == 'MESH' and not keep(o)]:
    if o.data.materials: groups.setdefault(o.data.materials[0].name, []).append(o)
for name, objs in groups.items():
    if len(objs) < 2: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); bpy.context.view_layer.objects.active.name = 'j_' + name
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_lights=False, export_cameras=False, export_vertex_color='ACTIVE')
print('EXPORTED', OUT, len(bpy.data.objects), 'objects')
