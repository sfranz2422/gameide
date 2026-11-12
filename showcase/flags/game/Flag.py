# object: Flag
# depth: -1500
# A team's flag: on its stand ("home"), carried by an enemy ("carried"), or lying
# where its carrier fell ("dropped"). The referee (the match script) moves it
# between those; here it only follows its carrier and is drawn.

# === create
self.team = "red"
self.state = "home"
self.carrier = None
self.drop_t = 0
self.t = 0

# === step
self.t += 1
if self.state == "carried" and self.carrier is not None:
    self.x, self.y = self.carrier.x, self.carrier.y - 1
    self.depth = self.carrier.depth - 1
else:
    self.depth = -self.y
# A carried flag glows a little: it can be followed through the woods.
if self.state == "carried":
    light(self.x, self.y - 30, 70, TEAM_COLOURS[self.team], 0.7)

# === draw
name = "flag_" + self.team
if self.state == "dropped":
    draw_sprite(name + "_down", 0, self.x, self.y)
elif self.state == "carried":
    # Over the carrier's shoulder, behind them as they go.
    draw_sprite(name + "_held", 0, self.x - 12 * self.carrier.facing, self.y - 14)
else:
    draw_sprite(name, 0, self.x, self.y + math.sin(self.t / 20))
