# object: Stand
# sprite: stand
# depth: 50
# Where a team's flag stands. Bring the other team's flag here, while your own is
# on it, to score.

# === create
self.team = "red"

# === draw
draw_set_color(TEAM_COLOURS[self.team])
draw_set_alpha(0.35)
draw_circle(self.x, self.y, CAPTURE_REACH)
draw_set_alpha(1)
draw_self()
