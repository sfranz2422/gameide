# object: Hud
# depth: -200
# The clock and the crowns along the top, and at the end of a match, who won and
# Play again. Every match pays coins (more for a win, most against a person), and a
# win against another player is counted on the school's board.

# === create
self.counted = 0                 # the match whose end has been paid and counted
self.paid = 0                    # what it paid, to say so

# === step
m = global_vars
# A win against another player goes on the school's board: your wins, all told.
# (Not against the computer: anyone could pile those up.)
if m.over and self.counted != m.match_no:
    self.counted = m.match_no
    self.paid = match_coins(m.winner)
    save_set("coins", my_coins() + self.paid)
    if in_room() and m.winner == 0:
        wins = save_get("wins", 0) + 1
        save_set("wins", wins)
        high_score(wins)
if m.over and (keyboard_check_pressed("space") or keyboard_check_pressed("enter")
               or mouse_check_pressed("left") and 250 <= mouse_x <= 390 and 210 <= mouse_y <= 244):
    if not in_room():
        new_match()
    elif opponent() is None:
        room_goto("Title")              # they've gone: wait for someone new
    elif runs_battle():
        m.again[0] = True               # both press it, then the next match starts (Link)
    else:
        m.again[0] = True
        net_tell(net_host(), {"again": 1, "n": m.match_no})

# === draw_gui
m = global_vars
secs = max(0, m.clock) // 60
words(VIEW_W / 2, 2, f"{secs // 60}:{secs % 60:02d}", 16, "#ff9f43" if m.overtime else "white", "center")
if m.halt and not m.over:
    words(VIEW_W / 2, 150, "Your opponent is away (a question?). The match is held.", 14, "white", "center")
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
    draw_rect(150, 110, 490, 270)
    draw_set_alpha(1)
    text = "You win!" if m.winner == 0 else "You lose" if m.winner == 1 else "A draw"
    if m.winner == 0:
        for k in range(5):
            draw_sprite_ext("sparkle", 0, 170 + k * 75, 120 + 8 * math.sin(k * 2 + global_vars.clock / 12), 1, 1)
    words(VIEW_W / 2, 122, text, 32, "#ffd23f" if m.winner == 0 else "white", "center")
    words(VIEW_W / 2, 162, f"Crowns {m.crowns[0]} to {m.crowns[1]}", 16, "white", "center")
    if self.counted == m.match_no:
        coin(VIEW_W / 2 - 52, 192)
        words(VIEW_W / 2 + 6, 184, f"+{self.paid} coins ({my_coins()} in all)", 14, "#ffd23f", "center")
    draw_set_color("#3ecf8e")
    draw_rect(250, 210, 390, 244)
    gone = in_room() and opponent() is None
    waiting = in_room() and m.again[0] and not m.again[1]
    words(VIEW_W / 2, 217, "Find someone new" if gone else "Waiting for them..." if waiting else "Play again", 16, "white", "center")
    if in_room() and m.again[1] and not m.again[0] and not gone:
        words(VIEW_W / 2, 250, "They want a rematch!", 14, "#ffd23f", "center")
