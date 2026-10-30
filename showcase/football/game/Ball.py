# object: Ball
# The football. While someone carries it, it rides in his arms (the play
# script moves it there, and the room's camera follows it). In the air it flies
# over its shadow: `z` is how high above the grass it is.
#
# The ball sprite's frames: 0 to 3 spinning, 4 on the kicking tee.

# === create
self.z = 0
self.spin = 0

# === step
self.depth = -int(self.y) - 2

# === draw
car = PLAY.get("carrier")
in_air = PLAY.get("ball") in ("air", "kick")
if car is not None and car.sprite.endswith("_ball"):
    return                       # the runner's own picture has the ball tucked in
if in_air:
    self.spin += 1
    draw_set_alpha(0.4)
    draw_set_color("#000000")
    draw_ellipse(self.x - 4, self.y - 1, self.x + 4, self.y + 1)
    draw_set_alpha(1)
frame = (self.spin // 3) % 4 if in_air else 0
if PLAY.get("kick") is not None and not in_air:
    frame = 4
draw_sprite("ball", frame, self.x, self.y - self.z)
