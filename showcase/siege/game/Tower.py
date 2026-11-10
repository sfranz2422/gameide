# object: Tower
# parent: Building
# A pencil cup at the head of a lane: it shoots the nearest of the other side's
# troops in range, flyers too. Knocked down, it's a crown for the other side.

# === create
super().on_create()
self.damage = 50
self.range = 110
self.rate = 48
self.cool = 0
self.target = None

# === step
super().on_step()
if self.puppet or stopped():
    return
self.cool = max(0, self.cool - 1)
t = self.target
if t is None or not instance_exists(t) or point_distance(self.x, self.y, t.x, t.y) > self.range:
    # A lane's cup shoots only troops in its own lane (the teacher saw one shooting those at
    # the other cup, crowded toward the middle); the keep covers both.
    near = [u for u in instances("Unit") if u.side != self.side and point_distance(self.x, self.y, u.x, u.y) <= self.range
            and (is_a(self, "Keep") or abs(u.y - self.y) <= LANE_SIGHT)]
    self.target = t = min(near, key=lambda u: point_distance(self.x, self.y, u.x, u.y)) if near else None
if t is not None and self.cool == 0:
    shoot(self.x, self.y - 14, t, self.damage, self.side, "shaving")
    self.cool = self.rate
    sound_play("shoot", volume=0.25)

# === draw
# A pencil cup in the side's colour: cracked when it's down to half.
draw_sprite_ext("cup_" + TEAM[self.side], 0 if self.hp > self.max_hp / 2 else 1, self.x, self.y, 1, 1, 0,
                "#ffd0d0" if self.flash else "white")
super().on_draw()
