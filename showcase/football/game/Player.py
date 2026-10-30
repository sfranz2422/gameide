# object: Player
# One of the fourteen on the field. The play script moves every player;
# these events only choose the picture: running, carrying the ball, in a
# stance, throwing, catching, diving, down, or celebrating.
#
# The poses sprite's frames: 0 stance, 1 ready, 2 arm back, 3 thrown,
# 4 catching, 5 diving, 6 down, 7 celebrating.

# === create
self.team, self.num = "home", 0
self.role, self.kind, self.job = "QB", "QB", "block"
self.human = None
self.vx = self.vy = self.wx = self.wy = 0
self.face = 1
self.anim = 0
self.down_t = self.dive_t = self.catch_t = self.throw_t = self.spin_t = self.shed = self.hold_t = 0
self.held_by = self.blocking = None
self.cheer = False
self.route = []
self.pace = 1
self.stumble = 0
self.image_speed = 0

# === step
moving = abs(self.vx) + abs(self.vy)
carrying = PLAY.get("carrier") is self and PLAY.get("ball") == "held"
self.sprite = self.team + "_poses"
if self.cheer:
    self.image_index = 7 if (self.anim // 12) % 2 == 0 else 1
    self.anim += 1
elif self.down_t > 0 and (self.down_t < 999 or PLAY.get("result")):
    self.image_index = 6
elif self.dive_t > 0:
    self.image_index = 5
elif self.throw_t > 0:
    self.image_index = 2 if self.throw_t > 8 else 3
elif self.catch_t > 0:
    self.image_index = 4
elif not PLAY.get("snapped"):
    self.image_index = 0 if self.kind in ("L", "DL") else 1
elif moving > 0.25:
    self.sprite = self.team + ("_ball" if carrying else "_run")
    self.anim += moving / 2
    self.image_index = int(self.anim / 4) % 6
elif carrying and self.role != "QB":
    self.sprite = self.team + "_ball"
    self.image_index = 0
else:
    self.image_index = 1
# Spinning away from a tackle: he turns round and round.
self.image_xscale = -self.face if self.spin_t > 0 and (self.spin_t // 4) % 2 else self.face
self.depth = -int(self.y)

# === draw
draw_set_alpha(0.35)
draw_set_color("#000000")
draw_ellipse(self.x - 7, self.y - 2, self.x + 7, self.y + 2)
draw_set_alpha(1)
if self.human is not None:
    draw_set_color(TEAMS[self.team]["trim"])
    draw_ellipse(self.x - 10, self.y - 4, self.x + 10, self.y + 4, True)
draw_self()
if self.human is None and PLAY["snapped"] and holding_to_throw() and MATCH["humans"].get(self.team) is not None:
    rs = receivers()[:3]
    if self in rs:
        n = str(rs.index(self) + 1)
        draw_set_color("#000000")
        draw_circle(self.x, self.y - 40, 5)
        draw_words(self.x - 2, self.y - 45, n, "#ffd54a")
