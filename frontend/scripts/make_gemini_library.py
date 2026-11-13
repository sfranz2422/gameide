#!/usr/bin/env python3
"""
Makes the art library's Gemini packs (public/library/gemini/<game>/) from the
showcase games' pictures: the teacher's Google Gemini sheets, already cut into
one picture each by every game's cut_sheets.py (showcase/<game>/art/).

    python3 frontend/scripts/make_gemini_library.py [game …]

Every pack credits Gemini: a License.txt beside its sheets, and `credit` in
src/library/geminiPacks.ts (written here), which the library shows on the
pack and in the list. The teacher's ask: students using this art say it was
made with Google Gemini.

The library's sheets are grids of equal cells (library.ts), so pictures are
sorted into sheets of similar size and kind:

    Characters        every picture of one character, in one row: a group of
                      two or more pictures (GROUPS below, or a name ending in
                      a number: run1, run2)
    Big characters    the same, for characters over 128 px, shrunk to 128
    Things            single pictures up to 200 px
    Small things      up to 64 px, so a coin's cell isn't a fort's
    Big things        200 to 400 px, shrunk to 200
    Ground tiles      tile_, floor_, ground_: offered as a tileset first
    Backgrounds       wider or taller than 400 px, shrunk to 480 across

Each picture sits in the middle of its cell, standing on the bottom. A
sheet's pictures all shrink by the same amount, so characters stay one size
next to each other. Titles (the game's own name) are left out.
"""
import json
import math
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SHOW = ROOT / "showcase"
OUT = ROOT / "frontend" / "public" / "library" / "gemini"
TS = ROOT / "frontend" / "src" / "library" / "geminiPacks.ts"
MAX_W = 1024
CREDIT = "Art made with Google Gemini"

# id: (folder, name, about, base scale, [group patterns]). Base scale undoes a
# game keeping its pictures bigger than it shows them (Order Up! and Squeeze
# keep them at twice the size).
GAMES = {
    "climber": ("climber", "Snowcap Scramble", "Climbers in eight colours (stand, run, jump, fall, throw), snowballs, ice and rock ledges, pines, clouds and snowy mountains.",
                1.0, [r"^(climber_[a-z]+)_"]),
    "cooking": ("cooking", "Order Up!", "Two cooks and eight customers with every mood, burgers, fries, noodles, dumplings and drinks, grills, fryers and pots.",
                0.5, [r"^(cook_\d+)_", r"^(cust_\d+)_"]),
    "flags": ("flags", "Snowfort Flags", "Kids in red and blue from above (walking every way, throwing, cheering, fallen), flags, forts, trees, snow and park ground tiles.",
              1.0, [r"^(kid_(?:blue|red)_\d+)_", r"^(flag_(?:blue|red))"]),
    "kart": ("kart", "Zoomtown Cup", "A go-kart seen from behind as it turns, roadside bushes and trees, and a sky.",
             1.0, []),
    "lemon": ("lemon", "Squeeze", "Twelve customers who walk, stand, drink and smile, a lemonade stand, its owner, and lemons, sugar, ice and coins.",
              0.5, [r"^(cust_\d+)_"]),
    "rpg": ("rpg", "The Lanterns of Hollowmere", "Three heroes walking four ways and fighting, villagers and their faces, monsters, cottages, trees, items, ground tiles and painted backgrounds.",
            1.0, []),
    "siege": ("siege", "Tabletop Siege", "Snow-fort troops in red and blue (kids, snowmen, penguins, yetis, moose and more), towers, castles, cards and snowballs.",
              1.0, [r"^(card)_"]),
    "undertow": ("undertow", "Undertow", "Divers in eight colours (walking, working, frozen, ghosts), sea creatures, a submarine base's floors, walls, doors and machines.",
                 1.0, [r"^(crew_[a-z]+)_"]),
}

TILE = re.compile(r"^(tile|floor|ground)_")
LEAVE_OUT = {"title"}


def key_of(name, patterns):
    """Which group a picture belongs to: a pattern's first part, or the name without a number at its end."""
    for p in patterns:
        m = re.match(p, name)
        if m:
            return m.group(1)
    return re.sub(r"_?\d+$", "", name)


def natural(s):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]


