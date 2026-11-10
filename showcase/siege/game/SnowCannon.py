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
    shoot(self.x + 18 * forward(self.side), self.y - 6, t, self.damage, self.side, "snowshot")
    self.cool = self.rate
    sound_play("shoot", volume=0.3)

# === draw
# Just fired: the firing picture (and its puff of snow) for a moment.
fired = self.cool > self.rate - 10
name = "cannon_fire" if fired else "cannon_" + TEAM[self.side]
draw_sprite_ext(name, 0, self.x, self.y, forward(self.side), 1, 0, "#ffd0d0" if self.flash else "white")
super().on_draw()
