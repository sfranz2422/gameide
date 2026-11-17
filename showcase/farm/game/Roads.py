# object: Roads
# depth: 99000
# The roads the player has laid: Gemini's path tile on each, flat on the ground (just in
# front of the Ground, behind everything standing). Turned to run along gx where the
# road does, as the build turns the farm's dirt road. (Drawn here, not baked into the
# ground's picture: they're laid and moved as the game goes.)

# === draw
f = farm()
roads = all_roads(f)
moving = global_vars.moving
for i, r in enumerate(f["roads"]):
    gx, gy = r[0], r[1]
    along_gx = (gx - 1, gy) in roads or (gx + 1, gy) in roads
    along_gy = (gx, gy - 1) in roads or (gx, gy + 1) in roads
    x, y = tile_xy(gx, gy)
    held = moving is not None and tuple(moving) == ("roads", i)
    draw_sprite_ext("path", 0, x, y, -1 if along_gx and not along_gy else 1, 1, 0, "white", 0.35 if held else 1)
