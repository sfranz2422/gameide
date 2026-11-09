# object: Lamps
# The station's own lights: a dim one in each room, so it's dark but not black.
# Your lamp (Player) is the bright one.

# === create
lighting(0.9, "#01060d")

# === step
for name, (c, r, w, h), _ in ROOMS:
    x, y = (c + w / 2) * TILE, (r + h / 2) * TILE
    light(x, y, max(w, h) * TILE * 0.45, "#4fb3d9", 0.35)
