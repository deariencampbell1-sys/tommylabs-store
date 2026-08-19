#!/usr/bin/env python3
"""Generate small printable keychain models for the Tommy Labs catalog.

Each model:
- a 2D shape (heart, star, bat, skull, dragon head, paw, rocket, owl, T-rex,
  ghost, hex nut, mushroom, sword, fish, moon, bolt) drawn at high res
- extruded to a thin printable slab (3-5mm) with a 5mm keychain ring hole
- output: matching WebP picture, binary STL, and GLB (glTF 2.0) for the 3D viewer

Deterministic, zero AI, zero external assets. Sizes target 30-60min prints.
"""
import math, os, struct, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "keychains")
SIZE = 128          # render resolution for the shape (0.47mm/cell at 60mm — plenty for keychains)
MM = 60.0           # model longest side in mm (keychain ~60mm)
THICK = 3.2         # slab thickness mm
RING_D = 5.0        # ring hole diameter mm
RING_X = 0.35       # ring hole x position (fraction of width from center)
RING_Y = 0.62       # ring hole y position (fraction up from bottom)


def shape_masks():
    """Return {slug: (draw_fn, name, color)}. draw_fn(px, canvas) paints white shape on transparent."""
    S = {}

    def heart(d, c):
        w = c.width
        d.ellipse([w*0.18, w*0.28, w*0.5, w*0.62], fill=255)
        d.ellipse([w*0.5, w*0.28, w*0.82, w*0.62], fill=255)
        d.polygon([(w*0.16, w*0.5), (w*0.84, w*0.5), (w*0.5, w*0.92)], fill=255)
    S["heart"] = (heart, "Heart Keychain", "#f43f5e")

    def star(d, c):
        w = c.width; cx, cy = w/2, w*0.52; R, r = w*0.42, w*0.19; pts = []
        for i in range(10):
            ang = math.pi/2 + i*math.pi/5
            rad = R if i % 2 == 0 else r
            pts.append((cx+rad*math.cos(ang), cy-rad*math.sin(ang)))
        d.polygon(pts, fill=255)
    S["star"] = (star, "Star Keychain", "#fbbf24")

    def bat(d, c):
        w = c.width
        # wings
        d.polygon([(w*0.5, w*0.36), (w*0.02, w*0.14), (w*0.12, w*0.5), (w*0.02, w*0.8), (w*0.4, w*0.55)], fill=255)
        d.polygon([(w*0.5, w*0.36), (w*0.98, w*0.14), (w*0.88, w*0.5), (w*0.98, w*0.8), (w*0.6, w*0.55)], fill=255)
        d.ellipse([w*0.38, w*0.28, w*0.62, w*0.62], fill=255)          # head+body
        d.polygon([(w*0.42, w*0.5), (w*0.36, w*0.34), (w*0.5, w*0.42)], fill=255)  # left ear
        d.polygon([(w*0.58, w*0.5), (w*0.64, w*0.34), (w*0.5, w*0.42)], fill=255)  # right ear
    S["bat"] = (bat, "Bat Keychain", "#7c3aed")

    def skull(d, c):
        w = c.width
        d.ellipse([w*0.22, w*0.28, w*0.78, w*0.72], fill=255)
        d.rectangle([w*0.42, w*0.6, w*0.58, w*0.95], fill=255)
        d.ellipse([w*0.32, w*0.42, w*0.46, w*0.56], fill=0)
        d.ellipse([w*0.54, w*0.42, w*0.68, w*0.56], fill=0)
        d.polygon([(w*0.43, w*0.66), (w*0.57, w*0.66), (w*0.5, w*0.8)], fill=0)
    S["skull"] = (skull, "Skull Keychain", "#e2e8f0")

    def paw(d, c):
        w = c.width; cx, cy = w/2, w*0.62
        d.ellipse([cx-w*0.4, cy-w*0.34, cx+w*0.4, cy+w*0.34], fill=255)
        for dx in (-0.3, -0.1, 0.1, 0.3):
            d.ellipse([cx+dx*w- w*0.13, w*0.12, cx+dx*w+w*0.13, w*0.38], fill=255)
    S["paw"] = (paw, "Paw Keychain", "#f59e0b")

    def rocket(d, c):
        w = c.width
        d.polygon([(w*0.5, w*0.06), (w*0.34, w*0.4), (w*0.34, w*0.66), (w*0.66, w*0.66), (w*0.66, w*0.4)], fill=255)
        d.polygon([(w*0.5, w*0.64), (w*0.36, w*0.9), (w*0.64, w*0.9)], fill=255)
        d.ellipse([w*0.42, w*0.16, w*0.58, w*0.34], fill=0)
    S["rocket"] = (rocket, "Rocket Keychain", "#38bdf8")

    def owl(d, c):
        w = c.width
        d.ellipse([w*0.24, w*0.2, w*0.76, w*0.8], fill=255)             # body
        d.polygon([(w*0.28, w*0.3), (w*0.2, w*0.06), (w*0.44, w*0.18)], fill=255)   # left ear
        d.polygon([(w*0.72, w*0.3), (w*0.8, w*0.06), (w*0.56, w*0.18)], fill=255)   # right ear
        d.ellipse([w*0.36, w*0.4, w*0.5, w*0.54], fill=0)
        d.ellipse([w*0.5, w*0.4, w*0.64, w*0.54], fill=0)
        d.polygon([(w*0.4, w*0.6), (w*0.6, w*0.6), (w*0.5, w*0.74)], fill=0)
    S["owl"] = (owl, "Owl Keychain", "#a78bfa")

    def trex(d, c):
        w = c.width
        d.polygon([(w*0.32, w*0.62), (w*0.28, w*0.3), (w*0.4, w*0.2), (w*0.46, w*0.4),
                   (w*0.62, w*0.42), (w*0.66, w*0.3), (w*0.7, w*0.5), (w*0.86, w*0.74),
                   (w*0.62, w*0.66)], fill=255)
        d.polygon([(w*0.44, w*0.66), (w*0.4, w*0.9), (w*0.56, w*0.9), (w*0.54, w*0.66)], fill=255)
        d.ellipse([w*0.3, w*0.36, w*0.4, w*0.46], fill=0)
    S["trex"] = (trex, "T-Rex Keychain", "#4ade80")

    def ghost(d, c):
        w = c.width
        d.ellipse([w*0.28, w*0.12, w*0.72, w*0.62], fill=255)
        d.rectangle([w*0.3, w*0.5, w*0.7, w*0.9], fill=255)
        d.polygon([(w*0.3, w*0.9), (w*0.4, w*0.8), (w*0.5, w*0.9), (w*0.6, w*0.8), (w*0.7, w*0.9)], fill=255)
        d.ellipse([w*0.38, w*0.3, w*0.46, w*0.4], fill=0)
        d.ellipse([w*0.54, w*0.3, w*0.62, w*0.4], fill=0)
    S["ghost"] = (ghost, "Ghost Keychain", "#cbd5e1")

    def hex(d, c):
        w = c.width; cx, cy = w/2, w/2; pts = []
        for i in range(6):
            ang = math.pi/6 + i*math.pi/3
            pts.append((cx+w*0.4*math.cos(ang), cy+w*0.4*math.sin(ang)))
        d.polygon(pts, fill=255)
        d.ellipse([cx-w*0.16, cy-w*0.16, cx+w*0.16, cy+w*0.16], fill=0)
    S["hex"] = (hex, "Hex Nut Keychain", "#94a3b8")

    def mushroom(d, c):
        w = c.width
        d.ellipse([w*0.16, w*0.24, w*0.84, w*0.66], fill=255)
        d.rectangle([w*0.42, w*0.5, w*0.58, w*0.9], fill=255)
        d.ellipse([w*0.32, w*0.36, w*0.42, w*0.46], fill=0)
        d.ellipse([w*0.56, w*0.3, w*0.68, w*0.42], fill=0)
        d.ellipse([w*0.46, w*0.5, w*0.56, w*0.6], fill=0)
    S["mushroom"] = (mushroom, "Mushroom Keychain", "#f87171")

    def sword(d, c):
        w = c.width
        d.polygon([(w*0.48, w*0.08), (w*0.42, w*0.2), (w*0.44, w*0.5), (w*0.56, w*0.5), (w*0.58, w*0.2)], fill=255)
        d.rectangle([w*0.42, w*0.5, w*0.58, w*0.62], fill=255)
        d.rectangle([w*0.36, w*0.62, w*0.64, w*0.7], fill=255)
        d.rectangle([w*0.44, w*0.7, w*0.56, w*0.92], fill=255)
    S["sword"] = (sword, "Sword Keychain", "#60a5fa")

    def fish(d, c):
        w = c.width
        d.ellipse([w*0.26, w*0.3, w*0.78, w*0.7], fill=255)
        d.polygon([(w*0.76, w*0.36), (w*0.96, w*0.5), (w*0.76, w*0.64)], fill=255)
        d.polygon([(w*0.28, w*0.5), (w*0.1, w*0.36), (w*0.1, w*0.64)], fill=255)
        d.ellipse([w*0.36, w*0.42, w*0.44, w*0.5], fill=0)
    S["fish"] = (fish, "Fish Keychain", "#22d3ee")

    def moon(d, c):
        w = c.width
        d.ellipse([w*0.2, w*0.2, w*0.8, w*0.8], fill=255)
        d.ellipse([w*0.36, w*0.14, w*0.86, w*0.74], fill=0)
    S["moon"] = (moon, "Moon Keychain", "#818cf8")

    def bolt(d, c):
        w = c.width
        d.polygon([(w*0.56, w*0.1), (w*0.3, w*0.5), (w*0.48, w*0.5), (w*0.42, w*0.9),
                   (w*0.7, w*0.46), (w*0.5, w*0.46)], fill=255)
    S["bolt"] = (bolt, "Lightning Bolt Keychain", "#facc15")

    def dragon(d, c):
        w = c.width
        d.polygon([(w*0.5, w*0.28), (w*0.4, w*0.16), (w*0.44, w*0.3), (w*0.32, w*0.24),
                   (w*0.4, w*0.4), (w*0.24, w*0.44), (w*0.4, w*0.56), (w*0.44, w*0.72),
                   (w*0.5, w*0.62), (w*0.56, w*0.72), (w*0.6, w*0.56), (w*0.76, w*0.44),
                   (w*0.6, w*0.4), (w*0.68, w*0.24), (w*0.56, w*0.3), (w*0.6, w*0.16)], fill=255)
        d.ellipse([w*0.46, w*0.3, w*0.54, w*0.38], fill=0)
    S["dragon"] = (dragon, "Dragon Keychain", "#10b981")

    return S


