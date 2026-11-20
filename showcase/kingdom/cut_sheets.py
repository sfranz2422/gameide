#!/usr/bin/env python3
"""
Cuts the teacher's Gemini pictures for Highmoor (phase 1: 01-09; phase 2's troops, rubble
and icons: 10-12) (PROMPTS.md, in order, copied into raw/
as 01.jpeg, 02.jpeg …) into the named pictures in art/, which build.py reads. Both raw/
and art/ are committed, so the art can't be lost.

    python3 showcase/kingdom/cut_sheets.py

As in Cloverbrook, art/ keeps each picture at twice the game's size, fitted so its
ground diamond is `footprint × TILE_W × 2` across. Two things differ here, both from
the realistic style: Gemini drew soft shadows on the magenta (made dark shadows by
`shadow`), and a tree's crown can be wider than the grass under it, so a picture is
fitted by the width of its GROUND (`ground_width`: the widest solid row near its
bottom), never its outline.
"""
import importlib.util
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, ART = HERE / "raw", HERE / "art"


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_farm = _load("farm_cut", HERE.parent / "farm" / "cut_sheets.py")
_sw = _farm._sw
G = {}
exec((HERE / "game" / "_1rules.py").read_text(), G)
TILE_W = G["TILE_W"]

ROWS = {
    # sheet: rows, each a list of (name, footprint)
    "01": [[("keep_1", 4), ("keep_2", 4), ("keep_3", 4)]],
    "02": [[("gold_mine_1", 3), ("gold_mine_2", 3), ("gold_mine_3", 3)], [("farm_1", 3), ("farm_2", 3), ("farm_3", 3)]],
    "03": [[("treasury_1", 3), ("treasury_2", 3), ("treasury_3", 3)], [("granary_1", 3), ("granary_2", 3), ("granary_3", 3)]],
    "04": [[("archer_tower_1", 3), ("archer_tower_2", 3), ("archer_tower_3", 3)], [("ballista_1", 3), ("ballista_2", 3), ("ballista_3", 3)]],
    "05": [[("trebuchet_1", 3), ("trebuchet_2", 3), ("trebuchet_3", 3)], [("barracks_1", 3), ("barracks_2", 3), ("barracks_3", 3)]],
    "06": [[("army_camp_1", 4), ("army_camp_2", 4), ("army_camp_3", 4)],
           [("builder_hut_1", 2), ("wall_1", 1), ("wall_2", 1), ("wall_3", 1)]],
    "15": [[("warlord_altar_1", 3), ("warlord_altar_2", 3), ("warlord_altar_3", 3)],
           [("huntress_altar_1", 3), ("huntress_altar_2", 3), ("huntress_altar_3", 3)],
           [("mage_tower_1", 3), ("mage_tower_2", 3), ("mage_tower_3", 3)]],
    "17": [[(f"{k}_{t}", 1) for k in ("spike_pit", "powder_keg", "catapult_snare") for t in (1, 2, 3)],
           [("forge_1", 3), ("forge_2", 3), ("forge_3", 3)]],
    # 18: the alliance hall. Two versions came: this one's halls (on thick ground, like the other
    # buildings); the icon is the other's (raw/18-tilted.png: on a tilted tile, as the bar's are).
    "18": [[("alliance_hall_1", 3), ("alliance_hall_2", 3), ("alliance_hall_3", 3)]],
    # 20-23 (2026-11-20): the in-between looks, so every two levels look different (the
    # teacher: you couldn't tell anything was upgraded). "_1b" sits between a building's first
    # two drawings, "_2b" between its second and third (build.py's LOOKS).
    # (Gemini drew three keeps on 20, not two: the middle one is keep 2 again, kept aside.)
    "20": [[("keep_1b", 4), ("keep_extra", 4), ("keep_2b", 4)],
           [("gold_mine_1b", 3), ("gold_mine_2b", 3), ("farm_1b", 3), ("farm_2b", 3)]],
    "21": [[("treasury_1b", 3), ("treasury_2b", 3), ("granary_1b", 3), ("granary_2b", 3)],
           [("archer_tower_1b", 3), ("archer_tower_2b", 3), ("ballista_1b", 3), ("ballista_2b", 3)]],
    "22": [[("barracks_1b", 3), ("barracks_2b", 3), ("trebuchet_1b", 3), ("army_camp_1b", 4)],
           [("wall_1b", 1), ("wall_2b", 1)]],
    "23": [[("warlord_altar_1b", 3), ("warlord_altar_2b", 3)], [("huntress_altar_1b", 3), ("huntress_altar_2b", 3)]],
    "07": [[("oak", 1), ("pine", 1), ("bush", 1), ("boulder", 1), ("stump", 1)],
           [("scaffold_2", 2), ("scaffold_3", 3), ("scaffold_4", 4)]],
}
ICONS = ["gold", "food", "renown", "builder", "hammer", "clock", "shield", "sword", "up", "keep"]
# Phase 2's troops: a sheet's rows, one troop each, and which of its columns are our four
# frames facing you (walk, walk, swing, swing) and four facing away. Sheet 10 came back with
# ten frames a troop, not eight, with grid lines between them (cut by its grid, a little in
# from each line); sheet 11 with the eight asked for.
TROOP_SHEETS = {
    "10": (10, ["footman", "archer", "brute", "raider"], [0, 1, 3, 4], [5, 6, 8, 9]),
    "11": (8, ["sapper", "knight", "ram"], [0, 1, 2, 3], [4, 5, 6, 7]),
    "14": (8, ["warlord", "huntress"], [0, 1, 2, 3], [4, 5, 6, 7]),       # the champions (phase 4)
}
# Cut by the drawings, not the grid: the champions' axes and bows reach over into the next
# frame's cell (an even grid gave the Warlord his neighbour's axe head).
BY_DRAWINGS = {"14"}
TROOP_FACING_RIGHT = {"ram"}     # Gemini drew the ram's iron head on the right: turned to face left like the rest
TROOP_TALL = {"footman": 124, "archer": 120, "brute": 150, "raider": 116, "sapper": 116, "knight": 176, "ram": 150, "warlord": 172, "huntress": 146}


