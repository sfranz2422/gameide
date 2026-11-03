# object: Shell
# sprite: shell
# parent: Shot
# Flies to where the target was, over everything, and bursts there.

# === create
super().on_create()
self.fly = 6
self.air = False
self.to_x, self.to_y = self.x, self.y
self.reach = 70

# === step
self.image_angle = self.direction - 90
if point_distance(self.x, self.y, self.to_x, self.to_y) <= self.fly:
    blast(self.to_x, self.to_y, self.reach, self.damage, False)
    sound_play("boom", volume=0.4)
    self.destroy()
