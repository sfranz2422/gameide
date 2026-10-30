#!/usr/bin/env python3
"""
Makes the art library's Kenney packs (public/library/kenney/<id>/) from
Kenney's own downloads (all CC0; taken from OpenGameArt, where Kenney
posts them, since kenney.nl itself was unreachable from here):

    python3 frontend/scripts/make_kenney_library.py PACKS_DIR [pack-id …]

PACKS_DIR has one folder per pack, named as in PACKS below, each with the
download unzipped in it. The library's sheets are grids of equal cells with
no gaps (src/library/library.ts), so every sheet is made one of three ways:

    ("pictures", globs, scale)        separate pictures, each in the middle of
                                      an equal cell, the cell the biggest one
    ("grid", file, tile)              a sheet that is a clean grid already
    ("respace", file, tile, gap)      a grid with gaps between tiles, closed up

`scale` shrinks Kenney's big pictures (128-pixel tiles, 256-pixel players) to
sizes that suit a 640 x 480 room, and keeps the library quick to load.
Each pack keeps Kenney's preview and licence. The Sports pack has its own
script (make_sports_library.py): it came first, and golf uses its cells.
"""
import glob
import math
import re
import shutil
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "public" / "library" / "kenney"
MAX_W = 1024                     # a sheet's widest, before it starts another row

# id: (folder under PACKS_DIR, [(sheet name, use, how, …)], max picture size kept (after scaling) or None)
PACKS = {
    "racing": ("racing-pack", [
        ("Cars", "sprites", "pictures", ["PNG/Cars/*.png"], 0.5),
        ("Bikes and drivers", "sprites", "pictures", ["PNG/Motorcycles/*.png", "PNG/Characters/*.png"], 0.5),
        ("Road things", "sprites", "pictures", ["PNG/Objects/*.png"], 0.5, 72),
        ("Asphalt roads", "tiles", "pictures", ["PNG/Tiles/Asphalt road/*.png"], 0.5),
        ("Grass, sand and dirt", "tiles", "pictures", ["PNG/Tiles/Grass/*.png", "PNG/Tiles/Sand/*.png", "PNG/Tiles/Dirt/*.png"], 0.5),
    ]),
    "topdown-shooter": ("topdown-shooter", [
        ("Characters", "sprites", "pictures", ["PNG/Hitman 1/*.png", "PNG/Man Blue/*.png", "PNG/Man Brown/*.png", "PNG/Man Old/*.png",
                                                "PNG/Robot 1/*.png", "PNG/Soldier 1/*.png", "PNG/Survivor 1/*.png",
                                                "PNG/Woman Green/*.png", "PNG/Zombie 1/*.png"], 1, None, 6),
        ("Weapons", "sprites", "pictures", ["PNG/*.png"], 1),
        ("Tiles", "tiles", "grid", "Tilesheet/tilesheet_complete.png", 64),
    ]),
    "tower-defense": ("tower-defense-top-down", [
        ("Tiles, towers and enemies", "tiles", "grid", "Tilesheet/towerDefense_tilesheet.png", 64),
    ]),
    "platformer-redux": ("platformer-pack-redux-360-assets", [
        ("Tiles", "tiles", "pictures", ["PNG/Tiles/*.png"], 0.5),
        ("Ground", "tiles", "pictures", [f"PNG/Ground/{g}/*.png" for g in ("Grass", "Dirt", "Sand", "Snow", "Stone", "Planet")], 0.5, None, 18),
        ("Players", "sprites", "pictures", [f"PNG/Players/128x256/{c}/*.png" for c in ("Beige", "Blue", "Green", "Pink", "Yellow")], 0.5, None, 11),
        ("Enemies", "sprites", "pictures", ["PNG/Enemies/*.png"], 0.5),
        ("Items and HUD", "sprites", "pictures", ["PNG/Items/*.png", "PNG/HUD/*.png"], 0.5),
        ("Backgrounds", "sprites", "pictures", ["PNG/Backgrounds/*.png"], 0.25),
    ]),
    "space-redux": ("space-shooter-redux", [
        ("Ships", "sprites", "pictures", ["PNG/*.png", "PNG/Enemies/*.png"], 1),
        ("Lasers", "sprites", "pictures", ["PNG/Lasers/*.png"], 1),
        ("Meteors", "sprites", "pictures", ["PNG/Meteors/*.png"], 1),
        ("Power-ups and HUD", "sprites", "pictures", ["PNG/Power-ups/*.png", "PNG/UI/*.png"], 1, 64),
        ("Effects", "sprites", "pictures", ["PNG/Effects/*.png"], 1, 64),
        ("Backgrounds", "tiles", "pictures", ["Backgrounds/*.png"], 1),
    ]),
    "roguelike": ("roguelikerpg-pack-1700-tiles", [
        ("Tiles", "tiles", "respace", "Spritesheet/roguelikeSheet_transparent.png", 16, 1),
    ]),
    "puzzle": ("puzzle-pack-2-795-assets", [
        ("Balls", "sprites", "pictures", ["PNG/Balls/*/*.png"], 0.3),
        ("Paddles", "sprites", "pictures", ["PNG/Paddles/*.png"], 0.25),
        ("Coins", "sprites", "pictures", ["PNG/Coins/*.png"], 0.3),
    ] + [(f"Blocks: {c}", "sprites", "pictures", [f"PNG/Tiles {c}/*.png"], 0.3) for c in ("blue", "green", "red", "yellow")]),
    "ui": ("ui-pack", [
        ("Wide buttons and sliders", "sprites", "pictures", [f"PNG/{c}/Default/*.png" for c in ("Blue", "Green", "Grey", "Red", "Yellow")] + ["PNG/Extra/Default/*.png"], 1, -64),
        ("Buttons, checks and icons", "sprites", "pictures", [f"PNG/{c}/Default/*.png" for c in ("Blue", "Green", "Grey", "Red", "Yellow")] + ["PNG/Extra/Default/*.png"], 1, 64),
    ]),
    "tiny-farm": ("tiny-farm", [
        ("Tiles", "tiles", "pictures", ["Tiles/*.png"], 1, None, 12),
    ]),
    "one-bit": ("1-bit-pack", [
        ("Tiles", "tiles", "grid", "Tilesheet/colored_transparent_packed.png", 16),
    ]),
    "toon-characters": ("toon-characters-1", [
        (f"{who}", "sprites", "grid", f"{who}/Tilesheet/character_{file}_sheet.png", (96, 128))
        for who, file in (("Female adventurer", "femaleAdventurer"), ("Female person", "femalePerson"),
                          ("Male adventurer", "maleAdventurer"), ("Male person", "malePerson"),
                          ("Robot", "robot"), ("Zombie", "zombie"))
    ]),
}


