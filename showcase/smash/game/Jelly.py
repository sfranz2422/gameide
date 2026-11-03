# object: Jelly
# depth: -20
# Freed! It hops home to the sling, then jumps for joy.

# === create
self.gravity = 0.4
self.gravity_direction = 270
self.vspeed = -8
self.home = SLING_X + 90 + instance_number("Jelly") * 22
self.hspeed = -3

# === step
if self.x <= self.home:
    self.hspeed = 0
if self.y >= GROUND_Y - 18 and self.vspeed > 0:
    self.y = GROUND_Y - 18
    self.vspeed = -6 if self.hspeed else choose([-8, -6, -4])
self.image_angle = -self.hspeed * 4
