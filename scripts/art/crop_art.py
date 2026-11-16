"""Trim transparent margins from rendered art.
Run: blender -b --factory-startup -P scripts/art/crop_art.py -- public/art
"""
import bpy, sys, os
import numpy as np

d = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
for f in sorted(os.listdir(d)):
    if not f.endswith('.webp'):
        continue
    p = os.path.join(d, f)
    img = bpy.data.images.load(p)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    ys, xs = np.where(px[:, :, 3] > 0.02)
    if not len(xs):
        continue
    pad = 16
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1)
    side = max(x1 - x0, y1 - y0)  # keep square so layouts stay predictable
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    x0, y0 = max(0, cx - side // 2), max(0, cy - side // 2)
    x1, y1 = min(w, x0 + side), min(h, y0 + side)
    crop = px[y0:y1, x0:x1].copy()
    out = bpy.data.images.new(f + '_c', x1 - x0, y1 - y0, alpha=True)
    out.pixels = crop.ravel()
    out.filepath_raw = p
    out.file_format = 'WEBP'
    s = bpy.context.scene
    s.render.image_settings.file_format = 'WEBP'
    s.render.image_settings.color_mode = 'RGBA'
    s.render.image_settings.quality = 88
    out.save_render(p, scene=s)
    print('CROPPED', f, w, 'x', h, '->', x1 - x0, 'x', y1 - y0)
