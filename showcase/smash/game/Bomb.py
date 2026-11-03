# object: Bomb
# sprite: bomb
# parent: Shot
# Click while it flies to set it off. If you don't, it goes off soon after it lands.

# === create
super().on_create()
self.weight = 2
self.life = 75

# === mouse global pressed left
if self.flying:
    self.destroy()

# === destroy
if self.flying:
    blast(self.x, self.y, 150, 16)
