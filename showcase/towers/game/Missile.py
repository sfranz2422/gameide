# object: Missile
# sprite: missile
# parent: Shot
# Turns after its target as it flies. If that's gone, it finds another.

# === create
super().on_create()
self.fly = 7
self.reach = 30

# === step
if self.target is None or not self.target._alive:
    self.target = instance_nearest(self.x, self.y, "Enemy")
if self.target is not None:
    self.direction = point_direction(self.x, self.y, self.target.x, self.target.y)
self.image_angle = self.direction - 90
if self.alarm[0] % 3 == 0:
    particles(self.x, self.y, 1, "#ffb060", speed=0.5, size=3, life=14)
