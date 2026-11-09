# object: Keep
# parent: Tower
# The lunchbox at the back. It sleeps until it's hit or one of its towers falls,
# then shoots harder and further than they do. Knock it down and the match is won
# at once (all three crowns).

# === create
super().on_create()
self.awake = False

# === step
if not self.awake:
    self.awake = self.hp < self.max_hp or len([t for t in instances("Tower") if t.side == self.side]) < 3
    super(Tower, self).on_step()
    return
super().on_step()

# === draw
c = SIDE_COLOR[self.side]
draw_set_color("#000000")
draw_set_alpha(0.25)
draw_rect(self.x - 22, self.y - 16, self.x + 26, self.y + 22)
draw_set_alpha(1)
draw_set_color("#ffffff" if self.flash else c)
draw_rect(self.x - 24, self.y - 20, self.x + 24, self.y + 18)
draw_set_color("#1b1208")
draw_rect(self.x - 24, self.y - 20, self.x + 24, self.y + 18, True)
draw_rect(self.x - 10, self.y - 26, self.x + 10, self.y - 20, True)
bar(self.x, self.y - 36, 48, self.hp / self.max_hp, c)
if not self.awake:
    words(self.x + 20, self.y - 30, "z", 12, "#3b2a1a")
