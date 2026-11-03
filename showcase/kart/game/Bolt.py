# object: Bolt
# sprite: bolt
# parent: Scenery
# Fired forward: it follows the road until it's near the kart it's after, then
# goes straight for it. Hedges don't stop it, or it would rarely arrive.

# === create
self.image_speed = 0
self.image_xscale = self.image_yscale = 18 / 48
self.look_low = 1
self.owner = None
self.target = None
self.i = 0
self.alarm[0] = 300

# === step
line = RACE["line"]
if self.target is not None and not self.target._alive:
    self.target = None
if self.target is not None and point_distance(self.x, self.y, self.target.x, self.target.y) < 140:
    tx, ty = self.target.x, self.target.y
else:
    self.i = (self.i + 1) % len(line) if point_distance(self.x, self.y, *line[(self.i + 1) % len(line)]) < 24 else self.i
    tx, ty = line[(self.i + 2) % len(line)]
d = point_direction(self.x, self.y, tx, ty)
self.x += math.cos(math.radians(d)) * BOLT_SPEED
self.y -= math.sin(math.radians(d)) * BOLT_SPEED

# === alarm 0
self.destroy()

# === collision Kart
if other is not self.owner:
    spin_out(other)
    self.destroy()
