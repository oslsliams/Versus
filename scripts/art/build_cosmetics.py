"""VERSUS character customisation, built in Blender: original tattoo designs and fight / walkout gear.

  Tattoos  every design is drawn as flat 2D artwork (polygons + lettering), rendered to an image, then
           wrapped onto the fighter body (raycast-fitted grids around a limb or projected onto the torso)
           and BAKED into the shared MakeHuman skin UV layout. Output is one RGBA ink mask per design,
           cropped, plus a manifest. The game multiplies the ink onto each fighter's own skin texture at
           runtime, so every design works on every body.
             public/cosmetics/tattoos/<id>.png       ink mask (crop of the 2048 UV space)
             public/cosmetics/tattoos/<id>-art.png   the flat artwork (UI thumbnail)
             public/cosmetics/tattoos.json           {id: {x, y, w, h}} crop rects (top-left origin)
  Gear     meshes fitted to each body by raycasting out from the bones (ankle sleeves, knee sleeve,
           kinesiology tape, walkout chain and bandana), skinned to the shared skeleton and exported per
           body: public/cosmetics/gear-<model>.glb (armature + gear only, no animation).

Run: blender -b --factory-startup -P scripts/art/build_cosmetics.py -- <models_dir> <out_dir> [tattoos] [gear]
"""
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import tessellate_polygon

args = sys.argv[sys.argv.index('--') + 1:]
MODELS, OUT = os.path.abspath(args[0]), os.path.abspath(args[1])
DO = set(args[2:]) or {'tattoos', 'gear'}
BODIES = ['okafor', 'volkov', 'takeda', 'ashford', 'kalani', 'bianchi', 'mwangi', 'delacroix']
FONTS = r'C:\Windows\Fonts'
TEX = 2048
os.makedirs(os.path.join(OUT, 'tattoos'), exist_ok=True)

TORSO = ('Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder')

def load_body(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, f'fighter-{name}.glb'))
    for o in [o for o in bpy.data.objects if o.name.startswith('Icosphere')]: bpy.data.objects.remove(o, do_unlink=True)
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    if rig.animation_data:
        rig.animation_data.action = None
        for t in rig.animation_data.nla_tracks: t.mute = True
    rig.data.pose_position = 'REST'
    for pb in rig.pose.bones: pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    body = next(o for o in bpy.data.objects if o.type == 'MESH' and any(m and m.name == 'Human.body' for m in o.data.materials))
    return rig, body

def bvh_of(objs, torso_only=False):
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        tmp = bmesh.new(); tmp.from_mesh(me); tmp.transform(o.matrix_world)
        if torso_only:
            names = {g.index: g.name.replace('mixamorig:', '') for g in o.vertex_groups}
            keep = set()
            for v in o.data.vertices:
                if v.groups:
                    g = max(v.groups, key=lambda x: x.weight)
                    if names.get(g.group) in TORSO: keep.add(v.index)
            tmp.verts.ensure_lookup_table()
            bmesh.ops.delete(tmp, geom=[f for f in tmp.faces if not all(v.index in keep for v in f.verts)], context='FACES')
        me2 = bpy.data.meshes.new('t'); tmp.to_mesh(me2); tmp.free(); bm.from_mesh(me2); bpy.data.meshes.remove(me2)
        o.evaluated_get(dg).to_mesh_clear()
    t = BVHTree.FromBMesh(bm); bm.free(); return t

def bone(rig, n):
    b = rig.data.bones['mixamorig:' + n]
    return rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local

def frame(axis, front=Vector((0, -1, 0))):
    a = axis.normalized(); e1 = (front - a * front.dot(a)).normalized(); return a, e1, a.cross(e1)

def emit_mat(name, img=None, color=(1, 1, 1)):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs[0])
    if img:
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; tx.interpolation = 'Cubic'
        nt.links.new(tx.outputs['Alpha'], em.inputs['Color'])
    else: em.inputs['Color'].default_value = (*color, 1)
    return m

