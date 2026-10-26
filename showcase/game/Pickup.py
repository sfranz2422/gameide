# object: Pickup
# depth: 20
# The parent of everything the hero picks up. Placed ones bob in the air
# and stay taken after a death (mark_done); ones an enemy dropped fall to
# the ground and are just picked up.

# === create
self.dropped = False
self.t = random.random() * 6
self.base_y = self.y - 6
self.vy = 0
place_key(self)
if is_done(self):
    self.destroy()

# === step
if self.dropped:
    fall(self, half_width=4)
else:
    self.t += 0.07
    self.y = self.base_y + math.sin(self.t) * 2
