# object: Ghost
# sprite: kart_0
# Your best time trial, driving beside you: a kart that only follows a saved
# path, so it can't be bumped and can't get in the way. It drives where the
# real kart went, because its path is what that kart's Game recorded.

# === create
self.path = None
self.image_speed = 0
self.frame_a = 0

# === step
if RACE["count"] > 0 or not self.path:
    return
at = RACE["steps"] // PATH_EVERY
if at >= len(self.path):
    self.destroy()
    return
self.x, self.y, self.frame_a = self.path[at]

# === draw
at = floor_point(self.x, self.y)
if not at or at[2] > NEAR:
    return
self.depth = FOCAL / at[2]
cam = RACE["camera"]
seen = math.degrees(math.atan2(-(self.y - cam["y"]), self.x - cam["x"]))
frame = round(((self.frame_a - seen) % 360) / (360 / FRAMES)) % FRAMES
k = at[2] * KART_WORLD / KART_W
draw_sprite_ext(f"kart_{RACE['karts'][0].who}", frame, at[0], at[1], k, k, 0, "white", 0.45)