def natural(p):
    """file2 before file10."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", p)]


def pictures(src, globs, scale, limit=None, cols=None, trim=True):
    files = []
    for g in globs:
        files += sorted(glob.glob(str(src / g)), key=natural)
    # Pictures all one size are kept whole: tiles must fill their squares
    # (a half tile trimmed would sit in the middle of its cell), and an
    # animation's frames must keep its feet in one place.
    same = len({Image.open(f).size for f in files}) == 1
    ims = []
    for f in files:
        im = Image.open(f).convert("RGBA")
        if trim and not same:
            im = im.crop(im.getbbox() or (0, 0, im.width, im.height))
        if scale != 1:
            im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
        # limit: only pictures this size or smaller; a negative limit, only bigger.
        big = max(im.size)
        if limit is not None and ((limit > 0 and big > limit) or (limit < 0 and big <= -limit)):
            continue
        ims.append(im)
    if not ims:
        raise SystemExit(f"No pictures for {globs}")
    cw = math.ceil(max(i.width for i in ims) / 2) * 2
    ch = math.ceil(max(i.height for i in ims) / 2) * 2
    cols = cols or max(1, min(len(ims), MAX_W // cw))
    rows = math.ceil(len(ims) / cols)
    sheet = Image.new("RGBA", (cw * cols, ch * rows), (0, 0, 0, 0))
    for k, im in enumerate(ims):
        x, y = (k % cols) * cw, (k // cols) * ch
        sheet.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2), im)
    return sheet, (cw, ch), len(ims)


def respace(src, file, tile, gap):
    im = Image.open(src / file).convert("RGBA")
    cols, rows = (im.width + gap) // (tile + gap), (im.height + gap) // (tile + gap)
    out = Image.new("RGBA", (cols * tile, rows * tile), (0, 0, 0, 0))
    for r in range(rows):
        for c in range(cols):
            x, y = c * (tile + gap), r * (tile + gap)
            out.paste(im.crop((x, y, x + tile, y + tile)), (c * tile, r * tile))
    return out, (tile, tile), cols * rows


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def make(packs_dir, pack_id):
    folder, sheets = PACKS[pack_id]
    src = packs_dir / folder / "u"
    out = OUT / pack_id
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    listed = []
    for spec in sheets:
        name, use, how = spec[:3]
        if how == "pictures":
            globs, scale = spec[3], spec[4]
            limit = spec[5] if len(spec) > 5 else None
            cols = spec[6] if len(spec) > 6 else None
            sheet, cell, n = pictures(src, globs, scale, limit, cols, trim=use == "sprites")
        elif how == "grid":
            sheet = Image.open(src / spec[3]).convert("RGBA")
            cell = spec[4] if isinstance(spec[4], tuple) else (spec[4], spec[4])
            n = (sheet.width // cell[0]) * (sheet.height // cell[1])
            assert sheet.width % cell[0] == 0 and sheet.height % cell[1] == 0, (pack_id, name, sheet.size)
        else:
            sheet, cell, n = respace(src, spec[3], spec[4], spec[5])
        file = slug(name) + ".png"
        sheet.save(out / file, optimize=True)
        listed.append((name, file, cell, use, n))
    # Kenney's own preview (the pack's root has Preview.png or Sample.png), fitted to the library's 360 x 202.
    shots = sorted(p for p in src.glob("*.png") if re.match(r"(preview|sample)", p.name, re.I))
    preview = Image.open(shots[0]).convert("RGB") if shots else Image.new("RGB", (360, 202), (30, 40, 50))
    from PIL import ImageOps
    ImageOps.fit(preview, (360, 202), Image.LANCZOS).save(out / "preview.png", optimize=True)
    lic = next(p for p in src.iterdir() if p.name.lower().startswith("licen"))
    shutil.copy(lic, out / "License.txt")
    size = sum(f.stat().st_size for f in out.iterdir()) // 1024
    print(f"{pack_id}: {size} KB")
    for name, file, (cw, ch), use, n in listed:
        print(f'      {{ name: "{name}", file: k("{pack_id}", "{file}"), tileWidth: {cw}, tileHeight: {ch}, use: "{use}" }},  // {n}')


if __name__ == "__main__":
    packs_dir = Path(sys.argv[1])
    for pid in sys.argv[2:] or PACKS:
        make(packs_dir, pid)