def save(pic, name):
    pic.save(ART / f"{name}.png", optimize=True)


def ground_span(part):
    """Where the drawing's ground is, left to right: the widest row of solid pixels in its
    lower part (the diamond's left and right corners), not counting a crown or a shadow."""
    a = part.getchannel("A")
    w, h = part.size
    px = a.load()
    best = (0, 1)
    for y in range(max(0, h - int(w * 0.6)), h):
        xs = [x for x in range(0, w, 2) if px[x, y] > 200]
        if xs and xs[-1] - xs[0] > best[1] - best[0]:
            best = (xs[0], xs[-1])
    return best


def fitted(part, tiles):
    """Sized so its ground is `tiles` diamonds across, and padded so the ground is in the
    middle (the build stands a picture on its middle): a tree's shadow hangs off to the
    left, and without this the tree stood half a tile to the right of its tile."""
    x0, x1 = ground_span(part)
    mid = (x0 + x1) / 2
    half = max(mid, part.width - mid)
    padded = Image.new("RGBA", (int(2 * half) + 1, part.height), (0, 0, 0, 0))
    padded.paste(part, (int(half - mid), 0))
    k = tiles * TILE_W * 2 / max(1, x1 - x0)
    return padded.resize((max(1, round(padded.width * k)), max(1, round(padded.height * k))), Image.LANCZOS)


def rows_of(boxes, n_rows):
    """The drawings' boxes in reading order: by rows (their middles), then left to right."""
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    out, i = [], 0
    for n in n_rows:
        out.append(sorted(boxes[i:i + n], key=lambda b: b[0]))
        i += n
    return out


