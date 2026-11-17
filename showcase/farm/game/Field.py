# object: Field
# One field: bare soil, or a crop at its stage (from when it was planted, on the
# real clock). Which field it is is `i`, in the farm's list; what's in it is the
# farm's (the field script), never kept here.

# === create
self.i = 0

# === draw
fl = farm()["fields"][self.i]
x, y = tile_xy(fl["gx"], fl["gy"])
st = stage(fl)
if st is None:
    draw_sprite("soil", 0, x, y)
else:
    draw_sprite(f"crop_{fl['crop']}_{st}", 0, x, y)
    if st == STAGES - 1:
        # Ripe: a little sparkle now and then, so it's seen across the farm.
        if (global_vars.t + self.i * 17) % 90 < 12:
            draw_set_alpha(0.7)
            draw_set_color("#fff6b0")
            draw_circle(x + 26, y - 30 - (global_vars.t + self.i * 17) % 90, 3)
            draw_set_alpha(1)
sel = global_vars.sel
if sel is not None and tuple(sel) == (fl["gx"], fl["gy"]):
    diamond(x, y, GOLD, 1, 1, True)
