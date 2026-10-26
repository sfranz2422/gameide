# object: Backdrop
# depth: 900
# The sky and two rows of pines behind the level. A background layer can
# scroll too, but slowly in BOTH directions, so in a tall maze the trees
# would drift up the screen. Drawing them here keeps them at the bottom of
# the screen and slides them sideways only: further rows slide slower,
# which is what makes them look far away (parallax).

# === draw
draw_sprite("bg_sky", 0, view_x, view_y)
for name, width, speed, drop in (("bg_ridge", 96, 0.06, 30), ("bg_pines_far", 416, 0.15, 44), ("bg_pines_near", 416, 0.35, 90)):
    x = view_x - (view_x * speed) % width
    while x < view_x + view_width:
        draw_sprite(name, 0, x, view_y + drop)
        x += width
