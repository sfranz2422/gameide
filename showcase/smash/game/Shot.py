# object: Shot
# parent: Thing
# depth: -10
# Anything the sling throws. Children say how heavy it is, and what clicking does
# while it flies. Waits on the sling with physics off until launch() lets it go.

# === create
super().on_create()
self.physics = False
self.weight = 3
self.flying = False
self.touched = False
self.life = 150        # steps it stays once it has hit something
self.still = 0

# === step
if not self.flying:
    return
if self.touched:
    self.life -= 1
self.still = self.still + 1 if self.speed < QUIET else 0
if self.life <= 0 or self.still > 30:
    effect("dust", self.x, self.y)
    self.destroy()

# === collision Thing
if self.flying:
    if not self.touched and point_distance(self.was_h, self.was_v, other.was_h, other.was_v) > BUMP_MIN:
        sound_play("thud", volume=0.6)
    self.touched = True
