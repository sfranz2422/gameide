# object: Faller
# depth: -20
# A layer on its way down. Where it lands is decided as it's let go (dx); this only
# shows the fall, then hands it to land() in the acts script, which asks the stack
# script whether the pile holds. A second tap before it lands makes it land at once.

# === create
self.key = ""
self.dx = 0.0
self.y0 = -60
self.t = 0

# === step
self.t += 1
if self.t >= DROP_STEPS:
    land(self)

# === draw
s = global_vars.s
ks = kitchen_scale(s)
layer = {"k": self.key, "dx": self.dx}
to = PLATE_Y - (height(s) + thick(s, layer) / 2) * ks
p = min(1, self.t / DROP_STEPS)
self.y = self.y0 + (to - self.y0) * p * p      # falling faster and faster
self.x = PLATE_X + self.dx * ks
draw_layer(s, layer, self.x, self.y, ks)
