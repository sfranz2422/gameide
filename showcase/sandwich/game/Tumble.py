# object: Tumble
# depth: -30
# A layer that slid off the pile, spinning away and falling off the screen. Only a
# picture: the stack script took it off the sandwich as it fell.

# === create
self.layer = None
self.bread = "white"
self.size = 1.0
self.vx = 0
self.vy = 0
self.spin = 0
self.turn = 0
self.t = 0

# === step
self.t += 1
self.vy += 0.5
self.x += self.vx
self.y += self.vy
self.turn += self.spin
if self.t > TUMBLE_STEPS or self.y > VIEW_H + 120:
    self.destroy()

# === draw
draw_layer({"bread": self.bread}, self.layer, self.x, self.y, self.size, 0, self.turn)
