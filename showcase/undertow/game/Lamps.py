# object: Lamps
# The station's own lights: a dim one in each room, so it's dark but not black.
# Your lamp (Player) is the bright one.

# === create
# The slow deep tune, once (it carries on from the title into the station).
if not sound_playing("music"):
    sound_play("music", loop=True, volume=0.45)
lighting(0.9, "#01060d")
self.ghostly = False

# === step
# A ghost sees more of the station (but still needs to look round).
if am_ghost() != self.ghostly:
    self.ghostly = am_ghost()
    lighting(0.6 if self.ghostly else 0.9, "#01060d")
for name, (c, r, w, h), _ in ROOMS:
    x, y = (c + w / 2) * TILE, (r + h / 2) * TILE
    light(x, y, max(w, h) * TILE * 0.45, "#4fb3d9", 0.35)
