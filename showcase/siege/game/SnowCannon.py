# object: SnowCannon
# parent: Building
# A snow cannon: shoots far, but only at troops on foot, and melts after a while.
# Knocked down or melted, it's no crown: it isn't a tower.

# === create
super().on_create()
self.hp, self.damage, self.range, self.rate, self.radius, self.life = CANNON
self.max_hp = self.hp
self.cool = 0
self.target = None

# === step
super().on_step()
if self.puppet or stopped():
    return
self.hp -= self.max_hp / self.life
if self.hp <= 0:
    self.destroy()
    return
self.cool = max(0, self.cool - 1)
t = self.target
if t is None or not instance_exists(t) or point_distance(self.x, self.y, t.x, t.y) > self.range:
    near = [u for u in instances("Unit") if u.side != self.side and not u.flies
            and point_distance(self.x, self.y, u.x, u.y) <= self.range and abs(u.y - self.y) <= LANE_SIGHT]
    self.target = t = min(near, key=lambda u: point_distance(self.x, self.y, u.x, u.y)) if near else None
if t is not None and self.cool == 0:
    shoot(self.x + 10 * forward(self.side), self.y - 6, t, self.damage, self.side, "snowshot")
    self.cool = self.rate
    sound_play("shoot", volume=0.3)

# === draw
# (Drawn by the game until the teacher's own picture comes.)
draw_set_color("#8a5a2b")
draw_rect(self.x - 12, self.y, self.x + 12, self.y + 8)
draw_set_color("#3b2a1a")
draw_circle(self.x - 8, self.y + 9, 5)
draw_circle(self.x + 8, self.y + 9, 5)
draw_set_color("#ffffff" if self.flash else "#5a6a7a")
f = forward(self.side)
draw_rect(min(self.x, self.x + 18 * f), self.y - 8, max(self.x, self.x + 18 * f), self.y)
draw_set_color(SIDE_COLOR[self.side])
draw_rect(self.x - 3, self.y - 20, self.x + 7, self.y - 14)
draw_line(self.x - 3, self.y - 20, self.x - 3, self.y, 2)
super().on_draw()