# =============================================================================== tattoo artwork
def poly_obj(name, loops, coll):
    """filled 2D shape (outer loop + optional holes) as a mesh in the XY plane"""
    verts = [Vector((x, y, 0)) for loop in loops for x, y in loop]
    tris = tessellate_polygon([[Vector((x, y, 0)) for x, y in loop] for loop in loops])
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], [tuple(t) for t in tris]); me.update()
    o = bpy.data.objects.new(name, me); coll.objects.link(o); return o

def text_obj(body, font, size, coll, x=0., y=0., rot=0., spacing=1.0):
    cu = bpy.data.curves.new('txt', 'FONT'); cu.body = body; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, font), check_existing=True); cu.space_character = spacing
    o = bpy.data.objects.new('txt', cu); coll.objects.link(o); o.location = (x, y, 0); o.rotation_euler = (0, 0, rot); return o

def circle(r, n=48, cx=0., cy=0., a0=0.): return [(cx + r * math.cos(a0 + 2 * math.pi * k / n), cy + r * math.sin(a0 + 2 * math.pi * k / n)) for k in range(n)]
def star(r1, r2, n=5, cx=0., cy=0., a0=math.pi / 2): return [(cx + (r1 if k % 2 == 0 else r2) * math.cos(a0 + math.pi * k / n), cy + (r1 if k % 2 == 0 else r2) * math.sin(a0 + math.pi * k / n)) for k in range(2 * n)]
def bez(p0, p1, p2, n=10): return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [k / n for k in range(n + 1)]]

def art_tribal(c, W, H):
    poly_obj('band', [[(-W / 2, -.009), (W / 2, -.009), (W / 2, .009), (-W / 2, .009)]], c)
    n = 6; step = W / n
    for i in range(n):
        x0 = -W / 2 + i * step
        for s in (1, -1):
            off = 0 if s == 1 else step / 2
            a = (x0 + off, s * .008); b = (x0 + off + step * .62, s * .008)
            tip = (x0 + off + step * .95, s * H * .48)
            loop = bez(a, (a[0] + step * .15, s * H * .3), tip, 12) + bez(tip, (b[0] - step * .05, s * H * .16), b, 12)[1:]
            poly_obj('spike', [loop], c)
            poly_obj('dot', [circle(.0045, 16, x0 + off + step * .25, s * .021)], c)

def art_rows(c, W, H, rows):
    """Polynesian-style sleeve: stacked bands of solid stripes, shark teeth, chevrons, spearheads and dots"""
    y = -H / 2
    for kind, h in rows:
        if kind == 'stripe': poly_obj('s', [[(-W / 2, y), (W / 2, y), (W / 2, y + h), (-W / 2, y + h)]], c)
        elif kind == 'teeth':
            n = max(6, int(W / h * .9))
            for i in range(n):
                x = -W / 2 + i * W / n; poly_obj('t', [[(x, y), (x + W / n, y), (x + W / n * .5, y + h)]], c)
        elif kind == 'teeth_down':
            n = max(6, int(W / h * .9))
            for i in range(n):
                x = -W / 2 + i * W / n; poly_obj('t', [[(x, y + h), (x + W / n * .5, y), (x + W / n, y + h)]], c)
        elif kind == 'chevron':
            n = max(5, int(W / (h * 1.6))); w = W / n; t = h * .32
            for i in range(n):
                x = -W / 2 + i * w
                poly_obj('v', [[(x, y + h), (x + w / 2, y + t), (x + w, y + h), (x + w, y + h - t), (x + w / 2, y), (x, y + h - t)]], c)
        elif kind == 'spear':
            n = max(5, int(W / (h * 1.1))); w = W / n
            for i in range(n):
                x = -W / 2 + i * w; cx = x + w / 2
                poly_obj('p', [[(cx, y + h), (x + w * .9, y + h * .45), (cx, y), (x + w * .1, y + h * .45)]], c)
                poly_obj('pd', [circle(h * .1, 12, cx, y + h * .45)], c)
        elif kind == 'dots':
            n = max(8, int(W / (h * 1.4)))
            for i in range(n): poly_obj('d', [circle(h * .33, 16, -W / 2 + (i + .5) * W / n, y + h / 2)], c)
        y += h + .004

