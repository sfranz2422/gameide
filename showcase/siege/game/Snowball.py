# object: Snowball
# depth: -2
# A big snowball rolling down a lane toward the other side: it bowls over each troop
# on foot that it meets (once each), and stops against a building.

# === create
self.side = 0
self.uid = next_uid()       # how the other player's game knows it again (Link)
self.puppet = False         # True in the other player's game: a copy, moved by Link
self.hit = set()
self.roll = 0

# === step
if self.puppet or stopped():
    return
self.x += SNOWBALL_SPEED * forward(self.side)
self.roll += SNOWBALL_SPEED / SNOWBALL_R
for u in instances("Unit"):
    if u.side != self.side and not u.flies and id(u) not in self.hit and point_distance(self.x, self.y, u.x, u.y) < SNOWBALL_R + u.radius:
        self.hit.add(id(u))
        hurt(u, SNOWBALL_DAMAGE)
        sound_play("hit", volume=0.4)
for b in instances("Building"):
    if b.side != self.side and point_distance(self.x, self.y, b.x, b.y) < SNOWBALL_R + b.radius:
        hurt(b, SNOWBALL_TOWER)
        sound_play("crash", volume=0.4)
        self.destroy()
        return
if self.x < -20 or self.x > VIEW_W + 20:
    self.destroy()

# === draw
draw_sprite_ext("snowball_" + TEAM[self.side], 0, self.x, self.y, 1, 1, math.degrees(-self.roll) * forward(self.side))
