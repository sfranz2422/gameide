# object: Building
# depth: 20
# Anything that stays put and can be knocked down: the towers, the keep, a wall.
# `side` is 0 (blue, left) or 1 (red, right).

# === create
self.side = 0
self.uid = next_uid()       # how the other player's game knows it again (Link)
self.puppet = False         # True in the other player's game: a copy, moved by Link
self.hp = self.max_hp = 100
self.radius = 16
self.flash = 0
self.level, self.power = 1, 1.0    # the card's level (upgrade): set as its card is played

# === step
if self.flash > 0:
    self.flash -= 1

# === draw
bar(self.x, self.y - self.radius - 10, self.radius * 2, self.hp / self.max_hp, SIDE_COLOR[self.side])
