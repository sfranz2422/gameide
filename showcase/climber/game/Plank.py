# object: Plank
# parent: Ledge
# sprite: plank
# A plank hung on ropes, swinging side to side. It carries you with it.

# === create
super().on_create()
self.half = PLANK_W / 2
self.home_x = self.x
self.plan_i = 0

# === begin_step
t = global_vars.ticks / PLANK_STEPS * 2 * math.pi + self.plan_i * 1.7
x = self.home_x + PLANK_SWING * math.sin(t)
self.dx = x - self.x
self.x = x
