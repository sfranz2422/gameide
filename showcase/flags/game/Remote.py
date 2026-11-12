# object: Remote
# parent: Kid
# Another player in a room. In the host's game it's a real kid the referee judges:
# it walks after where that player's own game says they are (never faster than
# CATCH_UP times a kid's pace, and only once their game has caught up with the
# host's last word about them: the same `life`), and scoops when they scoop. In
# every other game it's a puppet, drawn where their game says they are.

# === create
super().on_create()
self.gone_t = 0

# === step
if not self.puppet:
    p = report_of(self)
    if p is None:
        # Away (answering a question) or gone: off the field, and a carried flag drops.
        if not self.away and self.carry is not None:
            drop_flag(self.carry, self.x, self.y)
        self.away = True
        self.mx = self.my = 0
    else:
        self.away = False
        x, y = p.get("x"), p.get("y")
        self.mx = self.my = 0
        ok = all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (x, y))
        if ok and p.get("lf") == self.life and self.stun == 0:
            pace = CARRY_PACE if self.carry is not None else PACE
            dx, dy = x - self.x, y - self.y
            d = math.hypot(dx, dy)
            if d > 0.5:
                want = min(d / pace, CATCH_UP)
                self.mx, self.my = dx / d * want, dy / d * want
        self.scooping = bool(p.get("sc"))
        if p.get("lk") in range(len(LOOKS[self.team or TEAMS[0]])):
            self.look = p.get("lk")
super().on_step()
if not self.puppet:
    p = report_of(self)
    if p is not None and p.get("f") in (-1, 1):
        self.xs = p.get("f")        # their picture as their own game draws it
    if p is not None and p.get("p") in range(len(KID_FRAMES)):
        self.image_index = p.get("p")

# === draw
p = report_of(self) if not self.puppet else None
if p is not None and p.draw_x is not None and self.stun == 0 and point_distance(p.draw_x, p.draw_y, self.x, self.y) < 120:
    # The host draws them where their own game says (smoothed), not where its copy has got to.
    draw_kid(self, p.draw_x, p.draw_y)
else:
    draw_kid(self, self.x, self.y)
