# object: Campfire
# parent: Building
# A campfire: your troops near it are warmed (healed), the other side's snow things
# near it melt, and it burns out after a while. Troops stop to put it out, like a wall.

# === create
super().on_create()
self.hp, self.life, self.reach = CAMPFIRE
self.max_hp = self.hp
self.radius = 14
self.melting = 0            # steps since it last melted something (it blazes up)

# === step
super().on_step()
if self.puppet or stopped():
    return
self.hp -= self.max_hp / self.life
if self.hp <= 0:
    self.destroy()
    return
self.melting = max(0, self.melting - 1)
for u in instances("Unit"):
    if point_distance(self.x, self.y, u.x, u.y) <= self.reach + u.radius:
        if u.side == self.side:
            u.hp = min(u.max_hp, u.hp + CAMPFIRE_HEAL * self.power)
        elif type(u).__name__ in SNOWY:
            hurt(u, CAMPFIRE_MELT * self.power)
            self.melting = 10

# === draw
draw_set_alpha(0.15)
draw_set_color("#ffb060")
draw_circle(self.x, self.y, self.reach)
draw_set_alpha(1)
# Blazing up now and then, and whenever it's melting something of theirs.
blaze = self.melting > 0 or (global_vars.clock // 20 + self.uid) % 6 == 0
draw_sprite_ext("campfire_blaze" if blaze else "campfire_" + TEAM[self.side], 0, self.x, self.y, 1, 1, 0,
                "#ffd0d0" if self.flash else "white")
super().on_draw()
