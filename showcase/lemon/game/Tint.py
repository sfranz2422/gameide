# object: Tint
# depth: 500
# The season's colour washed over the street's picture: in front of the place (the Day,
# depth 1000), behind the stand and the people. A white square stretched over the screen
# and tinted: a rectangle drawn in the world went under every picture (shapes and pictures
# are layered apart), and the engine's lighting in a colour this light changed nothing.

# === draw
season = SEASONS[today(global_vars.s)["season"]]
if season["tint"]:
    draw_sprite_ext("white", 0, 0, 0, VIEW_W / 4, VIEW_H / 4, 0, season["tint"], season["tint_alpha"])
