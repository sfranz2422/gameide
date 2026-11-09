# object: Marble
# depth: -2
# A marble rolling down the desk toward the other side: it bowls over each troop
# on foot that it meets (once each), and stops against a building.

# === create
self.side = 0
self.hit = set()
self.roll = 0

# === step
if global_vars.over:
    return
self.x += MARBLE_SPEED * forward(self.side)
self.roll += 0.3
for u in instances("Unit"):
    if u.side != self.side and not u.flies and id(u) not in self.hit and point_distance(self.x, self.y, u.x, u.y) < MARBLE_R + u.radius:
        self.hit.add(id(u))
        hurt(u, MARBLE_DAMAGE)
        sound_play("hit", volume=0.4)
for b in instances("Building"):
    if b.side != self.side and point_distance(self.x, self.y, b.x, b.y) < MARBLE_R + b.radius:
        hurt(b, MARBLE_TOWER)
        sound_play("crash", volume=0.4)
        self.destroy()
        return
if self.x < -20 or self.x > VIEW_W + 20:
    self.destroy()

# === draw
draw_set_color("#000000")
draw_set_alpha(0.25)
draw_circle(self.x + 3, self.y + 3, MARBLE_R)
draw_set_alpha(1)
draw_set_color("#4fc3ff" if self.side == 0 else "#ff8f6b")
draw_circle(self.x, self.y, MARBLE_R)
draw_set_color("#ffffff")
draw_circle(self.x - 4 + math.cos(self.roll) * 2, self.y - 4, 3)
