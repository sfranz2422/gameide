# object: Splat
# sprite: splat
# depth: -2100
# A snowball bursting: three pictures, then gone.

# === create
self.image_speed = 0
self.t = 0

# === step
self.t += 1
self.image_index = min(2, self.t // SPLAT_STEPS)
if self.t >= 3 * SPLAT_STEPS:
    self.destroy()
