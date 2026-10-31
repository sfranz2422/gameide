# object: Player
# One of the fourteen on the field. The play script moves every player;
# these events only choose the picture: running, carrying the ball, in a
# stance, throwing, catching, diving, down, celebrating, or a move.
#
# Each team has four sprites, named from its id in the LEAGUE: <id>_run,
# <id>_ball (running with it), <id>_poses and <id>_moves.
# The poses sprite's frames: 0 stance, 1 ready, 2 arm back, 3 thrown,
# 4 catching, 5 diving, 6 down, 7 celebrating.
# The moves sprite's (made by build.py from those): 0 juke, 1 stiff-arm,
# 2 a diving catch.

# === create
self.team, self.num = "home", 0
self.role, self.kind, self.job = "QB", "QB", "block"
self.human = None
self.vx = self.vy = self.wx = self.wy = 0
self.face = 1
self.anim = 0
self.down_t = self.dive_t = self.catch_t = self.throw_t = self.move_t = self.shed = self.hold_t = 0
self.move = None
self.held_by = self.blocking = None
self.cheer = False
self.route = []
self.pace = 1
self.stumble = 0
self.image_speed = 0

# === step
if REPLAY["on"]:
    return                       # the Game is showing the replay: it sets the pictures
look = TEAMS[self.team]["id"]
moving = abs(self.vx) + abs(self.vy)
carrying = PLAY.get("carrier") is self and PLAY.get("ball") == "held"
self.sprite = look + "_poses"
if self.cheer:
    self.image_index = 7 if (self.anim // 12) % 2 == 0 else 1
    self.anim += 1
elif PLAY.get("diver") is self and (self.dive_t > 0 or self.down_t > 0):
    self.sprite, self.image_index = look + "_moves", 2
elif self.down_t > 0 and (self.down_t < 999 or PLAY.get("result")):
    self.image_index = 6
elif self.dive_t > 0:
    self.image_index = 5
elif self.move == "juke":
    self.sprite, self.image_index = look + "_moves", 0
elif self.move == "stiff":
    self.sprite, self.image_index = look + "_moves", 1
elif self.throw_t > 0:
    self.image_index = 2 if self.throw_t > 8 else 3
elif self.catch_t > 0:
    self.image_index = 4
elif not PLAY.get("snapped"):
    self.image_index = 0 if self.kind in ("L", "DL") else 1
elif moving > 0.25:
    self.sprite = look + ("_ball" if carrying else "_run")
    self.anim += moving / 2
    self.image_index = int(self.anim / 4) % 6
elif carrying and self.role != "QB":
    self.sprite = look + "_ball"
    self.image_index = 0
else:
    self.image_index = 1
# Spinning away from a tackle: he turns round and round.
spinning = self.move == "spin" and (self.move_t // 4) % 2
self.image_xscale = -self.face if spinning else self.face
self.depth = -int(self.y)

# === draw
draw_set_alpha(0.35)
draw_set_color("#000000")
draw_ellipse(self.x - 7, self.y - 2, self.x + 7, self.y + 2)
draw_set_alpha(1)
if self.human is not None and not REPLAY["on"]:
    draw_set_color(TEAMS[self.team]["trim"])
    draw_ellipse(self.x - 10, self.y - 4, self.x + 10, self.y + 4, True)
draw_self()
if REPLAY["on"]:
    return
if self.human is None and PLAY["snapped"] and holding_to_throw() and MATCH["humans"].get(self.team) is not None:
    rs = receivers()[:3]
    if self in rs:
        n = str(rs.index(self) + 1)
        draw_set_color("#000000")
        draw_circle(self.x, self.y - 40, 5)
        draw_words(self.x - 2, self.y - 45, n, "#ffd54a")