def art_wings(c, W, H):
    """spread wings: separate blade-shaped feathers with negative space between them, a shield in the middle"""
    for side in (1, -1):
        # upper arm of the wing: a curved bar the feathers hang from
        bar = [(side * (.03 + t * W * .44), H * .2 + math.sin(t * math.pi) * .02 - t * .01) for t in [k / 16 for k in range(17)]]
        poly_obj('bar', [bar + [(x, y - .007 - .004 * (1 - abs(x) / (W * .5))) for x, y in reversed(bar)]], c)
        for k in range(9):
            t = (k + .5) / 9; bx, by = side * (.035 + t * W * .42), H * .2 + math.sin(t * math.pi) * .02 - t * .01 - .006
            L = H * (.62 - .35 * t) ; w = .0085 - t * .003
            sweep = side * (.12 + t * .7)                  # feathers fan outward along the wing
            d = (math.sin(sweep), -math.cos(sweep)); nrm = (-d[1], d[0])
            tip = (bx + d[0] * L, by + d[1] * L)
            loop = bez((bx + nrm[0] * w, by + nrm[1] * w), (bx + d[0] * L * .55 + nrm[0] * w * 1.5, by + d[1] * L * .55 + nrm[1] * w * 1.5), tip, 10) \
                + bez(tip, (bx + d[0] * L * .5 - nrm[0] * w * 1.2, by + d[1] * L * .5 - nrm[1] * w * 1.2), (bx - nrm[0] * w, by - nrm[1] * w), 10)[1:]
            poly_obj('feather', [loop], c)
    sh = [(0, H * .32), (.026, H * .25), (.024, H * .02), (0, -H * .2), (-.024, H * .02), (-.026, H * .25)]
    poly_obj('shield', [sh, [(x * .72, y * .72 + H * .02) for x, y in sh]], c)
    poly_obj('core', [star(.012, .005, 4, 0, H * .07)], c)

def art_mandala(c, R):
    poly_obj('o', [circle(R, 64), circle(R * .93, 64)], c)
    for k in range(12):
        a = 2 * math.pi * k / 12
        tip = (R * .88 * math.cos(a), R * .88 * math.sin(a))
        l = (R * .45 * math.cos(a - .22), R * .45 * math.sin(a - .22)); r = (R * .45 * math.cos(a + .22), R * .45 * math.sin(a + .22))
        poly_obj('petal', [bez(l, (R * .75 * math.cos(a - .2), R * .75 * math.sin(a - .2)), tip, 8) + bez(tip, (R * .75 * math.cos(a + .2), R * .75 * math.sin(a + .2)), r, 8)[1:] + [(R * .52 * math.cos(a), R * .52 * math.sin(a))]], c)
    poly_obj('mid', [circle(R * .4, 48), circle(R * .33, 48)], c)
    poly_obj('core', [star(R * .28, R * .12, 8)], c)
    for k in range(24): a = 2 * math.pi * (k + .5) / 24; poly_obj('dot', [circle(R * .03, 10, R * .965 * math.cos(a) * .95, R * .965 * math.sin(a) * .95)], c)

def art_nautical(c, R):
    pts = star(R, R * .42, 5)
    for k in range(5):   # nautical star: each point split into a solid half and an outlined half
        tip, l, r = pts[2 * k], pts[(2 * k - 1) % 10], pts[2 * k + 1]
        poly_obj('half', [[(0, 0), l, tip]], c)
        poly_obj('edge', [[(0, 0), tip, r, (r[0] * .9, r[1] * .9), (tip[0] * .88, tip[1] * .88), (0, 0)]], c)
    poly_obj('outline', [pts, [(x * .86, y * .86) for x, y in pts]], c)

