# object: Ground
# depth: 100000
# The land: the whole map as one picture, grass, its sandy shore and earthy edge, made by
# the build, in strips GROUND_STRIP pixels wide (no graphics card can take one picture
# the width of a 70-tile map), drawn side by side behind everything.

# === draw
for k in range(GROUND_STRIPS):
    draw_sprite(f"ground_{k}", 0, k * GROUND_STRIP, 0)
