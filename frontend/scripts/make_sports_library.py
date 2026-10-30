#!/usr/bin/env python3
"""
Makes the art library's Sports pack (public/library/kenney/sports/) from
Kenney's Sports Pack download (CC0, kenney.nl/assets/sports-pack, also on
opengameart.org/content/sports-pack-350):

    python3 frontend/scripts/make_sports_library.py PATH/TO/UNZIPPED/PACK

The library's sheets are grids of equal cells (src/library/library.ts), and
the pack's players and equipment come as separate pictures of different
sizes, so they're packed here into grids, each picture in the middle of its
cell. Kenney's tilesheets (the pitch, the court, the goals and nets) are 64
pixel grids already and are copied as they are.
"""
import re
import shutil
import sys
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "public" / "library" / "kenney" / "sports"
COLOURS = ["Blue", "Green", "Red", "White", "Special"]
LOOKS = 10                      # characterX (1) to (10): seen from above, 21 x 31, ten skins and hair
ARM = 11                        # characterX (11): an arm in the team's sleeve, pointing right, 19 x 13
PLAYER_CELL = (24, 32)
EQUIP_CELL, EQUIP_COLS = (32, 32), 8
TILESHEETS = {"groundGrass_mown.png": "pitch.png", "groundBeige_blue.png": "court.png",
              "groundTarmac.png": "tarmac.png", "elements.png": "goals.png"}


def grid(pictures, cell, cols):
    rows = (len(pictures) + cols - 1) // cols
    sheet = Image.new("RGBA", (cell[0] * cols, cell[1] * rows), (0, 0, 0, 0))
    for i, im in enumerate(pictures):
        x, y = (i % cols) * cell[0], (i // cols) * cell[1]
        sheet.paste(im, (x + (cell[0] - im.width) // 2, y + (cell[1] - im.height) // 2), im)
    return sheet


def main(pack):
    png = pack / "PNG"
    OUT.mkdir(parents=True, exist_ok=True)
    # A row a team: its ten looks, then its arm (the bodies have none: a
    # player is drawn with arms where they're needed, holding a club or a bat).
    players = [Image.open(png / c / f"character{c} ({n}).png").convert("RGBA")
               for c in COLOURS for n in list(range(1, LOOKS + 1)) + [ARM]]
    grid(players, PLAYER_CELL, LOOKS + 1).save(OUT / "players.png", optimize=True)
    equipment = sorted((png / "Equipment").glob("*.png"))
    grid([Image.open(f).convert("RGBA") for f in equipment], EQUIP_CELL, EQUIP_COLS).save(OUT / "equipment.png", optimize=True)
    for src, dst in TILESHEETS.items():
        shutil.copy(pack / "Tilesheet" / src, OUT / dst)
    shutil.copy(pack / "License.txt", OUT / "License.txt")
    # The preview: a strip of players, the equipment, over the pitch.
    preview = Image.open(pack / "Tilesheet" / "groundGrass_mown.png").convert("RGBA").crop((0, 0, 360, 202))
    for i, im in enumerate(players[::LOOKS + 1][:5] + players[3::LOOKS + 1][:5]):
        big = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
        preview.alpha_composite(big, (40 + (i % 5) * 60, 8 + (i // 5) * 66))
    gear = Image.open(OUT / "equipment.png")
    preview.alpha_composite(gear.crop((0, 0, 256, 64)), (52, 138))
    preview.save(OUT / "preview.png", optimize=True)
    print("equipment, in order:", ", ".join(re.sub(r"\.png$", "", f.name) for f in equipment))
    for f in sorted(OUT.iterdir()):
        print(f"  {f.name}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
