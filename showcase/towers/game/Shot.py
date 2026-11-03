# object: Shot
# What every shot does: fly at its target, and do something when it gets there.
# Its children set how fast and what it looks like.

# === create
self.fly = 8
self.damage = 1
self.air = True
self.target = None
self.reach = 0             # above 0: bursts, hurting everything this close
self.freeze = 0            # above 0: slows what it hits for this many steps
self.depth = -8
self.image_speed = 0
self.alarm[0] = 120        # a shot that misses doesn't fly for ever

# === step
self.image_angle = self.direction - 90

# === alarm 0
self.destroy()

# === collision Enemy
if can_hit(self, other):
    land(self, other)
