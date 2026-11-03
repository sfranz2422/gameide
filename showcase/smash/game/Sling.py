# object: Sling
# sprite: sling
# depth: 5
# Press anywhere and pull back: how far you pull from where you pressed is how
# hard it throws, and the opposite way. The dots show the start of the flight.

# === create
global_vars.sling = self
self.pulling = False
self.from_x, self.from_y = 0, 0
self.pull_x, self.pull_y = 0, 0

# === mouse global pressed left
if global_vars.mode == "aim" and global_vars.shot and not collision_point(mouse_x, mouse_y, "Button"):
    self.pulling = True
    self.from_x, self.from_y = mouse_x, mouse_y

# === step
shot = global_vars.shot
if not self.pulling or shot is None:
    return
self.pull_x, self.pull_y = pull_of(mouse_x - self.from_x, mouse_y - self.from_y)
shot.x, shot.y = shot_start(self.pull_x, self.pull_y)

# === mouse global released left
if not self.pulling:
    return
self.pulling = False
shot = global_vars.shot
if math.hypot(self.pull_x, self.pull_y) < MIN_PULL:
    shot.x, shot.y = SLING_X, SLING_Y
else:
    launch(shot, -self.pull_x * POWER, -self.pull_y * POWER)
    shot_fired(global_vars.director)

# === draw
shot = global_vars.shot
ax, ay = shot.x if shot else SLING_X, shot.y if shot else SLING_Y
draw_set_color("#5a3a22")
draw_line(self.x - 14, self.y - 34, ax, ay, 4)
draw_self()
draw_set_color("#5a3a22")
draw_line(self.x + 14, self.y - 34, ax, ay, 4)
if self.pulling and shot is not None:
    path = flight_path(shot.x, shot.y, -self.pull_x * POWER, -self.pull_y * POWER)
    # Red with a dark edge: white was lost against the pale sky.
    for k, (px, py) in enumerate(path):
        if k % 4 == 3:
            size = 4.5 - k / 16
            draw_set_color(SHADOW)
            draw_circle(px, py, size + 1.5)
            draw_set_color("#ff2d2d")
            draw_circle(px, py, size)
