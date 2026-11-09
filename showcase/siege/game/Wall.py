# object: Wall
# parent: Building
# A wall of toy blocks: it doesn't fight, but troops stop to knock it down. It
# crumbles by itself after a while.

# === create
super().on_create()
self.hp = self.max_hp = WALL_HP
self.radius = 14

# === step
super().on_step()
if not global_vars.over:
    self.hp -= WALL_HP / WALL_LIFE
    if self.hp <= 0:
        self.destroy()

# === draw
for k, col in enumerate(("#ff6b5a", "#ffd23f", "#3ecf8e", "#4fa3ff")):
    x = self.x - 14 + (k % 2) * 14
    y = self.y - 12 + (k // 2) * 12
    draw_set_color("#ffffff" if self.flash else col)
    draw_rect(x, y, x + 13, y + 11)
    draw_set_color("#1b1208")
    draw_rect(x, y, x + 13, y + 11, True)
draw_set_color(SIDE_COLOR[self.side])
draw_rect(self.x - 14, self.y + 12, self.x + 14, self.y + 14)
super().on_draw()
