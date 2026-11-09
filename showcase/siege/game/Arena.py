# object: Arena
# depth: 1000
# The desk: two school desks pushed together, the gap between them, and a ruler
# across it in each lane. It runs the match's clock, and starts a new match.

# === create
new_match()
global_vars.pick = None          # the card in hand being played (Hand)
global_vars.drag = False
touch_controls(False)

# === step
tick_clock()
# Python questions wait for the end of a match: never in the middle of a battle.
question_ok(global_vars.over)

# === draw
# Two desks of wood, a little different, and the gap between them.
for side, col, line in ((0, "#c8955a", "#b9844b"), (1, "#c18c52", "#b07c45")):
    x0, x1 = (0, MID - GAP) if side == 0 else (MID + GAP, VIEW_W)
    draw_set_color(col)
    draw_rect(x0, 0, x1, VIEW_H)
    draw_set_color(line)
    for y in range(12, VIEW_H, 26):
        draw_line(x0, y, x1, y + 3, 1)
draw_set_color("#3b2a1a")
draw_rect(MID - GAP, 0, MID + GAP, VIEW_H)
# A ruler across the gap in each lane.
for ly in LANES:
    draw_set_color("#f2e3a0")
    draw_rect(MID - GAP - 14, ly - BRIDGE, MID + GAP + 14, ly + BRIDGE)
    draw_set_color("#7a6a3a")
    draw_rect(MID - GAP - 14, ly - BRIDGE, MID + GAP + 14, ly + BRIDGE, True)
    for k in range(-GAP - 10, GAP + 14, 6):
        draw_line(MID + k, ly - BRIDGE, MID + k, ly - BRIDGE + (8 if k % 12 == 0 else 4), 1)
# Where a card in hand may go, while one is being played.
card = None if global_vars.pick is None else hand(0)[global_vars.pick]
if card is not None and not global_vars.over:
    draw_set_alpha(0.12)
    draw_set_color("#ffffff")
    if CARDS[card]["kind"] == "glue":
        draw_rect(8, TOP, VIEW_W - 8, BOTTOM)
    else:
        draw_rect(8, TOP, MID - GAP, BOTTOM)
    draw_set_alpha(1)
    if TOP <= mouse_y <= BOTTOM:
        ok = can_drop(0, card, mouse_x, mouse_y) and global_vars.energy[0] >= CARDS[card]["cost"]
        draw_set_alpha(0.5)
        draw_set_color("#3ecf8e" if ok else "#ff4f4f")
        draw_circle(mouse_x, mouse_y, GLUE_R if card == "glue" else 16)
        draw_set_alpha(1)