def art_diamonds(c, W, H):
    poly_obj('a', [[(-W / 2, H / 2 - .005), (W / 2, H / 2 - .005), (W / 2, H / 2), (-W / 2, H / 2)]], c)
    poly_obj('b', [[(-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, -H / 2 + .005), (-W / 2, -H / 2 + .005)]], c)
    n = 9; w = W / n
    for i in range(n):
        cx = -W / 2 + (i + .5) * w; h = H * .36
        poly_obj('d', [[(cx, h), (cx + w * .42, 0), (cx, -h), (cx - w * .42, 0)], [(cx, h * .45), (cx + w * .19, 0), (cx, -h * .45), (cx - w * .19, 0)]], c)

def arc_text(c, text, font, size, radius, span):
    """lettering bent along an arc (centre of the arc below the text)"""
    n = len(text)
    for i, ch in enumerate(text):
        if ch == ' ': continue
        a = -span / 2 + span * (i + .5) / n
        text_obj(ch, font, size, c, radius * math.sin(a), radius * math.cos(a) - radius, -a)

# id -> (W, H, draw, placements); placements: ('wrap', bone, t_centre, full|arc_deg) or ('plane', anchor, offset, right, up, dir, torso)
TATTOOS = {
    'tribal_band':  (.33, .075, lambda c: art_tribal(c, .33, .075), [('wrap', 'LeftArm', .5, 'full')]),
    'sleeve':      (.33, .25, lambda c: art_rows(c, .33, .25, [('stripe', .012), ('teeth', .03), ('dots', .012), ('chevron', .034), ('stripe', .008), ('spear', .042), ('teeth_down', .03), ('stripe', .012), ('teeth', .026)]),
                     [('wrap', 'RightArm', .56, 'full')]),
    'sleeve_fore':  (.27, .2, lambda c: art_rows(c, .27, .2, [('teeth_down', .026), ('stripe', .01), ('spear', .038), ('dots', .011), ('chevron', .03), ('stripe', .012), ('teeth', .028)]),
                     [('wrap', 'RightForeArm', .5, 'full')]),
    'script_fore':  (.07, .19, lambda c: text_obj('Loyalty', 'OLDENGL.TTF', .052, c, rot=math.pi / 2), [('wrap', 'LeftForeArm', .52, 'arc')]),
    'chest_wings':  (.36, .17, lambda c: art_wings(c, .36, .17), [('plane', 'Spine2', (0, 0, .045), (1, 0, 0), (0, 0, 1), (0, 1, 0), True)]),
    'back_script':  (.34, .13, lambda c: arc_text(c, 'NO RETREAT', 'OLDENGL.TTF', .05, .55, .62), [('plane', 'Spine2', (0, 0, .09), (-1, 0, 0), (0, 0, 1), (0, -1, 0), True)]),
    'rib_script':   (.18, .07, lambda c: text_obj('Faith', 'BRUSHSCI.TTF', .062, c), [('plane', 'Spine1', (0, .01, .0), (0, 1, 0), (0, 0, 1), (-1, 0, 0), True)]),
    'stomach_word': (.2, .05, lambda c: text_obj('Blessed', 'OLDENGL.TTF', .046, c), [('plane', 'Spine', (0, 0, -.015), (1, 0, 0), (0, 0, 1), (0, 1, 0), True)]),
    'neck_star':    (.046, .046, lambda c: art_nautical(c, .021), [('plane', 'Neck', (0, .012, .004), (0, -1, 0), (0, 0, 1), (1, 0, 0), True)]),
    'mandala':      (.11, .11, lambda c: art_mandala(c, .052), [('plane', 'LeftArm', (.045, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, -1), False)]),
    'calf_band':    (.32, .06, lambda c: art_diamonds(c, .32, .06), [('wrap', 'RightLeg', .38, 'full')]),
}

def render_art(tid, W, H, draw, path):
    sc = bpy.data.scenes.new('art_' + tid); coll = sc.collection
    draw(coll)
    for o in coll.objects:
        o.color = (1, 1, 1, 1)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); coll.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(W, H) * 1.0; cam.location = (0, 0, 1)
    ppm = 3200; sc.render.resolution_x = int(W * ppm); sc.render.resolution_y = int(H * ppm)
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'FLAT'; sc.display.shading.color_type = 'OBJECT'
    sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'; sc.render.filepath = path
    sc.display.render_aa = '16'
    bpy.ops.render.render(write_still=True, scene=sc.name)
    return bpy.data.images.load(path, check_existing=False)

