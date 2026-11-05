#!/usr/bin/env python3
"""
Cuts the teacher's 22 Gemini pictures into the named pictures in art/, which
build.py reads and which are committed, so they can't be lost.

    python3 showcase/rpg/cut_sheets.py

Gemini names files its own way, so SHEETS says which file is which prompt in
PROMPTS.md.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

DOWNLOADS = Path("~/Downloads").expanduser()
ART = Path(__file__).resolve().parent / "art"
# Pictures keep this many times the game's size; art() in build.py shrinks them, smoothly.
S = 4


def gemini(tail):
    return DOWNLOADS / f"Gemini_Generated_Image_{tail}.jpeg"


def magenta_to_alpha(im):
    """Flat magenta becomes see-through, its JPEG fringe part see-through and losing its pink."""
    im = im.convert("RGB")
    out = Image.new("RGBA", im.size)
    src, dst = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = src[x, y]
            m = min(r, b) - g
            a = 255 if m < 70 else 0 if m > 170 else round(255 * (170 - m) / 100)
            if 0 < a < 255:
                r, b = min(r, g + 60), min(b, g + 60)
            dst[x, y] = (r, g, b, a)
    return out


def islands(im):
    """Every separate patch of drawing as [x0, y0, x1, y1, area], worked out on a shrunk copy, for speed."""
    k = 4
    small = im.getchannel("A").resize((im.width // k, im.height // k), Image.BILINEAR)
    w, h = small.size
    px = small.load()
    seen = bytearray(w * h)
    found = []
    for y0 in range(h):
        for x0 in range(w):
            if px[x0, y0] < 128 or seen[y0 * w + x0]:
                continue
            stack, box, area = [(x0, y0)], [x0, y0, x0, y0], 0
            seen[y0 * w + x0] = 1
            while stack:
                x, y = stack.pop()
                area += 1
                box = [min(box[0], x), min(box[1], y), max(box[2], x), max(box[3], y)]
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] >= 128 and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            found.append([box[0] * k, box[1] * k, (box[2] + 1) * k, (box[3] + 1) * k, area])
    return found


def gap(a, b):
    dx = max(a[0] - b[2], b[0] - a[2], 0)
    dy = max(a[1] - b[3], b[1] - a[3], 0)
    return dx * dx + dy * dy


def cut(im, shape, loose=True):
    """
    The boxes of a sheet's drawings, row by row. `shape` is how many each row has.

    The biggest islands are the drawings. Smaller ones are a kite's string, a spell's
    sparks or a swing's trail, and join the nearest drawing; with loose=False they're
    thrown away instead (a shadow Gemini drew though it was told not to).
    """
    found = sorted(islands(im), key=lambda b: -b[4])
    n = sum(shape)
    assert len(found) >= n, f"{len(found)} drawings on the sheet, wanted {n}"
    main = [b[:4] for b in found[:n]]
    if loose:
        for b in found[n:]:
            m = min(main, key=lambda o: gap(o, b))
            m[0], m[1], m[2], m[3] = min(m[0], b[0]), min(m[1], b[1]), max(m[2], b[2]), max(m[3], b[3])
    # Rows from the top, each the next `count` drawings by their middles, then left to right.
    main.sort(key=lambda b: (b[1] + b[3]) / 2)
    boxes, first = [], 0
    for count in shape:
        boxes += sorted(main[first:first + count], key=lambda b: b[0])
        first += count
    return [tuple(b) for b in boxes]


def place(im, box, size, scale, flip=False):
    """A drawing on a canvas, centred across, standing on the canvas's bottom row."""
    part = im.crop(box)
    if flip:
        part = part.transpose(Image.FLIP_LEFT_RIGHT)
    part = part.resize((max(1, round(part.width * scale)), max(1, round(part.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.alpha_composite(part, (max(0, (size[0] - part.width) // 2), max(0, size[1] - part.height)))
    return out


def fit(boxes, size):
    """One scale for drawings that belong together, so they stay one size as they change."""
    return min(size[0] / max(b[2] - b[0] for b in boxes), size[1] / max(b[3] - b[1] for b in boxes))


GLOWING = {"lantern_lit": False, "prop_crystal": True}


def save(pic, name):
    if name in GLOWING:
        pic = no_glow(pic, GLOWING[name])
    pic.save(ART / f"{name}.png", optimize=True)


def group(im, boxes, names, game_size, flip=False):
    size = (game_size[0] * S, game_size[1] * S)
    scale = fit(boxes, size)
    for b, name in zip(boxes, names):
        if name:
            save(place(im, b, size, scale, flip=flip), name)


def each(im, boxes, names, sizes):
    """Each drawing fitted to its own canvas."""
    for b, name in zip(boxes, names):
        if name:
            size = (sizes[name][0] * S, sizes[name][1] * S)
            save(place(im, b, size, fit([b], size)), name)


def sheet(tail, shape, loose=True):
    im = magenta_to_alpha(Image.open(gemini(tail)))
    boxes = cut(im, shape, loose)
    assert len(boxes) == sum(shape), f"{tail}: {len(boxes)} drawings"
    return im, boxes


WALK = (32, 44)


# Where a hero's legs start on the walking picture, down from its top: under the tunic, robe or apron.
LEGS = {"wren": 0.76, "pip": 0.87, "bram": 0.8}


def walk_cycle(pic, key, view):
    """
    Four frames from one drawing. Gemini's "other foot forward" row came back almost the
    same as the first, so walking looked like sliding: the legs are moved here instead.
    Frame 0 is standing still. From the front and back each leg in turn gets shorter, as
    a foot lifts; from the side the legs part, come together, and part the other way.
    """
    w, h = pic.size
    top = round(h * LEGS[key])
    legs = pic.crop((0, top, w, h))
    box = legs.getbbox()
    left, right = box[0], box[2]
    mid = (left + right) // 2
    rest = pic.copy()
    rest.paste((0, 0, 0, 0), (0, top, w, h))

    def with_legs(part):
        out = rest.copy()
        out.alpha_composite(part, (0, top))
        return out

    if view == "side":
        strip = legs.crop((left, 0, right, h - top))
        apart = Image.new("RGBA", legs.size)
        apart.alpha_composite(strip, (left, 0))
        other = Image.new("RGBA", legs.size)
        other.alpha_composite(strip.transpose(Image.FLIP_LEFT_RIGHT), (left, 0))
        narrow = strip.resize((max(1, strip.width // 2), strip.height), Image.LANCZOS)
        together = Image.new("RGBA", legs.size)
        together.alpha_composite(narrow, (mid - narrow.width // 2, 0))
        return [with_legs(together), with_legs(apart), with_legs(together), with_legs(other)]

    def lifted(x0, x1):
        """The legs with the part between x0 and x1 shorter: its foot comes up, its top stays."""
        out = legs.copy()
        height = h - top
        short = max(1, height - round(h * 0.09))
        out.paste((0, 0, 0, 0), (x0, 0, x1, height))
        out.alpha_composite(legs.crop((x0, 0, x1, height)).resize((x1 - x0, short), Image.LANCZOS), (x0, 0))
        return out

    return [pic, with_legs(lifted(left, mid)), pic, with_legs(lifted(mid, right))]


def heroes():
    for key, tail in (("wren", "jzrud8jzrud8jzru"), ("pip", "e7119de7119de711"), ("bram", "h4ddrjh4ddrjh4dd")):
        im, boxes = sheet(tail, [3, 3])
        # The first row's drawings only: the second row was almost the same.
        size = (WALK[0] * S, WALK[1] * S)
        scale = fit(boxes, size)
        for b, view in zip(boxes, ("down", "up", "side")):
            for n, frame in enumerate(walk_cycle(place(im, b, size, scale), key, view)):
                save(frame, f"{key}_{view}_{n}")
    im, boxes = sheet("7a1u2v7a1u2v7a1u", [4, 4, 4])
    for r, key in enumerate(("wren", "pip", "bram")):
        # The prompt asked for them facing left and Gemini drew them facing right.
        group(im, boxes[r * 4:r * 4 + 4], [f"fight_{key}_{n}" for n in range(4)], (64, 72), flip=True)


def no_glow(pic, everywhere=False):
    """
    A glow drawn on magenta came out pink: it's the magenta showing through, so it goes,
    and the game draws its own light on whatever ground the thing stands on. It's
    followed in from the outside and stops at the outline, because the lantern's own red
    metal looks just as pink. `everywhere` is for the crystals: the glow shows between them.
    """
    px = pic.load()
    w, h = pic.size

    def pink(x, y):
        r, g, b, a = px[x, y]
        # Bright: the outlines are a dark purple, and taking them too left a lantern with holes.
        # Part see-through or purple: the rim of the glow, fading into the magenta.
        return a and (a < 200 or (r > 200 and b >= g - 10) or (r > 90 and r > g and b > g + 8))

    if everywhere:
        todo = [(x, y) for y in range(h) for x in range(w) if pink(x, y)]
        for x, y in todo:
            px[x, y] = px[x, y][:3] + (0,)
        return pic
    todo = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] == 0]
    while todo:
        x, y = todo.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and pink(nx, ny):
                px[nx, ny] = px[nx, ny][:3] + (0,)
                todo.append((nx, ny))
    return pic


def even_light(im):
    """Gemini lights a texture unevenly. Repeated across a map, that shows as stripes, so the broad light and dark are taken out."""
    broad = im.filter(ImageFilter.GaussianBlur(im.width / 8))
    mean = Image.new("RGB", im.size, im.resize((1, 1), Image.BOX).getpixel((0, 0)))
    return ImageChops.add(ImageChops.subtract(im, broad, offset=128), mean, offset=-128)


def smooth_copy(im, frac):
    """A texture that tiles: its last stretch fades into its first, across and down, and is then cut off."""
    w, h = im.size
    fade = int(w * frac)
    px = im.load()
    for x in range(fade):
        t = x / fade
        for y in range(h):
            a, b = px[w - fade + x, y], px[x, y]
            px[x, y] = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
    for y in range(fade):
        t = y / fade
        for x in range(w):
            a, b = px[x, h - fade + y], px[x, y]
            px[x, y] = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
    return im.crop((0, 0, w - fade, h - fade))


def ground():
    """Eight textures, edge to edge with a dark line between. Kept at 8 x 8 tiles' worth; the build uses 4 x 4."""
    im = Image.open(gemini("5yqrb65yqrb65yqr")).convert("RGB")
    names = ["grass", "path", "cobble", "planks", "forest", "cave", "mud", "flag"]
    w, h = im.width // 4, im.height // 2
    for k, name in enumerate(names):
        x, y = (k % 4) * w, (k // 4) * h
        side = min(w, h) - 40
        part = im.crop((x + (w - side) // 2, y + (h - side) // 2, x + (w + side) // 2, y + (h + side) // 2))
        save(smooth_copy(even_light(part), 0.06).resize((512, 512), Image.LANCZOS), f"ground_{name}")


def wide(tail, name):
    """A wide picture, without the pale bar Gemini put down the side of some, cut to 16:9 keeping its bottom: the battle stands there."""
    im = Image.open(gemini(tail)).convert("RGB")
    px = im.load()
    right = im.width
    while right > im.width // 2:
        col = [px[right - 1, y] for y in range(0, im.height, 16)]
        if max(c[0] for c in col) - min(c[0] for c in col) > 16:
            break
        right -= 1
    height = min(im.height, round(right * 9 / 16))
    width = min(right, round(height * 16 / 9))
    left = (right - width) // 2
    save(im.crop((left, im.height - height, left + width, im.height)).resize((1280, 720), Image.LANCZOS), name)


FACE, FOE, BOSS = (64, 64), (72, 72), (240, 160)
TOWN = {"prop_cottage_red": (112, 104), "prop_cottage_blue": (112, 104), "prop_inn": (160, 128), "prop_smithy": (128, 112),
        "prop_stall": (72, 56), "prop_well": (44, 48), "prop_fence": (32, 32), "prop_crates": (40, 40), "prop_flowers": (32, 24), "prop_bench": (48, 28)}
WILD = {"prop_tree": (64, 80), "prop_pine": (48, 80), "prop_bush": (32, 28), "prop_boulder": (40, 34),
        "prop_mine": (96, 80), "prop_beam": (32, 64), "prop_cart": (56, 44), "prop_crystal": (48, 48),
        "prop_dead_tree": (64, 80), "prop_reeds": (32, 32), "prop_stone": (32, 20), "prop_jetty": (64, 48)}
TOWER = {"prop_wall": (96, 112), "prop_arch": (64, 88), "prop_stairs": (64, 80), "prop_pillar": (40, 88), "prop_throne": (56, 88), "prop_big_lantern": (44, 88)}
ICONS = ["potion", "ether", "herb", "bread", "sword", "great_sword", "staff", "hammer", "leather", "iron", "shield", "coin", "key", "shard", "ring", "lantern"]


def faces():
    im, boxes = sheet("mgw9knmgw9knmgw9", [4, 4])
    names = ["face_wren", "face_pip", "face_bram", "face_oona", "face_baker", "face_miner", "face_witch", "face_cat"]
    each(im, boxes, names, {n: FACE for n in names})
    im, boxes = sheet("d9j2dhd9j2dhd9j2", [4])
    names = ["face_thornback", "face_golem", "face_knight", "face_king"]
    each(im, boxes, names, {n: FACE for n in names})


def people():
    im, boxes = sheet("82a22x82a22x82a2", [4, 4])
    names = ["npc_oona", "npc_baker", "npc_miner", "npc_witch", "npc_shop", "npc_inn", "npc_child", "npc_cat"]
    group(im, boxes, names, WALK)
    # Pip stands about the town before joining, as on Pip's own walking sheet.
    Image.open(ART / "pip_down_0.png").save(ART / "npc_pip.png")


def monsters():
    im, boxes = sheet("hehr3khehr3khehr", [3, 3])
    names = ["foe_thornling", "foe_bat", "foe_shroom", "foe_beetle", "foe_rockling", "foe_mole"]
    each(im, boxes, names, {n: FOE for n in names})
    # loose=False: the wisp floats over a shadow Gemini added.
    im, boxes = sheet("s7hfjws7hfjws7hf", [3, 3], loose=False)
    names = ["foe_slime", "foe_frog", "foe_wisp", "foe_wolf", "foe_armour", "foe_wizard"]
    each(im, boxes, names, {n: FOE for n in names})
    im, boxes = sheet("drukqydrukqydruk", [2, 2])
    names = ["foe_thornback", "foe_golem", "foe_knight", "foe_king"]
    each(im, boxes, names, {n: BOSS for n in names})


def scenery():
    im, boxes = sheet("dj0wktdj0wktdj0w", [4, 4, 4])
    each(im, boxes[:8], list(TOWN)[:8], TOWN)
    # Lit and dark must match, or the post jumps as it lights: they share a scale.
    group(im, boxes[8:10], ["lantern_dark", "lantern_lit"], (40, 80))
    each(im, boxes[10:], list(TOWN)[8:], TOWN)
    im, boxes = sheet("atenohatenohaten", [4, 4, 4])
    each(im, boxes, list(WILD), WILD)
    im, boxes = sheet("o9udkjo9udkjo9ud", [4, 4])
    each(im, boxes[:4], list(TOWER)[:4], TOWER)
    group(im, boxes[4:6], ["chest_shut", "chest_open"], (32, 28))
    each(im, boxes[6:], list(TOWER)[4:], TOWER)
    im, boxes = sheet("6xfe2x6xfe2x6xfe", [4, 4, 4, 4])
    each(im, boxes, [f"icon_{n}" for n in ICONS], {f"icon_{n}": (32, 32) for n in ICONS})
    Image.open(ART / "icon_herb.png").save(ART / "herb.png")


WIDE = {"back_fields": "s7li1ps7li1ps7li", "back_forest": "omdmvpomdmvpomdm", "back_mine": "uizkmmuizkmmuizk", "back_marsh": "nhlmb2nhlmb2nhlm",
        "back_tower": "ygbhojygbhojygbh", "title": "gkoquigkoquigkoq", "ending": "kmkmdjkmkmdjkmkm"}


def main():
    ART.mkdir(exist_ok=True)
    heroes()
    faces()
    people()
    monsters()
    scenery()
    ground()
    for name, tail in WIDE.items():
        wide(tail, name)
    print("cut", len(list(ART.glob("*.png"))), "pictures into", ART)


if __name__ == "__main__":
    main()