def split_widest(im, found):
    """Two drawings joined by a shadow (the oak's touches the pine's) are one patch: the
    widest box is split at its emptiest column, away from its ends."""
    import numpy as np
    b = max(found, key=lambda b: b[2] - b[0])
    a = np.asarray(im.getchannel("A"))[b[1]:b[3], b[0]:b[2]] > 200
    cols = a.sum(axis=0)
    lo, hi = int(len(cols) * 0.3), int(len(cols) * 0.8)
    cut = b[0] + lo + int(np.argmin(cols[lo:hi]))
    rest = [x for x in found if x is not b]
    # Marked split: `own` keeps a whole patch for the box its middle is in, which would
    # give both halves to one box, so a split box is cropped as it is.
    return rest + [[b[0], b[1], cut, b[3], "split"], [cut, b[1], b[2], b[3], "split"]]


def no_shadow(part):
    """An icon's shadow (dark magenta, joining the row's icons into one patch) taken out
    altogether: an icon sits in the middle of its square with nothing beside it."""
    px = part.load()
    for y in range(part.height):
        for x in range(part.width):
            r, g, b, a = px[x, y]
            if a and r > g + 40 and b > g + 20:
                px[x, y] = (0, 0, 0, 0)
    bb = part.getbbox()
    return part.crop(bb) if bb else part


def de_rim(part):
    """The last of the magenta: a pinkish, part see-through rim along the bottom edges of
    the ground, which keying and `shadow` leave (a purple line under a farm), taken out."""
    px = part.load()
    for y in range(part.height):
        for x in range(part.width):
            r, g, b, a = px[x, y]
            if 0 < a < 250 and r > g + 25 and b > g + 15:
                px[x, y] = (0, 0, 0, 0)
    return part


