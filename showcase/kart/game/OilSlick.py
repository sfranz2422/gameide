# object: OilSlick
# sprite: oil_slick
# parent: Scenery
# Dropped behind a kart. Whoever drives over it next spins out, and it's gone.

# === create
self.image_speed = 0
self.image_xscale = self.image_yscale = 34 / 96
self.look_low = 1
self.owner = None
self.age = 0
self.alarm[0] = 1200

# === step
self.age += 1

# === alarm 0
self.destroy()

# === collision Kart
# Not the kart that dropped it, for a moment: it would be under its own wheels.
if other is not self.owner or self.age > 45:
    spin_out(other)
    self.destroy()
