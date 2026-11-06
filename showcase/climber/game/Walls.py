# object: Walls
# depth: 500
# The cliffs at either end of the mountain, and a mark at the left of the screen
# every 25 metres, wherever you are.

# === draw
h = SIZES["wall_left"][1]
w = SIZES["wall_right"][0]
y = int(view_y // h) * h
while y < view_y + VIEW_H:
    if view_x < w:
        draw_sprite("wall_left", 0, 0, y)
    if view_x + VIEW_W > ROOM_W - w:
        draw_sprite("wall_right", 0, ROOM_W - w, y)
    y += h
top = metres_at(view_y)
for m in range(top - top % 25, top - VIEW_H // METER - 25, -25):
    if m <= 0:
        continue
    my = GROUND_Y - m * METER
    draw_set_color("#e8f6ff")
    draw_line(view_x, my, view_x + 14, my, 3)
    words(view_x + 6, my - 22, f"{m} m", 13)
