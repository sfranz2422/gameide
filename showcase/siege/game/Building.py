# object: Building
# depth: 20
# Anything that stays put and can be knocked down: the towers, the keep, a wall.
# `side` is 0 (blue, left) or 1 (red, right).

# === create
self.side = 0
self.hp = self.max_hp = 100
self.radius = 16
self.flash = 0

# === step
if self.flash > 0:
    self.flash -= 1

# === draw
bar(self.x, self.y - self.radius - 10, self.radius * 2, self.hp / self.max_hp, SIDE_COLOR[self.side])
