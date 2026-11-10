# object: Body
# sprite: crew_coral
# depth: 4
# A crew member frozen in ice, where the Mimic caught them. Walk up and press E
# to tell everyone. A meeting clears them away. Seen only in your light (Director).

# === create
self.number = 0
self.image_speed = 0
self.image_index = 4
self.t = 0

# === step
self.t += 1
# No glow of its own: a frozen crew member is found by walking into them with your lamp.

# === draw
draw_self()
# The cold touch: a burst of ice as it happens.
if self.t < 40:
    k = 0.6 + self.t / 40
    draw_sprite_ext("ice_burst", 0, self.x, self.y - 22, k, k, 0, "white", 1 - self.t / 40)
