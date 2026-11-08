# object: Ghost
# parent: Climber
# depth: -9
# Another player in the room, see-through. Their game says where they are a few
# times a second, and each word is a little old by the time it gets here. So
# between words the Ghost carries on as they were going (their speed, and
# gravity in the air) for up to PREDICT_STEPS, then waits: guessing longer could
# send it through a ledge. It glides onto the guess rather than jumping, so it
# never jerks. It doesn't stand on ledges or fall by itself: their game does all
# that, and this only follows.

# === create
super().on_create()
self.image_alpha = 0.55
self.base_x, self.base_y = self.x, self.y   # where they last said they were
self.vx = self.vy = 0                       # and how fast they were going
self.air = False
self.since = 0                              # steps since they said so
self.heard = None                           # that word, to know a new one
self.name = ""
self.best = 0
self.height = 0

# === step
self.since += 1
t = min(self.since, PREDICT_STEPS)
guess_x = clamp(self.base_x + self.vx * t, WALL_L + HALF, WALL_R - HALF)
guess_y = self.base_y + (self.vy * t + GRAVITY * t * t / 2 if self.air else 0)
if point_distance(self.x, self.y, guess_x, guess_y) > 400:
    self.x, self.y = guess_x, guess_y     # a long way off (a reload, a long fall): no gliding there
else:
    self.x += (guess_x - self.x) * 0.4
    self.y += (guess_y - self.y) * 0.4
if self.dizzy > 0:
    self.dizzy -= 1
