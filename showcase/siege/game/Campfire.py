# object: Campfire
# parent: Building
# A campfire: your troops near it are warmed (healed), the other side's snow things
# near it melt, and it burns out after a while. Troops stop to put it out, like a wall.
# (Drawn by the game until the teacher's picture comes.)

# === create
super().on_create()
self.hp, self.life, self.reach = CAMPFIRE
self.max_hp = self.hp
self.radius = 14

# === step
super().on_step()
if self.puppet or stopped():
    return
self.hp -= self.max_hp / self.life
if self.hp <= 0:
    self.destroy()
    return
for u in instances("Unit"):
    if point_distance(self.x, self.y, u.x, u.y) <= self.reach + u.radius:
        if u.side == self.side:
            u.hp = min(u.max_hp, u.hp + CAMPFIRE_HEAL * self.power)
        elif type(u).__name__ in SNOWY:
            hurt(u, CAMPFIRE_MELT * self.power)

# === draw
draw_set_alpha(0.15)
draw_set_color("#ffb060")
draw_circle(self.x, self.y, self.reach)
draw_set_alpha(1)
draw_set_color("#6a4020")
draw_rect(self.x - 12, self.y + 2, self.x + 12, self.y + 7)
draw_rect(self.x - 3, self.y - 2, self.x + 3, self.y + 10)
k = math.sin(global_vars.clock / 4 + self.x) * 2
draw_set_color("#ff6a1a")
draw_triangle(self.x - 9, self.y + 2, self.x + 9, self.y + 2, self.x + k, self.y - 18)
draw_set_color("#ffd23f")
draw_triangle(self.x - 5, self.y + 2, self.x + 5, self.y + 2, self.x - k, self.y - 10)
draw_set_color(SIDE_COLOR[self.side])
draw_rect(self.x - 12, self.y + 9, self.x + 12, self.y + 11)
super().on_draw()
