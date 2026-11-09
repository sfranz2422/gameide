# object: Hud
# depth: -200
# The clock and the crowns along the top, and at the end of a match, who won and
# Play again.

# === step
m = global_vars
if m.over and (keyboard_check_pressed("space") or keyboard_check_pressed("enter")
               or mouse_check_pressed("left") and 250 <= mouse_x <= 390 and 210 <= mouse_y <= 244):
    new_match()

# === draw_gui
m = global_vars
secs = max(0, m.clock) // 60
words(VIEW_W / 2, 2, f"{secs // 60}:{secs % 60:02d}", 16, "#ff9f43" if m.overtime else "white", "center")
if m.overtime:
    words(VIEW_W / 2, 20, "Overtime: double energy!", 10, "#ff9f43", "center")
# Crowns won, three to win outright: drawn (the font has no crown in it).
for side in (0, 1):
    for k in range(3):
        x = 20 + k * 24 if side == 0 else VIEW_W - 20 - k * 24
        crown(x, 12, k < m.crowns[side], SIDE_COLOR[side])
if m.over:
    draw_set_alpha(0.75)
    draw_set_color("#1b1208")
    draw_rect(150, 110, 490, 256)
    draw_set_alpha(1)
    text = "You win!" if m.winner == 0 else "You lose" if m.winner == 1 else "A draw"
    words(VIEW_W / 2, 122, text, 32, "#ffd23f" if m.winner == 0 else "white", "center")
    words(VIEW_W / 2, 168, f"Crowns {m.crowns[0]} to {m.crowns[1]}", 16, "white", "center")
    draw_set_color("#3ecf8e")
    draw_rect(250, 210, 390, 244)
    words(VIEW_W / 2, 217, "Play again", 16, "white", "center")
