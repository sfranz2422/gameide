#!/usr/bin/env python3
"""
Reads each painted track back, across the road at points all round it: road
where the karts find road, then kerb, grass, and hedge past the wall. The game
never looks at the picture, so this is what ties what you see to what you drive
on. kart.test.ts runs it; prints "ok", or what's wrong.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build as B  # noqa: E402

bad = []
for track in B.TRACKS:
    im, look, line = B.paint_track(track).convert("RGB"), track["look"], B.centre_line(track)
    n = len(line)
    half, wall = track["half"], track["half"] + track["verge"]
    road = {B.rgb(look["road"]), B.rgb(look["road2"]), B.rgb(look["line"])}
    lawn = {B.rgb(look["grass"]), B.rgb(look["grass2"])}
    for i in range(10, n, 7):
        ax, ay = line[i]
        bx, by = line[(i + 1) % n]
        nx, ny = -(by - ay) / B.STEP, (bx - ax) / B.STEP
        for side in (-1, 1):
            at = lambda d: im.getpixel((round(ax + nx * side * d), round(ay + ny * side * d)))
            # Just inside the road's edge, and in the grass; a stretch that bends
            # away could have other road nearby, so only "not the wrong thing".
            if at(half - 3) not in road:
                bad.append(f"{track['name']} point {i}: not road {half - 3} from the centre: {at(half - 3)}")
            if at(half + 14) not in lawn:
                bad.append(f"{track['name']} point {i}: not grass {half + 14} from the centre: {at(half + 14)}")
            if at(wall + 12) in road:
                bad.append(f"{track['name']} point {i}: road beyond the hedge")
            # Further than the wall from every point of the road, it's hedge: only
            # that, because on a bend's inside other points' grass reaches here.
            hx, hy = ax + nx * side * (wall + 10), ay + ny * side * (wall + 10)
            if min((hx - p[0]) ** 2 + (hy - p[1]) ** 2 for p in line) > (wall + 2) ** 2 and at(wall + 10) in lawn:
                bad.append(f"{track['name']} point {i}: lawn past the hedge")
    # A boost pad's orange is where the BoostPad object stands.
    for x, y, a in B.GAME["pad_places"](track):
        if im.getpixel((round(x), round(y))) not in ((255, 150, 30), (255, 240, 150)):
            bad.append(f"{track['name']}: no pad painted at ({x:.0f}, {y:.0f})")
print("ok" if not bad else "\n".join(bad[:12]))
