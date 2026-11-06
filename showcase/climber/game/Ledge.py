# object: Ledge
# Anything a climber can stand on. You land on it from above and jump up through
# it from below: a one-way platform. The landing is the Player's code; a ledge
# only says where it is: its middle at x, its top at y, and `half` its width
# either side. Its children say what kind it is.

# === create
self.half = 32
self.slippery = False
self.broken = False
self.dx = 0          # how far it moved this step, to carry whoever stands on it
self.dy = 0
self.stood = 0       # a climber standing on it sets this, every step
self.image_speed = 0

# === end_step
if self.stood > 0:
    self.stood -= 1
