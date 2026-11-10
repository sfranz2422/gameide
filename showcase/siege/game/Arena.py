# object: Arena
# depth: 1000
# The field: snow either side of a frozen creek, and a log bridge across it in
# each lane. It runs the match's clock, and starts a new match (in
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
# The snowy field (the teacher's picture, repeated), and the frozen creek down the middle.
for x in range(0, VIEW_W, 256):
    for y in range(0, VIEW_H, 256):
        draw_sprite("snow", 0, x, y)
draw_set_color("#7fb9da")
draw_rect(MID - GAP, 0, MID + GAP, VIEW_H)
draw_set_color("#a9d8f0")
draw_rect(MID - GAP + 3, 0, MID + GAP - 3, VIEW_H)
draw_set_color("#d6f0fb")
for y in range(8, VIEW_H, 34):
    draw_line(MID - 6, y, MID + 2, y + 14, 2)      # cracks in the ice
# Pine trees and things in the snow, out of the way of the fighting.
for name, x, y, turn in FIELD_THINGS:
    draw_sprite_ext(name, 0, x, y, 1, 1, turn)
# A log bridge across the creek in each lane.
for ly in LANES:
    draw_sprite("bridge", 0, MID, ly)
# Where a tower stood and fell: its heap of snow bricks.
for side in (0, 1):
    for kind, x, y in TOWERS:
        x = mirror_x(x, side)
        if not any(abs(t.x - x) < 4 and abs(t.y - y) < 4 for t in instances("Tower")) and global_vars.match_no:
            if kind == "keep":
                draw_sprite("castle_broken", 0, x, y)
            else:
                draw_sprite_ext("tower_" + TEAM[side], 2, x, y, 1, 1)
# Where a card in hand may go, while one is being played.
card = None if global_vars.pick is None else hand(0)[global_vars.pick]
if card is not None and not global_vars.over:
    draw_set_alpha(0.12)
    draw_set_color("#ffffff")
    if CARDS[card]["kind"] == "ice":
        draw_rect(8, TOP, VIEW_W - 8, BOTTOM)
    else:
        draw_rect(8, TOP, MID - GAP, BOTTOM)
    draw_set_alpha(1)
    if TOP <= mouse_y <= BOTTOM:
        ok = can_drop(0, card, mouse_x, mouse_y) and global_vars.energy[0] >= CARDS[card]["cost"]
        draw_set_alpha(0.5)
        draw_set_color("#3ecf8e" if ok else "#ff4f4f")
        draw_circle(mouse_x, mouse_y, ICE_R if card == "ice" else 16)
        draw_set_alpha(1)
