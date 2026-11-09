# object: Ghost
# parent: Climber
# depth: -9
# Another player in the room, see-through. Crowd puts it where the engine says to
# draw its player (draw_x, draw_y): their position, smoothed between the words
# that come a few times a second. It doesn't stand on ledges or fall by itself:
# their game does all that, and this only follows.

# === create
super().on_create()
self.image_alpha = 0.55
self.name = ""
self.best = 0
self.height = 0

# === step
if self.dizzy > 0:
    self.dizzy -= 1
