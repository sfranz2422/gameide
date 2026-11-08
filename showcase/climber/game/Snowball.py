# object: Snowball
# sprite: snowball
# depth: -20
# A thrown snowball: it arcs down, and bursts on anything it meets. `thrower` is
# 0 for yours, or the number of the player who threw it. Another player's
# snowball can hit you; yours burst on them (their own game decides what that
# does to them), and never on you.

# === create
self.thrower = 0
self.vx = 0
self.vy = 0
self.life = 150
self.image_speed = 0

# === step
self.image_index = 1 if abs(self.vx) > 5 else 0
self.image_xscale = 1 if self.vx >= 0 else -1
self.life -= 1
if fly(self):
    return
if self.life <= 0 or self.y > view_y + VIEW_H + 100 or abs(self.x - (view_x + VIEW_W / 2)) > VIEW_W:
    self.destroy()
