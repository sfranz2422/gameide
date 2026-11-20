# object: Trophies
# depth: 1000
# The goals and their trophies, from the evening: bronze, silver and gold for each,
# won as it's reached (in the evening), for a prize.

# === create
global_vars.focus = None
self.done = make_button(VIEW_W / 2 - 150, 504, 300, 52, "Back", "back_evening", size=22)
self.done.hot = True
self.first = self.done

# === step
question_ok(True)
run_controls(self.first)

# === draw
draw_sprite("place_" + place_now(global_vars.s)["key"], 0, 0, 0)

# === draw_gui
s = global_vars.s
draw_set_alpha(0.55)
draw_set_color("#120a20")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
text(20, 14, "Trophies", GOLD, 28)
won = sum(trophies_won(s, g[0]) for g in GOALS)
text(VIEW_W - 20, 18, f"{won} of {len(GOALS) * 3} won", INK, 20, "right")
text(20, 54, f"Each brings a prize: {money(TROPHY_PRIZE[0])} bronze, {money(TROPHY_PRIZE[1])} silver, {money(TROPHY_PRIZE[2])} gold.", DIM, 14)
for i, (key, name, about, goals, unit) in enumerate(GOALS):
    x, y = 20 + (i % 2) * 498, 86 + (i // 2) * 82
    panel(x, y, x + 488, y + 74)
    have = trophies_won(s, key)
    for k, medal in enumerate(("trophy_bronze", "trophy_silver", "trophy_gold")):
        icon(medal, x + 34 + k * 40, y + 37, 0.55 if k < have else 0.4)
        if k >= have:
            draw_set_alpha(0.6)
            draw_set_color("#120a20")
            draw_circle(x + 34 + k * 40, y + 37, 16)
            draw_set_alpha(1)
    text(x + 150, y + 8, name, GOLD if have else INK, 17)
    text(x + 150, y + 32, about, DIM, 13)
    v = goal_value(s, key)
    nxt = goals[have] if have < 3 else None
    text(x + 476, y + 46, f"{goal_words(key, v)} of {goal_words(key, nxt)}" if nxt is not None else "All three!", MINT if nxt is None else INK, 13, "right")
