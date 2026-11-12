# object: Tracks
# depth: 90
# Footprints in fresh snow, fading. Kept as a list, not an instance each (hundreds
# of instances would each cost a step); only the ones on screen are drawn.

# === create
global_vars.prints = []

# === step
now = global_vars.m_t
while global_vars.prints and now - global_vars.prints[0][3] > PRINT_LIFE:
    global_vars.prints.pop(0)

# === draw
now = global_vars.m_t
for x, y, a, t in global_vars.prints:
    if view_x - 20 < x < view_x + VIEW_W + 20 and view_y - 20 < y < view_y + VIEW_H + 20:
        draw_sprite_ext("print", 0, x, y, 1, 1, a, "white", 0.6 * (1 - (now - t) / PRINT_LIFE))