def main():
    ART.mkdir(exist_ok=True)
    for sheet, rows in ROWS.items():
        if not (RAW / f"{sheet}.jpeg").exists():
            continue
        im = _sw.key_out(Image.open(RAW / f"{sheet}.jpeg"))
        want = sum(len(r) for r in rows)
        found = [b for b in _farm.islands(im, want + 12) if (b[2] - b[0]) * (b[3] - b[1]) > im.width * im.height / 400][:want]
        while len(found) < want:
            found = split_widest(im, found)
        assert len(found) == want, (sheet, len(found), want)
        for row, boxes in zip(rows, rows_of(found, [len(r) for r in rows])):
            for (name, tiles), b in zip(row, boxes):
                box = tuple(b[:4])
                part = im.crop(box) if len(b) > 4 else _sw.own(im, b, [x[:4] for x in found]).crop(box)
                save(fitted(_farm.shadow(de_rim(part)), tiles), name)
    if (RAW / "08.jpeg").exists():
        im = _sw.key_out(Image.open(RAW / "08.jpeg"))
        # By the grid: their shadows join each row into one patch.
        w, h = im.width / 5, im.height / 2
        for i, name in enumerate(ICONS):
            c, r_ = i % 5, i // 5
            part = no_shadow(im.crop((int(c * w), int(r_ * h), int((c + 1) * w), int((r_ + 1) * h))))
            side = max(part.size)
            sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            sq.paste(part, ((side - part.width) // 2, (side - part.height) // 2))
            save(sq.resize((128, 128), Image.LANCZOS), f"icon_{name}")
    for sheet, (cols, troops, front, back) in TROOP_SHEETS.items():
        if not (RAW / f"{sheet}.jpeg").exists():
            continue
        raw = Image.open(RAW / f"{sheet}.jpeg")
        w, h = raw.width / cols, raw.height / len(troops)
        if sheet in BY_DRAWINGS:
            keyed = _sw.key_out(raw)
            want = cols * len(troops)
            found = [b for b in _farm.islands(keyed, want + 30) if (b[2] - b[0]) * (b[3] - b[1]) > keyed.width * keyed.height / 600][:want]
            assert len(found) == want, (sheet, len(found), want)
            grid = rows_of(found, [cols] * len(troops))
        for r_, troop in enumerate(troops):
            cells = []
            for c in range(cols):
                if sheet in BY_DRAWINGS:
                    b = grid[r_][c]
                    cells.append(no_shadow(_sw.own(keyed, b, found).crop(tuple(b)).copy()))
                    continue
                inset = 10
                cell = _sw.key_out(raw.crop((int(c * w) + inset, int(r_ * h) + inset, int((c + 1) * w) - inset, int((r_ + 1) * h) - inset)))
                part = no_shadow(cell.copy())      # (keyed out from an array: read-only)
                cells.append(part)
            k = TROOP_TALL[troop] / max(cells[i].height for i in front + back)
            for view, cols_ in (("front", front), ("back", back)):
                frames = [cells[i].resize((max(1, round(cells[i].width * k)), max(1, round(cells[i].height * k))), Image.LANCZOS) for i in cols_]
                for j, pic in enumerate(_farm.same_size(frames)):
                    if troop in TROOP_FACING_RIGHT:
                        pic = pic.transpose(Image.FLIP_LEFT_RIGHT)
                    save(pic, f"troop_{troop}_{view}_{j}")
    if (RAW / "12.jpeg").exists():
        # Rubble along the top, four sizes; three icons along the bottom (their shadows out).
        im = _sw.key_out(Image.open(RAW / "12.jpeg"))
        top = im.crop((0, 0, im.width, im.height // 2))
        found = sorted(_farm.islands(top, 4), key=lambda b: b[0])
        for n, b in zip((1, 2, 3, 4), found):
            save(fitted(_farm.shadow(de_rim(_sw.own(top, b, found).crop(b))), n), f"rubble_{n}")
        third = im.width / 3
        for c, name in enumerate(("star", "attack", "army")):
            part = no_shadow(im.crop((int(c * third), im.height // 2, int((c + 1) * third), im.height)))
            side = max(part.size)
            sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            sq.paste(part, ((side - part.width) // 2, (side - part.height) // 2))
            save(sq.resize((128, 128), Image.LANCZOS), f"icon_{name}")
    if (RAW / "16.jpeg").exists():
        # The spells' icons, one row of four, cut by the grid (their shadows out).
        im = _sw.key_out(Image.open(RAW / "16.jpeg"))
        quarter = im.width / 4
        for c, name in enumerate(("heal", "rage", "lightning", "freeze")):
            part = no_shadow(im.crop((int(c * quarter), 0, int((c + 1) * quarter), im.height)))
            side = max(part.size)
            sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            sq.paste(part, ((side - part.width) // 2, (side - part.height) // 2))
            save(sq.resize((128, 128), Image.LANCZOS), f"icon_{name}")
    if (RAW / "18-tilted.png").exists():
        im = _sw.key_out(Image.open(RAW / "18-tilted.png").convert("RGB"))
        bottom = im.crop((int(im.width * 0.35), int(im.height * 0.62), int(im.width * 0.65), im.height))
        part = no_shadow(bottom.copy())
        side = max(part.size)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(part, ((side - part.width) // 2, (side - part.height) // 2))
        save(sq.resize((128, 128), Image.LANCZOS), "icon_banner")
    if (RAW / "19.jpeg").exists():
        # 19: a 4 × 3 grid, by the grid like sheet 8; the last two came back empty tiles.
        im = _sw.key_out(Image.open(RAW / "19.jpeg"))
        w, h = im.width / 4, im.height / 3
        names = ["trophy", "medal", "shield_on", "scroll"] + [f"league_{i}" for i in range(6)]
        for i, name in enumerate(names):
            c, r_ = i % 4, i // 4
            cell = im.crop((int(c * w), int(r_ * h), int((c + 1) * w), int((r_ + 1) * h)))
            # The tiles nearly touch: keep the cell's biggest piece, not the neighbours' edges.
            biggest = max(_farm.islands(cell, 8), key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
            part = no_shadow(_sw.own(cell, biggest, [biggest]).crop(tuple(biggest[:4])))
            side = max(part.size)
            sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            sq.paste(part, ((side - part.width) // 2, (side - part.height) // 2))
            save(sq.resize((128, 128), Image.LANCZOS), f"icon_{name}")
    if (RAW / "09.jpeg").exists():
        view = (G["VIEW_W"], G["VIEW_H"])
        Image.open(RAW / "09.jpeg").convert("RGB").resize((view[0] * 2, view[1] * 2), Image.LANCZOS).save(ART / "title.png", optimize=True)
    print(f"{sum(1 for _ in ART.glob('*.png'))} pictures in {ART}")


if __name__ == "__main__":
    main()
