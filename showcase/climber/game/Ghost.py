# object: Ghost
# parent: Climber
# depth: -9
# Another player in the room, see-through. It glides toward where their game last
# said they were: those updates come a few times a second, and jumping straight
# to each one would look jerky. It doesn't stand on ledges or fall: their game
# does all that, and this only follows.

# === create
super().on_create()
self.image_alpha = 0.55
self.goal_x, self.goal_y = self.x, self.y
self.name = ""
self.best = 0
self.height = 0

# === step
if point_distance(self.x, self.y, self.goal_x, self.goal_y) > 400:
    self.x, self.y = self.goal_x, self.goal_y     # a long way off (a reload, a long fall): no gliding there
else:
    self.x += (self.goal_x - self.x) * 0.3
    self.y += (self.goal_y - self.y) * 0.3
if self.dizzy > 0:
    self.dizzy -= 1
