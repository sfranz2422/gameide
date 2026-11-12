#!/usr/bin/env python3
"""
Takes the teacher's Gemini pictures back out of a zip built with them, as the
files build.py's picture() reads, so the game can be rebuilt (new tracks, say)
without the Gemini sheets, which are no longer in ~/Downloads/kart.

    python3 showcase/kart/art_from_zip.py out/Kart-gemini-backup.zip FOLDER
    KART_ART=FOLDER python3 showcase/kart/build.py

The kart views come from the first racer's frames (her red is the colour
build.py repaints from); the bushes, trees and sky from the first track's,
which no scene restyles.
"""
import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image

zip_path, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
z = zipfile.ZipFile(zip_path)
sprites = {s["name"]: s for s in json.loads(z.read("project.json"))["sprites"]}


def frame(sprite, k):
    return Image.open(io.BytesIO(z.read(f"assets/{sprites[sprite]['frames'][k]}.png"))).convert("RGBA")


for k in range(9):
    frame("kart_0", k).save(out / f"kart_view_{k}.png")
for k in range(3):
    frame("bush_0", k).save(out / f"bush_{k}.png")
    frame("tree_0", k).save(out / f"tree_{k}.png")
frame("sky_0", 0).save(out / "sky_0.png")
print("pictures in", out)
