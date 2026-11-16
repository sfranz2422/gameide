# object: World
# depth: 500
# The little world along the top: it starts as bare ground under a grey sky, and
# fills in with what you make. Where each thing lives is WORLD in the rules: up in
# the sky, flying across it, standing or walking on the land, in or on the sea.
# Only a picture: nothing here changes what's been found.

# === create
self.t = 0

# === step
self.t += 1

# === draw
f = set(progress()["found"])
W, H = PANEL_X, WORLD_H
t = self.t
ground = H - 58
# The sky: grey until there is one; then blue, and with both day and night, the two in turn.
dark = 0.0
if "day" in f and "night" in f:
    dark = max(0.0, math.sin(t / (40 * FPS) * 2 * math.pi)) ** 0.6
elif "night" in f and "sun" not in f:
    dark = 1.0
if "sky" in f:
    top = "#1a2050" if dark > 0.5 else "#5fb4f0"
    low = "#40306a" if dark > 0.5 else "#bfe6ff"
else:
    top, low = "#4a4458", "#7a7488"
draw_rect_gradient(0, 0, W, ground, top, low)
if dark > 0.5 and "star" in f:
    for i in range(24):
        sx, sy = (i * 137) % W, (i * 53) % (ground - 30) + 6
        draw_set_alpha(0.5 + 0.5 * math.sin(t * 0.05 + i))
        draw_set_color("#ffffff")
        draw_circle(sx, sy, 1.5)
    draw_set_alpha(1)
# Weather, now and then: rain or snow falls for a while every half a minute.
spell = (t // (30 * FPS)) % 3
if (t % (30 * FPS)) < 9 * FPS:
    falling = "snow" if spell == 2 and "snow" in f else ("rain" if "rain" in f else None)
    if falling:
        draw_set_color("#cfe8ff" if falling == "rain" else "#ffffff")
        for i in range(40):
            rx = (i * 97 + t * (2 if falling == "rain" else 0.6)) % W
            ry = (i * 61 + t * (6 if falling == "rain" else 1.2)) % ground
            if falling == "rain":
                draw_line(rx, ry, rx - 2, ry + 8, 1)
            else:
                draw_circle(rx, ry, 2)
# The land, the sea, a beach, a desert.
sea = "sea" in f or "ocean" in f
draw_set_color("#5bbf4a" if "grass" in f else "#8a5a3a")
draw_rect(0, ground, W, H)
draw_set_color("#6e4428" if "grass" not in f else "#3f9a3a")
draw_rect(0, ground + 14, W, H)
if "desert" in f:
    draw_set_color("#e8c870")
    draw_rect(W * 0.52, ground, W * 0.68, ground + 14)
if sea:
    sx = W * SEA_FROM
    if "beach" in f:
        draw_set_color("#f0d890")
        draw_triangle(sx - 30, ground, sx + 10, ground, sx + 10, H)
    draw_set_color("#2f7fd0" if "ocean" in f else "#4a9be0")
    draw_rect(sx, ground + 4, W, H)
    draw_set_color("#bfe6ff")
    for i in range(8):
        wx = sx + ((i * 40 + t * 0.4) % (W - sx))
        draw_line(wx, ground + 6, wx + 14, ground + 6, 2)
elif "puddle" in f or "pond" in f or "lake" in f:
    draw_set_color("#4a9be0")
    draw_ellipse(W * 0.74, ground + 2, W * 0.74 + (60 if "lake" in f else 34), ground + 12)
# Everything that lives here.
for key, (kind, x0) in WORLD.items():
    if key not in f:
        continue
    seed = len(key) * 7 + ord(key[0])
    x = x0 * W
    if kind == "sky":
        y = 34 + (seed % 3) * 8 + math.sin(t * 0.02 + seed) * 2
        size = 0.6
    elif kind == "fly":
        x = (x0 * W + t * (0.3 + (seed % 5) * 0.12)) % (W + 80) - 40
        y = 26 + (seed % 7) * 12 + math.sin(t * 0.05 + seed) * 4
        size = 0.5
    elif kind == "ground":
        y = ground - 18
        size = 0.7
    elif kind == "walk":
        x = x0 * W + math.sin(t * 0.008 + seed) * 36
        y = ground - 12 + abs(math.sin(t * 0.08 + seed)) * -2
        size = 0.5
    elif kind == "swim":
        if not sea:
            continue
        x = x0 * W + math.sin(t * 0.01 + seed) * 22
        y = ground + 32 + math.sin(t * 0.04 + seed) * 3
        size = 0.42
    else:   # on the sea
        if not sea:
            continue
        y = ground + 8 + math.sin(t * 0.03 + seed) * 2
        size = 0.55
    icon(key, x, y, size)
# The world's frame.
draw_set_color("#2a1a3a")
draw_rect(0, H - 2, W, H + 2)
