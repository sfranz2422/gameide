# object: SnowWall
# parent: Building
# A wall of packed snow bricks: it doesn't fight, but troops stop to knock it
# down. It melts by itself after a while.

# === create
super().on_create()
self.hp = self.max_hp = WALL_HP
self.radius = WALL_R

# === step
super().on_step()
if not (self.puppet or stopped()):
    self.hp -= self.max_hp / WALL_LIFE      # an upgraded wall is stronger, and melts in the same time
    if self.hp <= 0:
        self.destroy()

# === draw
draw_sprite_ext("snow_wall", 0, self.x, self.y, 1, 1, 0, "#ffd0d0" if self.flash else "white", 0.5 + 0.5 * self.hp / self.max_hp)
draw_set_color(SIDE_COLOR[self.side])
draw_rect(self.x - 22, self.y + 15, self.x + 22, self.y + 17)
super().on_draw()
