# object: Ball
# depth: -10
# One player's ball. The ball script flies and rolls it; here it's drawn:
# its shadow on the grass, and the ball above it, bigger the higher it is.
# Gone once it's in the cup.

# === create
self.player = 0
self.z = 0
self.vx = self.vy = self.vz = 0
self.moving = self.flying = False
self.last = (0, 0)
self.club = 0
self.wind = (0, 0)

# === draw
if ROUND.get("holed") and self.player < len(ROUND["holed"]) and ROUND["holed"][self.player]:
    return
draw_set_alpha(0.35)
draw_set_color("#000000")
draw_circle(self.x + self.z * 0.3, self.y + self.z * 0.2, 3)
draw_set_alpha(1)
size = 1 + self.z / 60
draw_sprite_ext("ball", 0, self.x, self.y - self.z, size, size, 0, PLAYER_COLOURS[self.player], 1)
