# object: Bird
# parent: Decor
# A snow bird, that flies off when a climber comes too close.

# === create
super().on_create()
self.flying = False
self.vx = 0

# === step
if not self.flying:
    for c in instances("Climber"):
        if point_distance(self.x, self.y, c.x, c.y) < 70:
            self.flying = True
            self.vx = 2.2 if c.x < self.x else -2.2
            self.image_xscale = 1 if self.vx > 0 else -1
            sound_play("tweet", volume=0.3)
else:
    self.x += self.vx
    self.y -= 1.6
    if self.y < view_y - 60:
        self.destroy()