def grid(name, nu, nv, place, mat):
    """nu x nv grid over the design rect; place(u, v) -> world point or None (u, v in 0..1)"""
    verts, uvs, idx = [], [], {}
    for j in range(nv + 1):
        for i in range(nu + 1):
            p = place(i / nu, j / nv)
            if p is not None: idx[(i, j)] = len(verts); verts.append(p); uvs.append((i / nu, j / nv))
    faces = [(idx[(i, j)], idx[(i + 1, j)], idx[(i + 1, j + 1)], idx[(i, j + 1)]) for j in range(nv) for i in range(nu)
             if all(k in idx for k in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)))]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices: uv.data[li].uv = uvs[me.loops[li].vertex_index]
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

def build_tattoos():
    rig, body = load_body('kalani')
    full, torso = bvh_of([body]), bvh_of([body], torso_only=True)
    main = bpy.context.scene
    main.render.engine = 'CYCLES'; main.cycles.device = 'CPU'; main.cycles.samples = 1
    bake = bpy.data.images.new('bake', TEX, TEX, alpha=False); bake.colorspace_settings.name = 'Non-Color'
    for m in body.data.materials:
        if not m: continue
        m.use_nodes = True; nt = m.node_tree; tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = bake; nt.nodes.active = tx
    manifest = {}
    for tid, (W, H, draw, places) in TATTOOS.items():
        art_path = os.path.join(OUT, 'tattoos', f'{tid}-art.png')
        img = render_art(tid, W, H, draw, art_path)
        mat = emit_mat('ink_' + tid, img)
        objs = []
        for pl in places:
            if pl[0] == 'wrap':
                _, bn, tc, mode = pl
                h, t = bone(rig, bn); L = (t - h).length; a, e1, e2 = frame(t - h)
                mid = h + (t - h) * tc
                rs = [full.ray_cast(mid, math.cos(th) * e1 + math.sin(th) * e2, .3)[3] or .05 for th in [k * math.pi / 8 for k in range(16)]]
                r_mid = sum(rs) / len(rs)
                def place(u, v, h=h, t=t, L=L, e1=e1, e2=e2, tc=tc, mode=mode, r_mid=r_mid):
                    th = (u - .5) * 2 * math.pi if mode == 'full' else (u - .5) * W / r_mid
                    c = h + (t - h) * (tc + (v - .5) * H / L)
                    d = math.cos(th) * e1 + math.sin(th) * e2
                    hit = full.ray_cast(c, d, .095)     # limb skin only: a long ray would land on the torso
                    return None if hit[0] is None else hit[0] + hit[1] * .0015
                objs.append(grid('g_' + tid, 96 if mode == 'full' else 24, 40, place, mat))
            else:
                _, bn, off, rv, uv, dv, torso_only = pl
                h, _t = bone(rig, bn); o = h + Vector(off); R, U, D = Vector(rv).normalized(), Vector(uv).normalized(), Vector(dv).normalized()
                tree = torso if torso_only else full
                def place(u, v, o=o, R=R, U=U, D=D, tree=tree):
                    p = o + R * (u - .5) * W + U * (v - .5) * H
                    hit = tree.ray_cast(p - D * .3, D, .6)
                    return None if hit[0] is None else hit[0] + hit[1] * .0015
                objs.append(grid('g_' + tid, 60, max(12, int(60 * H / W)), place, mat))
        # bake: the art grids (selected) emit onto the body's UV map (active)
        for o in bpy.data.objects: o.select_set(False)
        for o in objs: o.select_set(True)
        body.select_set(True); bpy.context.view_layer.objects.active = body
        bpy.ops.object.bake(type='EMIT', use_selected_to_active=True, cage_extrusion=.012, max_ray_distance=.03, margin=3, use_clear=True)
        px = np.empty(TEX * TEX * 4, dtype=np.float32); bake.pixels.foreach_get(px); px = px.reshape(TEX, TEX, 4)
        # crop to the inked area, write RGBA (ink black, alpha = mask) with a top-left origin rect
        m = px[:, :, 0]
        ys, xs = np.nonzero(m > .03)
        if not len(xs): print('EMPTY', tid); continue
        x0, x1, y0, y1 = max(0, xs.min() - 4), min(TEX - 1, xs.max() + 4), max(0, ys.min() - 4), min(TEX - 1, ys.max() + 4)
        w, h = int(x1 - x0 + 1), int(y1 - y0 + 1)
        crop = bpy.data.images.new('crop_' + tid, w, h, alpha=True)
        out = np.zeros((h, w, 4), dtype=np.float32); out[:, :, 3] = np.clip(m[y0:y1 + 1, x0:x1 + 1] * 1.05, 0, 1)
        crop.pixels.foreach_set(out.ravel())
        crop.filepath_raw = os.path.join(OUT, 'tattoos', f'{tid}.png'); crop.file_format = 'PNG'; crop.save()
        manifest[tid] = {'x': int(x0), 'y': int(TEX - (y0 + h)), 'w': w, 'h': h}
        for o in objs: bpy.data.objects.remove(o, do_unlink=True)
        print('TATTOO', tid, manifest[tid])
    json.dump({'size': TEX, 'tattoos': manifest}, open(os.path.join(OUT, 'tattoos.json'), 'w'), indent=1)

