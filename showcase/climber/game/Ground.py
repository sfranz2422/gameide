# object: Ground
# parent: Ledge
# depth: 310
# The snow at the foot of the mountain, the whole way across: the bottom of every fall.

# === create
super().on_create()
self.half = ROOM_W / 2

# === draw
draw_set_color("#bfd9ec")
draw_rect(view_x, GROUND_Y, view_x + VIEW_W, ROOM_H)
draw_set_color("#eef7fc")
draw_rect(view_x, GROUND_Y - 4, view_x + VIEW_W, GROUND_Y + 14)
