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