def mask_to_heights(mask, ring):
    """mask: bool HxW (inside shape). ring: (cx,cy,r) in px. Return height array 0..1."""
    H, W = mask.shape
    ys, xs = np.mgrid[0:H, 0:W]
    ring_mask = (xs - ring[0])**2 + (ys - ring[1])**2 >= ring[2]**2
    inside = mask & ring_mask
    return inside.astype(np.float32)


def build_mesh(heights, z_top=1.0, z_bottom=0.0):
    """Convert a height grid to a triangle soup: top surface, bottom, and side walls."""
    H, W = heights.shape
    # vertex grid positions (unit square)
    xs = np.linspace(-0.5, 0.5, W)
    ys = np.linspace(-0.5, 0.5, H)
    X, Y = np.meshgrid(xs, ys)
    Ztop = heights * z_top
    # inside = any material
    inside = heights > 0
    verts = []   # (x,y,z)
    tris = []    # index triplets

    def v(x, y, z):
        verts.append((float(x), float(y), float(z)))
        return len(verts) - 1

    # top surface: two triangles per cell where all 4 corners inside
    for j in range(H - 1):
        for i in range(W - 1):
            c = inside[j, i] and inside[j, i+1] and inside[j+1, i] and inside[j+1, i+1]
            if not c:
                continue
            a = v(X[j, i], Y[j, i], Ztop[j, i])
            b = v(X[j, i+1], Y[j, i+1], Ztop[j, i+1])
            cc = v(X[j+1, i+1], Y[j+1, i+1], Ztop[j+1, i+1])
            d = v(X[j+1, i], Y[j+1, i], Ztop[j+1, i])
            tris += [a, b, cc, a, cc, d]
            # bottom (reversed winding)
            e = v(X[j, i], Y[j, i], z_bottom)
            f = v(X[j, i+1], Y[j, i+1], z_bottom)
            g = v(X[j+1, i+1], Y[j+1, i+1], z_bottom)
            h = v(X[j+1, i], Y[j+1, i], z_bottom)
            tris += [e, g, f, e, h, g]

    # side walls: edges between inside and outside cells (4-neighbor)
    for j in range(H):
        for i in range(W):
            if not inside[j, i]:
                continue
            # right neighbor out
            if i == W-1 or not inside[j, i+1]:
                x0, x1 = X[j, i+1], X[j, i+1]
                a = v(X[j, i+1], Y[j, i], Ztop[j, i])
                b = v(X[j, i+1], Y[j, i+1], Ztop[j, i+1])
                cc = v(X[j, i+1], Y[j, i+1], z_bottom)
                d = v(X[j, i+1], Y[j, i], z_bottom)
                tris += [a, cc, b, a, d, cc]
            # left neighbor out
            if i == 0 or not inside[j, i-1]:
                a = v(X[j, i], Y[j, i], Ztop[j, i])
                b = v(X[j, i], Y[j, i+1], Ztop[j, i+1])
                cc = v(X[j, i], Y[j, i+1], z_bottom)
                d = v(X[j, i], Y[j, i], z_bottom)
                tris += [a, b, cc, a, cc, d]
            # top neighbor out
            if j == 0 or not inside[j-1, i]:
                a = v(X[j, i], Y[j, i], Ztop[j, i])
                b = v(X[j, i+1], Y[j, i], Ztop[j, i+1])
                cc = v(X[j, i+1], Y[j, i], z_bottom)
                d = v(X[j, i], Y[j, i], z_bottom)
                tris += [a, cc, b, a, d, cc]
            # bottom neighbor out
            if j == H-1 or not inside[j+1, i]:
                a = v(X[j, i], Y[j+1, i], Ztop[j, i])
                b = v(X[j, i+1], Y[j+1, i], Ztop[j, i+1])
                cc = v(X[j, i+1], Y[j+1, i], z_bottom)
                d = v(X[j, i], Y[j+1, i], z_bottom)
                tris += [a, b, cc, a, cc, d]

    pos = np.array(verts, dtype=np.float32)
    idx = np.array(tris, dtype=np.uint32)
    return pos, idx


