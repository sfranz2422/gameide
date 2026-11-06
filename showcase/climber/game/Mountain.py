# object: Mountain
# depth: 1000
# The mountain around you. Only the part near the camera exists: ledges are made
# from the plan as they come into view and go once they're well out of it, so a
# mountain 5000 metres high costs no more than one screen. Draws the sky behind
# it all: morning at the bottom, sunset higher up, then the northern lights.

# === create
self.ledges = {}     # the plan's number for a ledge -> the ledge
self.decor = {}
global_vars.ticks = 0
global_vars.wind = 0
music_play("music", volume=0.3)
weather("snow", 0.3)
self.snow = 0.3

# === begin_step
global_vars.ticks += 1

# === step
p = plan()
p.grow(view_y - 2 * VIEW_H)
low, high = view_y + VIEW_H + 320, view_y - 240
left, right = view_x - 200, view_x + VIEW_W + 200

# Ledges in the window are made; ones outside it go.
want = set()
for e in p.ledges_between(high, low, left, right):
    want.add(e["i"])
    if e["i"] not in self.ledges:
        self.ledges[e["i"]] = make_ledge(e)
for i in list(self.ledges):
    if i not in want:
        ledge = self.ledges.pop(i)
        if instance_exists(ledge) and ledge.stood == 0:
            ledge.destroy()
        elif instance_exists(ledge):
            self.ledges[i] = ledge      # someone's on it: keep it
want = set()
for d in p.decor_between(high, low, left, right):
    want.add(d["i"])
    if d["i"] not in self.decor:
        o = instance_create(d["x"], d["y"] + 5, "Bird" if d["sprite"] == "bird" else "Decor")
        o.sprite = d["sprite"]
        self.decor[d["i"]] = o
for i in list(self.decor):
    if i not in want:
        o = self.decor.pop(i)
        if instance_exists(o):
            o.destroy()

# Wind on Windy Ridge and up: gusts, one way and then the other.
metres = metres_at(view_y + VIEW_H / 2)
if metres >= WIND_FROM:
    cycle, t = divmod(global_vars.ticks, 420)
    strength = min(1.0, 0.5 + (metres - WIND_FROM) / 300)
    side = 1 if cycle % 2 == 0 else -1
    global_vars.wind = side * strength * math.sin(math.pi * t / 140) if t < 140 else 0
    if abs(global_vars.wind) > 0.3 and global_vars.ticks % 3 == 0:
        particles(view_x + (0 if side > 0 else VIEW_W), view_y + random.random() * VIEW_H, 2, "white",
                  9 * abs(global_vars.wind), 2, 70, 0, 6, 0 if side > 0 else 180)
    if t == 1:
        sound_play("wind", volume=0.35)
else:
    global_vars.wind = 0

# More snow the higher you go.
snow = 0.3 + 1.7 * hardness(metres)
if abs(snow - self.snow) > 0.15:
    self.snow = snow
    weather("snow", snow)

# === draw
metres = metres_at(view_y + VIEW_H / 2)
dusk = clamp((metres - 150) / 150, 0, 1)
night = clamp((metres - 300) / 150, 0, 1)
for name, alpha in (("sky_day", 1), ("sky_dusk", dusk), ("sky_night", night)):
    if alpha > 0:
        k = VIEW_H / SIZES[name][1]
        draw_sprite_ext(name, 0, view_x + (VIEW_W - SIZES[name][0] * k) / 2, view_y, k, k, 0, "white", alpha)

# Clouds drift past slower than the mountain: they're further away.
far_x, far_y = view_x * 0.5, view_y * 0.6
row0, col0 = int(far_y // 260) - 1, int(far_x // 420) - 1
for n in range(row0, row0 + 4):
    for c in range(col0, col0 + 4):
        rng = random.Random(n * 7919 + c * 104729)
        if rng.random() < 0.35:
            continue
        x = view_x + c * 420 - far_x + rng.uniform(0, 240) + math.sin(global_vars.ticks / 900 + n) * 30
        y = view_y + n * 260 - far_y + rng.uniform(-50, 50)
        draw_sprite_ext(f"cloud_{(n + c) % 6}", 0, x, y, 1, 1, 0, "white", 0.85 * (1 - 0.6 * night))

# The far mountains, at the bottom only, sinking away as you climb and passing slowly by.
bottom = view_y + VIEW_H
sink = (GROUND_Y - bottom) * 0.3
w = SIZES["far_mountains"][0]
x = view_x - (view_x * 0.3) % w
while x < view_x + VIEW_W:
    draw_sprite("far_mountains", 0, x, bottom - SIZES["far_mountains"][1] + 40 + sink)
    x += w
