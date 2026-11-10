# object: Shot
# depth: -5
# A snowball (a penguin's) or an icicle (a tower's) on its way: it follows its target and hurts it
# on arrival. If the target is gone first, it fizzles.

# === create
self.target = None
self.damage = 0
self.side = 0
self.pace = 6
self.kind = "snowshot"

# === step
t = self.target
if t is None or not instance_exists(t):
    self.destroy()
    return
d = point_distance(self.x, self.y, t.x, t.y)
if d <= self.pace:
    if self.kind == "frost" and is_a(t, "Unit"):
        t.chill = CHILL_STEPS
    hurt(t, self.damage)
    self.destroy()
    return
self.x += (t.x - self.x) / d * self.pace
self.y += (t.y - self.y) / d * self.pace

# === draw
t = self.target
a = point_direction(self.x, self.y, t.x, t.y) if t is not None and instance_exists(t) else 0
if self.kind == "frost":
    draw_sprite_ext("spark", 0, self.x, self.y, 0.6, 0.6, self.x * 6)
else:
    draw_sprite_ext(self.kind, 0, self.x, self.y, 1, 1, a if self.kind == "icicle" else 0)
