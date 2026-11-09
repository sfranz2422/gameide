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
    near = [u for u in instances("Unit") if u.side != self.side and point_distance(self.x, self.y, u.x, u.y) <= self.range]
    self.target = t = min(near, key=lambda u: point_distance(self.x, self.y, u.x, u.y)) if near else None
if t is not None and self.cool == 0:
    shoot(self.x, self.y - 14, t, self.damage, self.side)
    self.cool = self.rate
    sound_play("shoot", volume=0.25)

# === draw
# A pencil cup in the side's colour, with pencils in it.
c = SIDE_COLOR[self.side]
draw_set_color("#000000")
draw_set_alpha(0.25)
draw_circle(self.x + 3, self.y + 4, self.radius)
draw_set_alpha(1)
draw_set_color("#ffffff" if self.flash else c)
draw_circle(self.x, self.y, self.radius)
draw_set_color("#1b1208")
draw_circle(self.x, self.y, self.radius, True)
for k, pc in enumerate(("#ffd23f", "#3ecf8e", "#ff7ac6")):
    draw_set_color(pc)
    draw_line(self.x - 6 + k * 6, self.y - 2, self.x - 8 + k * 7, self.y - self.radius - 8, 3)
super().on_draw()
