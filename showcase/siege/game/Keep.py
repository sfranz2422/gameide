# object: Keep
# parent: Tower
# The lunchbox at the back. It sleeps until it's hit or one of its towers falls,
# then shoots harder and further than they do. Knock it down and the match is won
# at once (all three crowns).

# === create
super().on_create()
self.awake = False

# === step
if self.puppet:
    return
if not self.awake:
    self.awake = self.hp < self.max_hp or len([t for t in instances("Tower") if t.side == self.side]) < 3
    super(Tower, self).on_step()
    return
super().on_step()

# === draw
draw_sprite_ext("box_" + TEAM[self.side], 0, self.x, self.y, 1, 1, 0, "#ffd0d0" if self.flash else "white")
bar(self.x, self.y - 36, 48, self.hp / self.max_hp, SIDE_COLOR[self.side])
if not self.awake:
    words(self.x + 22, self.y - 32, "z", 12, "#3b2a1a")
