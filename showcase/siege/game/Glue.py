# object: Glue
# depth: 30
# A puddle of glue: the other side's troops on foot are slowed while in it (Unit
# checks). It dries up after a few seconds.

# === create
self.side = 0
self.life = GLUE_LIFE

# === step
if not global_vars.over:
    self.life -= 1
    if self.life <= 0:
        self.destroy()

# === draw
draw_set_alpha(0.55 * min(1, self.life / 60))
draw_set_color("#f2f0e6")
draw_circle(self.x, self.y, GLUE_R)
draw_set_alpha(1)
draw_set_color(SIDE_COLOR[self.side])
draw_circle(self.x, self.y, GLUE_R, True)
