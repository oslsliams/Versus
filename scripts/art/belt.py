"""VERSUS championship belt, built procedurally in Blender (original design; reference: modern MMA title
belts). Imported by render_portraits.py.

  make_plate()      the centre plate in local space (face +Z): black backing octagon, polished chrome frame
                    set with glass gems, gold field with a raised inner rim, dark recessed centre with raised
                    VERSUS lettering, WORLD / CHAMPION lettering on the frame
  make_side_plate() the small gold octagons that run along the strap
  ribbon()          a flat strap following a path, lying on the body (per-point surface normals), with gold
                    stitching along both edges
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

def _srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)

def materials():
    def pbr(nm, col, metal, rough, **kw):
        m = bpy.data.materials.get(nm) or bpy.data.materials.new(nm); m.use_nodes = True
        p = m.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = (*_srgb(col), 1); p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
        for k, v in kw.items(): p.inputs[k].default_value = v
        return m
    return dict(
        gold=pbr('belt_gold', '#e6b34a', 1, .16), gold_dark=pbr('belt_gold_dark', '#5c4214', .9, .36),
        chrome=pbr('belt_chrome', '#eceef2', 1, .1), black=pbr('belt_black', '#0a0a0c', .4, .3),
        leather=pbr('belt_leather', '#030303', 0, .55),
        gem=pbr('belt_gem', '#ffffff', 0, 0, **{'Transmission Weight': 1, 'IOR': 2.4}),
    )

def _octa(bm, r, z0, z1, rot=math.pi / 8, inner=None):
    """octagonal prism (or ring when inner is given) between z0 and z1"""
    pts = [(math.cos(rot + k * math.pi / 4), math.sin(rot + k * math.pi / 4)) for k in range(8)]
    if inner is None:
        bot = [bm.verts.new((r * x, r * y, z0)) for x, y in pts]; top = [bm.verts.new((r * x, r * y, z1)) for x, y in pts]
        bm.faces.new(top); bm.faces.new(list(reversed(bot)))
        for k in range(8): j = (k + 1) % 8; bm.faces.new([bot[k], bot[j], top[j], top[k]])
    else:
        ob = [bm.verts.new((r * x, r * y, z0)) for x, y in pts]; ot = [bm.verts.new((r * x, r * y, z1)) for x, y in pts]
        ib = [bm.verts.new((inner * x, inner * y, z0)) for x, y in pts]; it = [bm.verts.new((inner * x, inner * y, z1)) for x, y in pts]
        for k in range(8):
            j = (k + 1) % 8
            bm.faces.new([ot[k], ot[j], it[j], it[k]]); bm.faces.new([ob[k], ob[j], ot[j], ot[k]]); bm.faces.new([it[k], it[j], ib[j], ib[k]])

def _mesh(name, build, mat, parent, bevel=0.):
    bm = bmesh.new(); build(bm)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.parent = parent
    if bevel:
        b = o.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 2; b.limit_method = 'ANGLE'
    for p in me.polygons: p.use_smooth = True
    return o

def _text(body, size, z, mat, parent, y=0., extrude=.0015):
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = body; cu.size = size; cu.extrude = extrude; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.bevel_depth = extrude * .4; cu.space_character = 1.06
    o = bpy.data.objects.new('t_' + body, cu); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    o.parent = parent; o.location = (0, y, z)
    return o

def make_plate(M, scale=1.0):
    root = bpy.data.objects.new('belt_plate', None); bpy.context.collection.objects.link(root)
    R = .16 * scale
    _mesh('plate_back', lambda bm: _octa(bm, R, 0, .01), M['black'], root, .003)
    _mesh('plate_frame', lambda bm: _octa(bm, R * .95, .008, .024, inner=R * .74), M['chrome'], root, .004)
    _mesh('plate_field', lambda bm: _octa(bm, R * .74, .008, .02), M['gold'], root, .002)
    _mesh('plate_rim', lambda bm: _octa(bm, R * .66, .02, .027, inner=R * .6), M['gold'], root, .0015)
    _mesh('plate_centre', lambda bm: _octa(bm, R * .6, .019, .021), M['gold_dark'], root)
    for k in range(32):   # gems set into the chrome frame
        a = 2 * math.pi * k / 32
        r = R * .865 / math.cos(((a - math.pi / 8) % (math.pi / 4)) - math.pi / 8)   # follow the octagon edge
        g = bpy.data.meshes.new('gem'); bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=R * .045); bm.to_mesh(g); bm.free()
        g.materials.append(M['gem']); o = bpy.data.objects.new('gem', g); bpy.context.collection.objects.link(o)
        o.parent = root; o.location = (r * math.cos(a), r * math.sin(a), .026); o.scale = (1, 1, .55)
    _text('VERSUS', R * .3, .021, M['gold'], root, extrude=.003)
    _text('WORLD', R * .085, .024, M['gold'], root, y=R * .785)
    _text('CHAMPION', R * .085, .024, M['gold'], root, y=-R * .785)
    return root

def make_side_plate(M, r=.045):
    root = bpy.data.objects.new('side_plate', None); bpy.context.collection.objects.link(root)
    _mesh('sp_back', lambda bm: _octa(bm, r, 0, .006), M['gold'], root, .0015)
    _mesh('sp_centre', lambda bm: _octa(bm, r * .68, .006, .009), M['black'], root)
    _mesh('sp_rim', lambda bm: _octa(bm, r * .78, .006, .011, inner=r * .68), M['gold'], root, .001)
    return root

def _catmull(pts, n):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1]); return out

def ribbon(M, pts, normals, width=.085, thick=.009, n=10):
    """a flat leather strap along pts, lying on the surface given by normals, gold stitching on both edges"""
    P = _catmull([Vector(p) for p in pts], n); N = _catmull([Vector(v).normalized() for v in normals], n)
    def strip(name, half, lift, mat, th):
        bm = bmesh.new(); rows = []
        for i, p in enumerate(P):
            t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized(); nn = N[i].normalized()
            s = t.cross(nn).normalized()
            c = p + nn * lift
            rows.append([bm.verts.new(c + s * a + nn * b) for a, b in ((-half, 0), (half, 0), (half, th), (-half, th))])
        for i in range(len(rows) - 1):
            a, b = rows[i], rows[i + 1]
            for k in range(4): j = (k + 1) % 4; bm.faces.new([a[k], a[j], b[j], b[k]])
        bm.faces.new(rows[0]); bm.faces.new(list(reversed(rows[-1])))
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
        for f in me.polygons: f.use_smooth = True
        o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); return o
    strap = strip('strap', width / 2, 0, M['leather'], thick)
    for e in (-1, 1):   # stitching: thin gold lines just inside each edge
        o = strip('stitch', .0018, thick, M['gold'], .0012)
        for v in o.data.vertices: pass
        o.location = (0, 0, 0)
    # shift stitch strips to the edges by rebuilding with an offset centre line
    for o in [o for o in bpy.data.objects if o.name.startswith('stitch')]: bpy.data.objects.remove(o, do_unlink=True)
    for e in (-1, 1):
        bm = bmesh.new(); rows = []
        for i, p in enumerate(P):
            t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized(); nn = N[i].normalized(); s = t.cross(nn).normalized()
            c = p + nn * thick + s * e * (width / 2 - .007)
            rows.append([bm.verts.new(c - s * .0016), bm.verts.new(c + s * .0016), bm.verts.new(c + s * .0016 + nn * .0012), bm.verts.new(c - s * .0016 + nn * .0012)])
        for i in range(len(rows) - 1):
            a, b = rows[i], rows[i + 1]
            for k in range(4): j = (k + 1) % 4; bm.faces.new([a[k], a[j], b[j], b[k]])
        me = bpy.data.meshes.new('stitch'); bm.to_mesh(me); bm.free(); me.materials.append(M['gold'])
        o = bpy.data.objects.new('stitch', me); bpy.context.collection.objects.link(o)
    return P, N

def place(obj, pos, normal, up=Vector((0, 0, 1)), tilt=0.):
    """put a +Z-facing piece at pos facing along normal, its local +Y toward 'up', rotated by tilt"""
    z = Vector(normal).normalized(); x = Vector(up).cross(z).normalized(); y = z.cross(x)
    m = Matrix((x, y, z)).transposed().to_4x4() @ Matrix.Rotation(tilt, 4, 'Z')
    m.translation = Vector(pos); obj.matrix_world = m
