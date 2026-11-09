# object: Body
# sprite: crew_coral
# depth: 4
# A crew member frozen in ice, where the Mimic caught them. Walk up and press E
# to tell everyone. A meeting clears them away.

# === create
self.number = 0
self.image_speed = 0
self.image_index = 4
self.t = 0

# === step
self.t += 1
light(self.x, self.y - 20, 40, "#9fe3ff", 0.5 + 0.2 * math.sin(self.t / 20))

# === draw
draw_self()
# The cold touch: a burst of ice as it happens.
if self.t < 40:
    k = 0.6 + self.t / 40
    draw_sprite_ext("ice_burst", 0, self.x, self.y - 22, k, k, 0, "white", 1 - self.t / 40)