def write_stl(path, pos, idx):
    tri_count = len(idx) // 3
    with open(path, "wb") as f:
        f.write(b"Tommy Labs keychain" + b"\x00" * (80 - 19))
        f.write(struct.pack("<I", tri_count))
        for t in range(tri_count):
            a, b, c = idx[t*3], idx[t*3+1], idx[t*3+2]
            ax, ay, az = pos[a]; bx, by, bz = pos[b]; cx, cy, cz = pos[c]
            ux, uy, uz = bx-ax, by-ay, bz-az
            vx, vy, vz = cx-ax, cy-ay, cz-az
            nx, ny, nz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
            ln = math.sqrt(nx*nx+ny*ny+nz*nz) or 1.0
            f.write(struct.pack("<3f", nx/ln, ny/ln, nz/ln))
            f.write(struct.pack("<9f", ax, ay, az, bx, by, bz, cx, cy, cz))
            f.write(struct.pack("<H", 0))


def write_glb(path, pos, idx):
    pos_b = pos.astype("<f4").tobytes()
    idx_b = idx.astype("<u4").tobytes()
    pad = lambda n: (4 - (n % 4)) % 4
    bin_size = len(pos_b) + pad(len(pos_b)) + len(idx_b) + pad(len(idx_b))
    # re-align: pos at 0, idx after
    pos_off = 0
    idx_off = len(pos_b) + pad(len(pos_b))
    mn = pos.min(axis=0).tolist()
    mx = pos.max(axis=0).tolist()
    json_obj = {
        "asset": {"version": "2.0", "generator": "tommylabs-keychain"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "mode": 4, "material": 0}]}],
        "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [0.95, 0.97, 1.0, 1.0], "metallicFactor": 0.02, "roughnessFactor": 0.85}}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": mn, "max": mx},
            {"bufferView": 1, "componentType": 5125, "count": len(idx), "type": "SCALAR"}
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": pos_off, "byteLength": len(pos_b)},
            {"buffer": 0, "byteOffset": idx_off, "byteLength": len(idx_b)}
        ],
        "buffers": [{"byteLength": bin_size}]
    }
    json_str = json.dumps(json_obj)
    json_pad = (4 - ((len(json_str) + 20) % 4)) % 4
    json_len = len(json_str) + json_pad
    bin_header = 20 + json_len
    total = bin_header + 8 + bin_size
    glb = bytearray(total)
    struct.pack_into("<III", glb, 0, 0x46546C67, 2, total)
    struct.pack_into("<II", glb, 12, json_len, 0x4E4F534A)
    glb[20:20+len(json_str)] = json_str.encode()
    glb[20+len(json_str):bin_header] = b" " * json_pad  # JSON chunk padded with spaces per spec
    struct.pack_into("<II", glb, bin_header, bin_size, 0x004E4942)
    glb[bin_header+8:bin_header+8+len(pos_b)] = pos_b
    glb[bin_header+8+len(pos_b)+pad(len(pos_b)):bin_header+8+idx_off+len(idx_b)] = idx_b
    with open(path, "wb") as f:
        f.write(bytes(glb))