def shrink(im, k):
    if k >= 0.999:
        return im
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def sheet_of(groups, cap_w=None, cap_h=None):
    """Groups of pictures (each a row) on one grid: cells the biggest picture's size after the sheet's shrink."""
    pics = [p for g in groups for _, p in g]
    k = 1.0
    if cap_h:
        k = min(k, cap_h / max(p.height for p in pics))
    if cap_w:
        k = min(k, cap_w / max(p.width for p in pics))
    groups = [[(n, shrink(p, k)) for n, p in g] for g in groups]
    cw = max(p.width for g in groups for _, p in g)
    ch = max(p.height for g in groups for _, p in g)
    singles = all(len(g) == 1 for g in groups)
    cells = []
    if singles:
        # Single pictures fill rows in turn, the sheet about as wide as it is tall.
        cols = max(1, min(MAX_W // cw, math.ceil(math.sqrt(len(groups) * ch / cw * 1.6))))
        cells = [g[0] for g in groups]
        rows = math.ceil(len(cells) / cols)
        places = [(i % cols, i // cols) for i in range(len(cells))]
    else:
        # A character's pictures stay together on one row: several characters
        # share a row when they fit, and one too long for a row goes on over
        # several. (A row each made Tabletop Siege's sheet 3432 px tall.)
        cols = max(1, min(MAX_W // cw, sum(len(g) for g in groups)))
        places, row, col = [], 0, 0
        for g in groups:
            if col and col + len(g) > cols:
                row, col = row + 1, 0
            for item in g:
                if col == cols:
                    row, col = row + 1, 0
                places.append((col, row))
                cells.append(item)
                col += 1
        rows = row + 1
        cols = max(c for c, _ in places) + 1
    out = Image.new("RGBA", (cols * cw, rows * ch), (0, 0, 0, 0))
    for (n, p), (c, r) in zip(cells, places):
        out.alpha_composite(p, (c * cw + (cw - p.width) // 2, r * ch + ch - p.height))
    return out, cw, ch


def build(gid):
    folder, name, about, base, patterns = GAMES[gid]
    art = SHOW / folder / "art"
    pics = {}
    for f in sorted(art.glob("*.png")):
        if f.stem in LEAVE_OUT:
            continue
        pics[f.stem] = shrink(Image.open(f).convert("RGBA"), base)
    groups = {}
    for n in sorted(pics, key=natural):
        groups.setdefault(key_of(n, patterns), []).append((n, pics[n]))

    kinds = {k: [] for k in ["Characters", "Big characters", "Things", "Small things", "Big things", "Ground tiles", "Backgrounds"]}
    for key, g in groups.items():
        side = max(max(p.size) for _, p in g)
        if TILE.match(key):
            kinds["Ground tiles"].append(g)
        elif side > 400:
            kinds["Backgrounds"] += [[x] for x in g]
        elif len(g) > 1 and key != "card":
            kinds["Characters" if side <= 128 else "Big characters"].append(g)
        elif side <= 64:
            kinds["Small things"] += [[x] for x in g]
        elif side <= 200:
            kinds["Things"] += [[x] for x in g]
        else:
            kinds["Big things"] += [[x] for x in g]

    dest = OUT / gid
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.png"):
        old.unlink()
    sheets = []
    caps = {"Big characters": (None, 128), "Big things": (200, 200), "Ground tiles": (64, 64), "Backgrounds": (480, None)}
    for kind, gs in kinds.items():
        if not gs:
            continue
        cap_w, cap_h = caps.get(kind, (None, None))
        im, cw, ch = sheet_of(gs, cap_w, cap_h)
        file = kind.lower().replace(" ", "-") + ".png"
        im.save(dest / file, optimize=True)
        sheets.append({"name": kind, "file": f"library/gemini/{gid}/{file}", "tileWidth": cw, "tileHeight": ch,
                       "use": "tiles" if kind == "Ground tiles" else "sprites"})

    # The preview: the game's title picture when it has one (it shows the game's look), else its main character.
    title = art / "title.png"
    biggest = max(groups.values(), key=len)  # the pack's longest animation: Zoomtown Cup's kart, not a bush
    prev = Image.open(title).convert("RGBA") if title.exists() else biggest[0][1]
    shrink(prev, min(1, 320 / prev.width, 180 / prev.height)).save(dest / "preview.png", optimize=True)
    (dest / "License.txt").write_text(
        f"{name}: pictures for GameIDE's art library\n\n"
        f"Made with Google Gemini (an AI picture maker) by GameIDE's teacher for the showcase game {name},\n"
        "then cut apart and shrunk to game size for the art library.\n\n"
        "You may use them in your games. Please give credit, for example in your game's\n"
        f"credits or its description:\n\n    {CREDIT}\n")
    return {"id": f"gemini-{gid}", "name": name, "author": "Google Gemini", "licence": "Free for your games: please credit Gemini",
            "credit": CREDIT, "url": "https://gemini.google.com/", "preview": f"library/gemini/{gid}/preview.png", "about": about,
            "sheets": sheets}


def main():
    wanted = sys.argv[1:] or list(GAMES)
    packs = {}
    if TS.exists():
        # Keep the packs not rebuilt this time.
        m = re.search(r"= (\[.*\]);", TS.read_text(), re.S)
        if m:
            packs = {p["id"]: p for p in json.loads(m.group(1))}
    for gid in wanted:
        packs[f"gemini-{gid}"] = build(gid)
        print(gid, [(s["name"], s["tileWidth"], s["tileHeight"]) for s in packs[f"gemini-{gid}"]["sheets"]])
    ordered = [packs[f"gemini-{g}"] for g in GAMES if f"gemini-{g}" in packs]
    TS.write_text(
        "/**\n * The art library's Gemini packs: written by scripts/make_gemini_library.py\n"
        " * from the showcase games' pictures. Don't edit by hand; run the script.\n */\n"
        'import type { LibraryPack } from "./library";\n\n'
        f"export const GEMINI_PACKS: LibraryPack[] = {json.dumps(ordered, indent=2)};\n")


if __name__ == "__main__":
    main()
