"""
GameIDE's mark: a pixel cartridge with a creature on its label — the
cartridges of My Games and the badge creatures, in one picture. Drawn once
here as a grid, and written out as the favicon (SVG, plus PNGs for browsers
and phones that want them) and as src/editor/logoCells.ts, which the logo
in the top bar draws from. Run it again after changing the grid:

    python3 scripts/make_logo.py
"""
import json
import pathlib

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent.parent

GRID = [
    "................",
    ".############...",
    ".#############..",
    ".##############.",
    ".##LLLLLLLLLL##.",
    ".##LLwLLLLwLL##.",
    ".##LLwwwwwwLL##.",
    ".##LwwLwwLwwL##.",
    ".##LwwwwwwwwL##.",
    ".##LLwLLLLwLL##.",
    ".##LLLLLLLLLL##.",
    ".##############.",
    ".#ddddddddddddd.",
    ".#k#k#k#k#k#k#k.",
    "................",
    "................",
]
COLORS = {"#": "#2fbf8a", "d": "#239a6f", "L": "#12202b", "w": "#ffd166", "k": "#e0b54a"}

assert len(GRID) == 16 and all(len(r) == 16 for r in GRID)


def svg(pad=0):
    rects = "".join(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{COLORS[c]}"/>'
                    for y, row in enumerate(GRID) for x, c in enumerate(row) if c in COLORS)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">{rects}</svg>\n')


def png(size, background=None):
    scale = size // 16
    img = Image.new("RGBA", (16, 16), background or (0, 0, 0, 0))
    for y, row in enumerate(GRID):
        for x, c in enumerate(row):
            if c in COLORS:
                h = COLORS[c].lstrip("#")
                img.putpixel((x, y), tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
    big = img.resize((16 * scale, 16 * scale), Image.NEAREST)
    out = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    out.paste(big, ((size - big.width) // 2, (size - big.height) // 2), big)
    return out


public = HERE / "public"
(public / "favicon.svg").write_text(svg())
png(32).save(public / "favicon-32.png")
# Phones put this on a home screen: on a dark tile, since they fill transparency.
png(176, (18, 32, 43, 255)).resize((180, 180), Image.NEAREST).save(public / "apple-touch-icon.png")

(HERE / "src" / "editor" / "logoCells.ts").write_text(
    "// Made by scripts/make_logo.py from its grid: GameIDE's mark. Don't edit by hand.\n"
    f"export const LOGO_CELLS: string[] = {json.dumps(GRID)};\n"
    f"export const LOGO_COLORS: Record<string, string> = {json.dumps(COLORS)};\n")
print("wrote favicon.svg, favicon-32.png, apple-touch-icon.png, logoCells.ts")
