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
if not (self.puppet or stopped()):
    self.hp -= WALL_HP / WALL_LIFE
    if self.hp <= 0:
        self.destroy()

# === draw
draw_sprite_ext("blocks", 0, self.x, self.y, 1, 1, 0, "#ffd0d0" if self.flash else "white", 0.5 + 0.5 * self.hp / self.max_hp)
draw_set_color(SIDE_COLOR[self.side])
draw_rect(self.x - 14, self.y + 9, self.x + 14, self.y + 11)
super().on_draw()
