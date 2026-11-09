# object: Hand
# depth: -100
# Your four cards, the one up next, and your energy, along the bottom. Drag a card
# onto the desk to play it, or click it and then click the desk (or press 1 to 4,
# then click).

# === step
m = global_vars
if m.over:
    m.pick, m.drag = None, False
    return
mx, my = mouse_x, mouse_y
for k in range(HAND):
    if keyboard_check_pressed(str(k + 1)):
        m.pick = None if m.pick == k else k
if mouse_check_pressed("left"):
    slot = card_at(mx, my)
    if slot is not None:
        m.pick, m.drag = slot, True
        sound_play("tick", volume=0.3)
    elif m.pick is not None and my <= BOTTOM:
        if play(m.pick, mx, my):
            m.pick = None
        else:
            sound_play("nope", volume=0.4)
if mouse_check_released("left") and m.drag:
    m.drag = False
    # Let go over the desk: played. Let go back on the cards: still picked, to click the desk after.
    if m.pick is not None and my <= BOTTOM:
        if play(m.pick, mx, my):
            m.pick = None
        else:
            sound_play("nope", volume=0.4)

# === draw_gui
m = global_vars
draw_set_color("#3b2a1a")
draw_rect(0, BOTTOM + 2, VIEW_W, VIEW_H)
# Energy: ten notches, filling.
e = m.energy[0]
for k in range(ENERGY_MAX):
    x = 150 + k * 34
    draw_set_color("#1b1208")
    draw_rect(x, BOTTOM + 6, x + 31, BOTTOM + 14)
    fill = max(0.0, min(1.0, e - k))
    if fill > 0:
        draw_set_color("#ffd23f" if fill >= 1 else "#a8892a")
        draw_rect(x, BOTTOM + 6, x + 31 * fill, BOTTOM + 14)
words(128, BOTTOM + 3, str(int(e)), 14, "#ffd23f", "right")
for k, card in enumerate(hand(0)):
    x, y = card_xy(k)
    c = CARDS[card]
    affordable = e >= c["cost"]
    lift = -6 if m.pick == k else 0
    draw_set_color("#ffd23f" if m.pick == k else "#1b1208")
    draw_rect(x - 2, y - 2 + lift, x + 74, y + 60 + lift)
    draw_set_color("#f4ecd8" if affordable else "#9a9184")
    draw_rect(x, y + lift, x + 72, y + 58 + lift)
    card_picture(card, x + 36, y + 24 + lift)
    words(x + 36, y + 40 + lift, c["name"], 9, "white", "center")
    draw_set_color("#7a4fd0")
    draw_circle(x + 8, y + 8 + lift, 9)
    words(x + 8, y + 1 + lift, str(c["cost"]), 12, "white", "center")
    words(x + 70, y + 1 + lift, str(k + 1), 9, "#5a4a3a", "right")
nx = 60
words(nx, BOTTOM + 22, "Next", 10, "#cfb98a", "center")
card_picture(up_next(0), nx, BOTTOM + 52)
