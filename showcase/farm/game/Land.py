# object: Land
# depth: 98000
# The land not bought yet: each plot shaded darker, its edge outlined, flat on the ground
# (in front of the ground and the roads, behind everything standing). One quad a plot:
# a plot's tiles are a rectangle on the map, a diamond-ish shape on the screen.

# === draw
f = farm()
for i, p in enumerate(LAND):
    if not locked(f, i):
        continue
    a = tile_xy(p["gx"] - 0.5, p["gy"] - 0.5)
    b = tile_xy(p["gx"] + p["w"] - 0.5, p["gy"] - 0.5)
    c = tile_xy(p["gx"] + p["w"] - 0.5, p["gy"] + p["h"] - 0.5)
    d = tile_xy(p["gx"] - 0.5, p["gy"] + p["h"] - 0.5)
    draw_set_alpha(0.45)
    draw_set_color("#1c2a14")
    draw_triangle(a[0], a[1], b[0], b[1], c[0], c[1])
    draw_triangle(a[0], a[1], c[0], c[1], d[0], d[1])
    draw_set_alpha(0.55)
    draw_set_color("#fff4dc")
    for u, v in ((a, b), (b, c), (c, d), (d, a)):
        draw_line(u[0], u[1], v[0], v[1], 2)
draw_set_alpha(1)
