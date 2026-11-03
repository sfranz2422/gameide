# object: Enemy
# How every enemy goes: along the road to the Fort, and a bar of hit points once
# it's been hurt. Its children set the numbers: to make a new enemy, add a child
# with its numbers, and name it in a wave in the levels script.

# === create
self.hp = self.hp_max = 20
self.walk = 1.5            # pixels a step
self.bounty = 5            # gold for stopping it
self.bite = 1              # lives it takes if it reaches the fort
self.flying = False
self.leg = 0               # which corner of the route it's heading for
self.slow = 0              # steps left walking at half speed
self.travelled = 0.0
self.image_speed = 0

# === step
route = global_vars.air_route if self.flying else global_vars.road_route
tx, ty = route[min(self.leg, len(route) - 1)]
pace = self.walk * (0.5 if self.slow > 0 else 1)
if self.slow > 0:
    self.slow -= 1
self.travelled += pace
if point_distance(self.x, self.y, tx, ty) <= pace:
    self.x, self.y = tx, ty
    self.leg += 1
    tx, ty = route[min(self.leg, len(route) - 1)]
self.direction = point_direction(self.x, self.y, tx, ty)
self.speed = pace
self.image_angle = self.direction

# === draw
draw_self()
if self.hp < self.hp_max:
    w = 34 * self.image_xscale
    draw_set_color(SHADOW)
    draw_rect(self.x - w / 2 - 1, self.y - 27, self.x + w / 2 + 1, self.y - 22)
    draw_set_color(MINT if self.hp > self.hp_max * 0.4 else RED)
    draw_rect(self.x - w / 2, self.y - 26, self.x - w / 2 + w * max(0, self.hp) / self.hp_max, self.y - 23)
if self.slow > 0:
    draw_set_alpha(0.35)
    draw_set_color("#9fe0ff")
    draw_circle(self.x, self.y, 16)
    draw_set_alpha(1)
