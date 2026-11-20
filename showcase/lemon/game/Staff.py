# object: Staff
# depth: 1000
# Your staff, from the evening: your helper at the stand (the Helper upgrade) and the
# one running your second stand. Training is a level at a time, paid once, for good.

# === create
global_vars.focus = None
self.trains = []
for i, who in enumerate(STAFF):
    b = make_button(VIEW_W / 2 + 30, 170 + i * 150, 280, 46, "", "train", who, 16)
    self.trains.append(b)
self.done = make_button(VIEW_W / 2 - 150, 498, 300, 56, "Back", "back_evening", size=22)
self.done.hot = True
self.first = self.done

# === step
question_ok(True)
s = global_vars.s
for b in self.trains:
    why = can_train(s, b.arg)
    lv = staff_level(s, b.arg)
    b.words = "Fully trained" if lv >= STAFF_TOP else f"Train to level {lv + 1}: {money(TRAIN_COST[lv])}"
    b.off = why is not None
    b.hot = not b.off
run_controls(self.first)

# === draw
draw_sprite("place_" + place_now(global_vars.s)["key"], 0, 0, 0)

# === draw_gui
s = global_vars.s
draw_set_alpha(0.55)
draw_set_color("#120a20")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
text(20, 14, "Your staff", GOLD, 28)
text(VIEW_W - 20, 14, f"Money {money(s['money'])}", INK, 26, "right")
for i, (who, st) in enumerate(STAFF.items()):
    y = 90 + i * 150
    panel(VIEW_W / 2 - 330, y, VIEW_W / 2 + 330, y + 140)
    if who == "helper":
        draw_sprite_ext("helper", 0, VIEW_W / 2 - 260, y + 130, 1, 1, 0, "white", 1 if has(s, who) else 0.3)
    lv = staff_level(s, who)
    text(VIEW_W / 2 - 170, y + 10, f"{st['name']}: {st['about']}", GOLD if has(s, who) else DIM, 20)
    if not has(s, who):
        text(VIEW_W / 2 - 170, y + 42, "Not hired yet: buy the " + ("Helper" if who == "helper" else "Second stand") + " in the evening.", DIM, 14)
        continue
    stars_ = "★" * lv + "☆" * (STAFF_TOP - lv)
    text(VIEW_W / 2 - 170, y + 40, f"Level {lv} {stars_}", INK, 16)
    if who == "helper":
        text(VIEW_W / 2 - 170, y + 64, f"Serves a cup in {serve_steps(s) / 60:.2f} s (at 1x)", MINT, 14)
    else:
        text(VIEW_W / 2 - 170, y + 64, f"Pours up to {second_most(s)} cups a day", MINT, 14)
text(VIEW_W / 2, 400, "Training is paid once, and they keep it.", DIM, 14, "center")
