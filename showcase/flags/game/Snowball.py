# object: Snowball
# sprite: snowball
# depth: -2000
# A thrown snowball. (x, y) is its shadow on the ground; it's drawn up in the air,
# `z` pixels, in an arc. It flies `length` pixels and splats. A pine or a fort wall
# stops it at any height; a kid, a bank or a hedge only when it's down low (LOW),
# at the start or the end of its flight. It flies over the creek.

# === create
self.team = "red"
self.thrower = None
self.real = True           # only a real one can knock anyone down (in a room, only the host's are real)
self.vx = self.vy = 0
self.length = THROW_MIN
self.gone = 0
self.z = 0
self.visible = True

# === step
self.x += self.vx
self.y += self.vy
self.gone += BALL_PACE
f = min(1, self.gone / max(1, self.length))
self.z = 4 * ARC * self.length * f * (1 - f)
under = letter_at(self.x, self.y)
if under in TALL or (under in SOLID and self.z < LOW) or self.gone >= self.length:
    splat(self)

# === collision Kid
if self.z < LOW and ball_hits(self, other):
    splat(self)

# === draw
z = self.z + 14
draw_set_color("#000000")
draw_set_alpha(0.18)
draw_ellipse(self.x - 4, self.y - 2, self.x + 4, self.y + 2)
draw_set_alpha(1)
draw_sprite("snowball", 0, self.x, self.y - z)
