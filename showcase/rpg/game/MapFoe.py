# object: MapFoe
# A monster out on the map. It wanders, chases you if you get close, and starts a
# fight if it touches you. What it brings to the fight is in MAP_GROUPS, by its name.

# === create
self.home_x, self.home_y = self.x, self.y
self.tag = f"{S['room']}:{self.x},{self.y}"
self.walk = 1.0
self.turn = 0
self.dx, self.dy = 0, 0
self.boss = False
if self.tag in S["cleared"]:
    self.destroy()

def touched(hero):
    start_battle(MAP_GROUPS[self.object_name], hero.x, hero.y, tag=self.tag)

self.touched = touched

# === step
self.depth = -self.y
if busy():
    return
hero = instances("Player")[0] if instance_exists("Player") else None
if hero and point_distance(self.x, self.y, hero.x, hero.y) < 110:
    a = point_direction(self.x, self.y, hero.x, hero.y)
    self.dx, self.dy = step_along(self.walk, a)
else:
    self.turn -= 1
    if self.turn <= 0:
        self.turn = 60
        self.dx, self.dy = choose([(0, 0), (0.6, 0), (-0.6, 0), (0, 0.6), (0, -0.6)])
        # Never too far from home.
        if point_distance(self.x, self.y, self.home_x, self.home_y) > 90:
            a = point_direction(self.x, self.y, self.home_x, self.home_y)
            self.dx, self.dy = step_along(0.6, a)
move_and_collide(self.dx, self.dy)
if self.dx:
    self.image_xscale = -1 if self.dx > 0 else 1
