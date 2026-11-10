# object: Arena
# depth: 1000
# The desk: two school desks pushed together, the gap between them, and a ruler
# across it in each lane. It runs the match's clock, and starts a new match (in
# the game that runs the battle: alone, or the room's host).

# === create
global_vars.pick = None          # the card in hand being played (Hand)
global_vars.drag = False
touch_controls(False)
if runs_battle():
    new_match()
else:
    # The other player's game: no battle of its own; Link fills these in from the host's.
    m = global_vars
    m.energy, m.decks, m.crowns = [0.0, 0.0], [DECK[:], DECK[:]], [0, 0]
    m.clock, m.overtime, m.over, m.halt, m.winner = MATCH_STEPS, False, False, False, None
    m.again, m.match_no = [False, False], 0

# === step
if runs_battle():
    tick_clock()
# Python questions wait for the end of a match: never in the middle of a battle.
question_ok(global_vars.over)

# === draw
# Two desks of wood (the teacher's picture, repeated), and the gap between them.
for x in range(0, VIEW_W, 256):
    for y in range(0, VIEW_H, 256):
        draw_sprite("wood", 0, x, y)
draw_set_alpha(0.08)
draw_set_color("#000000")
draw_rect(MID + GAP, 0, VIEW_W, VIEW_H)          # the right-hand desk a shade darker, so they read as two
draw_set_alpha(1)
draw_set_color("#2a1d12")
draw_rect(MID - GAP, 0, MID + GAP, VIEW_H)
draw_set_color("#140d07")
draw_rect(MID - 3, 0, MID + 3, VIEW_H)
# Things on the desks, out of the way of the fighting.
for name, x, y, turn in DESK_THINGS:
    draw_sprite_ext(name, 0, x, y, 1, 1, turn)
# Across the gap in each lane: rulers laid side by side.
for ly in LANES:
    for k in (-1, 0, 1):
        draw_sprite("ruler", 0, MID, ly + k * (BRIDGE * 2 / 3))
# Where a tower stood and fell: its heap.
for side in (0, 1):
    for kind, x, y in TOWERS:
        x = mirror_x(x, side)
        if not any(abs(t.x - x) < 4 and abs(t.y - y) < 4 for t in instances("Tower")) and global_vars.match_no:
            if kind == "keep":
                draw_sprite("box_broken", 0, x, y)
            else:
                draw_sprite_ext("cup_" + TEAM[side], 2, x, y, 1, 1)
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
