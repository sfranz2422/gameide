# object: Hud
# depth: -95
# The bar the buttons sit on, under the field.

# === draw
draw_set_color(PANEL)
draw_rect(0, FIELD_H, VIEW_W, VIEW_H)
draw_set_color("#111827")
draw_rect(0, FIELD_H, VIEW_W, FIELD_H + 2)
