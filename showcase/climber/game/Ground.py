# object: Ground
# parent: Ledge
# depth: 310
# The snow at the foot of the mountain, the whole way across: the bottom of every
# fall. Base camp's picture stands on it, in the middle.

# === create
super().on_create()
self.half = ROOM_W / 2

# === draw
w = SIZES["snow_ground"][0]
top = GROUND_Y + GROUND_TOP
x = view_x - view_x % w
while x < view_x + VIEW_W:
    draw_sprite("snow_ground", 0, x, top)
    x += w
# Below the strip, down to the bottom of the room.
draw_set_color("#3fa6ec")
draw_rect(view_x, top + SIZES["snow_ground"][1] - 1, view_x + VIEW_W, ROOM_H)
