# object: IceBlock
# parent: Ledge
# sprite: iceblock
# A block of ice floating up and down.

# === create
super().on_create()
self.slippery = True
self.half = BLOCK_W / 2
self.home_y = self.y
self.plan_i = 0

# === begin_step
t = global_vars.ticks / BLOCK_STEPS * 2 * math.pi + self.plan_i * 2.3
y = self.home_y + BLOCK_BOB * math.sin(t)
self.dy = y - self.y
self.y = y