# ================================================================================ gear
def pbr(name, col, metal=0., rough=.6):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*col, 1); p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    return m

def skinned(name, verts, faces, weights, mat, rig, smooth=True):
    """weights: per vertex dict bone -> w"""
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = smooth
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    groups = {}
    for i, wd in enumerate(weights):
        for bn, w in wd.items():
            if w <= 0: continue
            g = groups.get(bn) or o.vertex_groups.new(name='mixamorig:' + bn); groups[bn] = g
            g.add([i], w, 'REPLACE')
    o.parent = rig; mod = o.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
    return o

def tube(tree, sections, n=28, gap=.003, thick=.004):
    """sections: [(centre, axis, weights)] -> closed sleeve hugging the surface (outer + inner skins)"""
    verts, faces, wts = [], [], []
    rings = []
    for c, ax, w in sections:
        a, e1, e2 = frame(ax)
        ring = []
        for k in range(n):
            th = 2 * math.pi * k / n; d = math.cos(th) * e1 + math.sin(th) * e2
            hit = tree.ray_cast(c, d, .35); r = hit[3] if hit[0] is not None else .05
            ring.append((c, d, r))
        rings.append((ring, w))
    # smooth radii around each ring (tames spikes from stray hits)
    for ring, _ in rings:
        rs = [r for _, _, r in ring]
        for k in range(n): ring[k] = (ring[k][0], ring[k][1], (rs[k - 1] + 2 * rs[k] + rs[(k + 1) % n]) / 4)
    for layer, off in ((0, gap + thick), (1, gap)):
        for ring, w in rings:
            for c, d, r in ring: verts.append(c + d * (r + off)); wts.append(w)
    R = len(rings)
    def vi(layer, j, k): return layer * R * n + j * n + (k % n)
    for j in range(R - 1):
        for k in range(n):
            faces.append((vi(0, j, k), vi(0, j, k + 1), vi(0, j + 1, k + 1), vi(0, j + 1, k)))
            faces.append((vi(1, j, k), vi(1, j + 1, k), vi(1, j + 1, k + 1), vi(1, j, k + 1)))
    for j, flip in ((0, True), (R - 1, False)):   # lips joining outer and inner skins
        for k in range(n):
            f = (vi(0, j, k), vi(1, j, k), vi(1, j, k + 1), vi(0, j, k + 1))
            faces.append(f if flip else tuple(reversed(f)))
    return verts, faces, wts

