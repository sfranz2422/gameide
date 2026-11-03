# object: Thing
# Anything physics moves. Remembers how fast it was going, because by the time a
# Collision event runs, physics has already changed its speed. Its children are
# Ground, Block and Shot.

# === create
self.physics = True
self.friction = 0.7
self.bounce = 0.05
self.hp = 1
self.tough = 1e9     # how hard it is to break: Block's children lower this
self.pierce = 0
self.was_h = 0
self.was_v = 0
self.image_speed = 0

# === end_step
self.was_h = self.hspeed
self.was_v = self.vspeed

# === collision Thing
bump(self, other)
