# object: Rock
# sprite: rock
# parent: Enemy
# A rock shaken loose by the boss. It hurts to be under one; the sword
# breaks it.

# === create
super().on_create()
self.vy = random.uniform(0, 1)
self.image_angle = random.uniform(0, 360)
self.spin = random.uniform(-6, 6)
for i in range(40):              # made inside the ceiling? drop it out first
    if self.place_free(self.x, self.y):
        break
    self.y += 4

# === step
self.vy = min(self.vy + 0.18, 6)
self.y += self.vy
self.image_angle += self.spin
if not self.place_free(self.x, self.y):
    particles(self.x, self.y - 4, count=10, color=["#7a6a55", "#a0896b"], speed=2, size=3, life=20, gravity=0.2)
    sound_play("hit", volume=0.3)
    self.destroy()