def make_picture(slug, draw_fn, color, out_path, w=640, h=640):
    img = Image.new("RGB", (w, h), (9, 13, 22))
    d = ImageDraw.Draw(img)
    # soft radial glow behind
    glow = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([w*0.12, h*0.12, w*0.88, h*0.88], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    img = Image.composite(Image.new("RGB", (w, h), tuple(int(color[i:i+2], 16) for i in (1, 3, 5))), img, glow)
    d = ImageDraw.Draw(img)
    # shape on transparent mask
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    draw_fn(md, mask)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    # bevel-ish: two-tone fill
    shape = Image.new("RGB", (w, h), (0, 0, 0))
    sd = ImageDraw.Draw(shape)
    base = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
    light = tuple(min(255, v + 55) for v in base)
    dark = tuple(max(0, v - 40) for v in base)
    sd.bitmap((0, 0), mask, fill=base)
    # top highlight
    hl = mask.point(lambda p: int(p * 0.9))
    shape.paste(light, (0, 0), hl)
    img.paste(shape, (0, 0), mask)
    # ring hole cutout marker (small dot)
    img.save(out_path, "WEBP", quality=88)


def main():
    shapes = shape_masks()
    items = []
    for slug, (draw_fn, name, color) in shapes.items():
        w = SIZE
        mask = Image.new("L", (w, w), 0)
        d = ImageDraw.Draw(mask)
        draw_fn(d, mask)
        arr = np.array(mask) > 128
        ring = (w * RING_X, w * RING_Y, w * (RING_D / MM) * 0.5)
        heights = mask_to_heights(arr, ring)
        # scale mm: 60mm side -> unit square; thickness mm -> fraction
        z_top = THICK / MM
        pos, idx = build_mesh(heights, z_top=z_top, z_bottom=0.0)
        # center at origin, keep mm scale
        pos[:, 0] *= MM
        pos[:, 1] *= MM
        pos[:, 2] *= MM
        img_dir = os.path.join(OUT, "img"); stl_dir = os.path.join(OUT, "stl"); glb_dir = os.path.join(OUT, "glb")
        os.makedirs(img_dir, exist_ok=True); os.makedirs(stl_dir, exist_ok=True); os.makedirs(glb_dir, exist_ok=True)
        img_path = os.path.join(img_dir, f"{slug}.webp")
        stl_path = os.path.join(stl_dir, f"{slug}.stl")
        glb_path = os.path.join(glb_dir, f"{slug}.glb")
        make_picture(slug, draw_fn, color, img_path)
        write_stl(stl_path, pos, idx)
        write_glb(glb_path, pos, idx)
        idx3 = idx.reshape(-1, 3)
        a = pos[idx3[:, 0]]; b = pos[idx3[:, 1]]; c = pos[idx3[:, 2]]
        cross = np.cross(b - a, c - a)
        vol_mm3 = max(1, abs(float(np.einsum('ij,ij->i', a, cross).sum() / 6)))
        items.append({
            "slug": slug, "name": name, "color": color,
            "img": f"assets/keychains/img/{slug}.webp",
            "stl": f"assets/keychains/stl/{slug}.stl",
            "glb": f"assets/keychains/glb/{slug}.glb",
            "vol_cm3": round(vol_mm3 / 1000, 2),
            "tris": len(idx) // 3,
        })
        print(f"{slug:10s} {name:22s} tris={len(idx)//3:6d} vol={items[-1]['vol_cm3']:6.2f} cm3")
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(items, f, indent=2)
    print(f"\n{len(items)} keychains generated -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
