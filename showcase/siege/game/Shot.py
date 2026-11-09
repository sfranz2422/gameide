# object: Shot
# depth: -5
# A rubber band or a pencil-cup shot on its way: it follows its target and hurts it
# on arrival. If the target is gone first, it fizzles.

# === create
self.target = None
self.damage = 0
self.side = 0
self.pace = 6

# === step
t = self.target
if t is None or not instance_exists(t):
    self.destroy()
    return
d = point_distance(self.x, self.y, t.x, t.y)
if d <= self.pace:
    hurt(t, self.damage)
    self.destroy()
    return
self.x += (t.x - self.x) / d * self.pace
self.y += (t.y - self.y) / d * self.pace

# === draw
draw_set_color("#c9874a" if self.side == 0 else "#7a3b3b")
draw_circle(self.x, self.y, 2.5)