def chain_pts(rig, n, a_bone, b_bone, t0, t1):
    """points along a two-bone chain, t in 0..2 (0..1 first bone, 1..2 second)"""
    h1, t1b = bone(rig, a_bone); h2, t2b = bone(rig, b_bone)
    out = []
    for i in range(n):
        t = t0 + (t1 - t0) * i / (n - 1)
        if t <= 1: c = h1 + (t1b - h1) * t; ax = (t1b - h1)
        else: c = h2 + (t2b - h2) * (t - 1); ax = (t2b - h2)
        out.append((c, ax.normalized(), t))
    return out

def build_gear(name):
    rig, body = load_body(name)
    hair = [o for o in bpy.data.objects if o.type == 'MESH' and o is not body and not any(k in o.name for k in ('eye', 'brow', 'lash', 'high-poly'))]
    full = bvh_of([body]); headtree = bvh_of([body] + hair)
    M = {'ankle': pbr('gear_ankle', (.9, .9, .88), 0, .85), 'knee': pbr('gear_knee', (.03, .03, .035), 0, .5),
         'tape': pbr('gear_tape', (.05, .32, .85), 0, .45), 'chain': pbr('gear_chain', (1, .72, .3), 1, .18), 'band': pbr('gear_band', (.62, .03, .05), 0, .7)}
    made = []
    # ---- ankle sleeves: lower shin over the ankle, plus a band round the arch (heel left open, like real ones)
    for side in ('Left', 'Right'):
        secs = [(c, ax, {side + 'Leg': 1.0}) for c, ax, t in chain_pts(rig, 9, side + 'Leg', side + 'Foot', .78, .965)]
        v, f, w = tube(full, secs, gap=.002, thick=.004); made.append(skinned(f'gear_ankle_{side}', v, f, w, M['ankle'], rig))
        secs = [(c, ax, {side + 'Foot': 1.0}) for c, ax, t in chain_pts(rig, 5, side + 'Foot', side + 'ToeBase', .3, .62)]
        v, f, w = tube(full, secs, gap=.002, thick=.004); made.append(skinned(f'gear_ankle_{side}_arch', v, f, w, M['ankle'], rig))
    # ---- knee sleeve (left), bending with the joint
    secs = []
    for c, ax, t in chain_pts(rig, 12, 'LeftUpLeg', 'LeftLeg', .8, 1.22):
        k = min(1, max(0, (t - .92) / .16)); secs.append((c, ax, {'LeftUpLeg': 1 - k, 'LeftLeg': k}))
    v, f, w = tube(full, secs, gap=.002, thick=.005); made.append(skinned('gear_knee', v, f, w, M['knee'], rig))
    # ---- kinesiology tape: two strips over the right deltoid (one down the arm, one across it)
    sh_h, sh_t = bone(rig, 'RightArm')
    for i, (ang, L) in enumerate(((0, .17), (math.radians(62), .13))):
        a, e1, e2 = frame(sh_t - sh_h)
        out = (e2 if e2.z > 0 else -e2)   # the top of the arm in the T-pose rest = the outside of the deltoid
        along = a * math.cos(ang) + e1 * math.sin(ang)
        o = sh_h + (sh_t - sh_h) * .2 + out * .2
        verts, faces, wts = [], [], []
        nu, nv = 6, 24
        for j in range(nv + 1):
            for k in range(nu + 1):
                p = o + along * (j / nv - .15) * L + along.cross(out).normalized() * (k / nu - .5) * .046
                hit = full.ray_cast(p, -out, .4)
                q = (hit[0] + hit[1] * .004) if hit[0] is not None else p - out * .15
                verts.append(q); tz = (j / nv); wts.append({'RightArm': .55 + .45 * tz, 'RightShoulder': .45 - .45 * tz})
        for j in range(nv):
            for k in range(nu): faces.append((j * (nu + 1) + k, j * (nu + 1) + k + 1, (j + 1) * (nu + 1) + k + 1, (j + 1) * (nu + 1) + k))
        made.append(skinned(f'gear_tape_{i}', verts, faces, wts, M['tape'], rig))
    # ---- walkout chain: links round the base of the neck, hanging lower at the front
    nh, nt = bone(rig, 'Neck'); c0 = nh + Vector((0, 0, -.015))
    a, e1, e2 = frame(Vector((0, 0, 1)))
    path = []
    for k in range(64):
        th = 2 * math.pi * k / 64; d = math.cos(th) * e1 + math.sin(th) * e2
        drop = .05 * max(0, math.cos(th)) ** 2           # front of the neck is e1 (-Y): the chain sags onto the chest
        c = c0 + Vector((0, 0, -drop))
        # from inside the neck outward: the first skin it meets; if that's far (the ray ran out over the
        # shoulders) the chain hangs free at the neck's own radius instead
        hit = full.ray_cast(c, d, .3)
        lim = .085 + .09 * max(0, math.cos(th))         # the front reaches out over the collarbones / chest
        r = hit[3] if hit[0] is not None and hit[3] < lim else .072 + .06 * max(0, math.cos(th))
        path.append(c + d * (r + .006))
    links_v, links_f, links_w = [], [], []
    for k in range(64):
        p, q = path[k], path[(k + 1) % 64]
        tdir = (q - p).normalized(); nrm = (p - c0); nrm.z = 0; nrm.normalize()
        side = tdir.cross(nrm).normalized()
        if k % 2: nrm, side = side, nrm                 # alternate link orientation
        R1, R2, base = .0062, .0017, len(links_v)
        for i in range(10):
            u = 2 * math.pi * i / 10
            cen = p + (tdir * math.cos(u) * 1.2 + nrm * math.sin(u)) * R1
            for j in range(6):
                vv = 2 * math.pi * j / 6
                radial = (tdir * math.cos(u) + nrm * math.sin(u)).normalized()
                links_v.append(cen + (radial * math.cos(vv) + side * math.sin(vv)) * R2); links_w.append({'Spine2': .7, 'Neck': .3})
        for i in range(10):
            for j in range(6): links_f.append((base + i * 6 + j, base + i * 6 + (j + 1) % 6, base + ((i + 1) % 10) * 6 + (j + 1) % 6, base + ((i + 1) % 10) * 6 + j))
    made.append(skinned('gear_chain', links_v, links_f, links_w, M['chain'], rig))
    # ---- walkout bandana: a band round the forehead (over the hair) with two tails knotted at the back
    hh, ht = bone(rig, 'Head')
    top = max((body.matrix_world @ v.co).z for v in body.data.vertices if (body.matrix_world @ v.co - hh).length < .35)
    secs = []
    for i in range(5):
        z = top - .075 + i * .009
        secs.append((Vector((hh.x, hh.y + .01, z)), Vector((0, .25, 1)), {'Head': 1.0}))
    v, f, w = tube(headtree, secs, n=40, gap=.003, thick=.004); made.append(skinned('gear_band', v, f, w, M['band'], rig))
    back = Vector((hh.x, hh.y + .01, top - .06)); hit = headtree.ray_cast(back + Vector((0, .3, 0)), Vector((0, -1, 0)), .4)
    knot = (hit[0] + Vector((0, .012, 0))) if hit[0] is not None else back + Vector((0, .1, 0))
    for s in (1, -1):
        verts, faces, wts = [], [], []
        for j in range(9):
            t = j / 8; p = knot + Vector((s * .02 * t, .02 * t, -.11 * t))
            for k in (-1, 1): verts.append(p + Vector((s * .004 * k, 0, 0)) + Vector((0, 0, .012 * k * (1 - t * .4)))); wts.append({'Head': 1.0})
        for j in range(8): faces.append((2 * j, 2 * j + 1, 2 * j + 3, 2 * j + 2))
        made.append(skinned(f'gear_band_tail{s}', verts, faces, wts, M['band'], rig, smooth=False))
    # ---- export: armature + gear only
    for o in bpy.data.objects: o.select_set(False)
    rig.select_set(True)
    for o in made: o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    path = os.path.join(OUT, f'gear-{name}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_yup=True, export_apply=False, export_morph=False)
    print('GEAR', name, os.path.getsize(path))

if 'tattoos' in DO: build_tattoos()
if 'gear' in DO:
    for b in BODIES: build_gear(b)
