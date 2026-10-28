#!/usr/bin/env python3
"""
Makes the pictures the Starter Projects start from (store/templates.ts:
topdown, pointclick, novel), into public/starters/. Run it again only to
change them; what it makes is checked in.

    python3 frontend/scripts/make_starters.py

- topdown/: characters cut from Kenney's Tiny Dungeon (CC0), one 16 x 16
  picture each. The village's tiles are Tiny Town's sheet itself, straight
  from public/library.
- pointclick/: three rooms (the third for the tutorial to build), Robin
  and two items from Mystery Meat from Outer Space, doubled to 640 wide
  with hard pixels (the game is 320 wide; the starter is 640 so the
  built-in dialogue box isn't huge), and a hotspot's see-through box.
- novel/: six scenes and two portraits from The Lantern of Greymire, at
  960 x 540, as WebP.

The Gemini pictures come out of the showcase games' builds, so build them
first (python3 showcase/mystery/build.py, showcase/greymire/build.py): their
pictures live in the teacher's Downloads, never in the repository — except
these few, which the teacher chose to ship with the starters (2026-10-28).
"""
import io
import json
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "starters"
KENNEY = ROOT / "frontend" / "public" / "library" / "kenney"

# Tiny Dungeon cells (16 x 16, 12 to a row): what each character is.
DUNGEON = {"hero": 98, "wizard": 84, "slime": 108}
# Tiny Town cells: the coin is its gold bar.
TOWN = {"coin": 93}


def cell(sheet, n):
    return sheet.crop(((n % 12) * 16, (n // 12) * 16, (n % 12) * 16 + 16, (n // 12) * 16 + 16))


def sprites_of(zip_path):
    """A showcase build's sprites: name -> list of frames as pictures."""
    z = zipfile.ZipFile(zip_path)
    p = json.loads(z.read("project.json"))
    idx = json.loads(z.read("assets/index.json"))
    return {s["name"]: [Image.open(io.BytesIO(z.read(idx[f]))).convert("RGBA") for f in s["frames"]] for s in p["sprites"]}


def save(im, path, **kw):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, **kw)
    return path.stat().st_size


def main():
    sizes = {}
    dungeon = Image.open(KENNEY / "tiny-dungeon" / "tiles.png").convert("RGBA")
    town = Image.open(KENNEY / "tiny-town" / "tiles.png").convert("RGBA")
    for name, n in DUNGEON.items():
        sizes[f"topdown/{name}.png"] = save(cell(dungeon, n), OUT / "topdown" / f"{name}.png", optimize=True)
    for name, n in TOWN.items():
        sizes[f"topdown/{name}.png"] = save(cell(town, n), OUT / "topdown" / f"{name}.png", optimize=True)

    mm = sprites_of(ROOT / "showcase" / "mystery" / "out" / "Mystery.zip")
    double = lambda im: im.resize((im.width * 2, im.height * 2), Image.NEAREST)
    # The cafeteria isn't in the starter's game: the tutorial's last step builds it.
    for room in ("newsroom", "hallway", "cafeteria"):
        sizes[f"pointclick/{room}.png"] = save(double(mm[f"room_{room}"][0]), OUT / "pointclick" / f"{room}.png", optimize=True)
    # Robin: the walk (0-5), standing facing us (6), from behind (7), from the side (8).
    for i, f in enumerate(mm["robin"][:9]):
        sizes[f"pointclick/robin_{i}.png"] = save(double(f), OUT / "pointclick" / f"robin_{i}.png", optimize=True)
    for name, n in (("camera", 0), ("notepad", 9)):
        sizes[f"pointclick/{name}.png"] = save(double(mm["items"][n]), OUT / "pointclick" / f"{name}.png", optimize=True)

    # A hotspot's picture: a see-through box, stretched over the thing it is
    # in the room editor, and hidden in the game (Tab shows them).
    spot = Image.new("RGBA", (32, 32), (255, 225, 77, 70))
    for i in range(32):
        for x, y in ((i, 0), (i, 31), (0, i), (31, i)):
            spot.putpixel((x, y), (255, 225, 77, 230))
    sizes["pointclick/spot.png"] = save(spot, OUT / "pointclick" / "spot.png", optimize=True)

    gm = sprites_of(ROOT / "showcase" / "greymire" / "out" / "Greymire.zip")
    for scene in ("landing", "ferry", "reeds", "willow", "chapel", "dawn"):
        im = gm[f"pic_{scene}"][0].convert("RGB").resize((960, 540), Image.LANCZOS)
        sizes[f"novel/{scene}.webp"] = save(im, OUT / "novel" / f"{scene}.webp", quality=78, method=6)
    for face in ("marrow", "pip"):
        for i, f in enumerate(gm[f"face_{face}"]):
            sizes[f"novel/{face}_{i}.webp"] = save(f, OUT / "novel" / f"{face}_{i}.webp", quality=82, method=6)

    total = sum(sizes.values())
    print(f"{len(sizes)} pictures, {total / 1e6:.2f} MB, in {OUT}")


if __name__ == "__main__":
    main()
