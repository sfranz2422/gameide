# object: Puff
# depth: -30
# A puff of dust: troops arriving, or knocked out. It grows and fades by itself.

# === create
self.life = 20
self.kind = "puff"               # or "ice_burst": an Ice Golem breaking up

# === step
self.life -= 1
if self.life <= 0:
    self.destroy()

# === draw
k = 1 - self.life / 20
draw_sprite_ext(self.kind, 0, self.x, self.y, 0.7 + k * 0.6, 0.7 + k * 0.6, 0, "white", 1 - k)
