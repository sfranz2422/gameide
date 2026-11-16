# object: Awards
# depth: 1000
# Every achievement: earned ones in colour, the rest grey, each saying what earns it.

# === create
global_vars.focus = None
self.back = make_button(VIEW_W / 2 - 90, VIEW_H - 50, 180, 40, "Back to the Lab", "play", None, 16)
self.back.hot = True
make_button(12, 12, 90, 32, "Title", "title", None, 14)

# === step
question_ok(True)
run_controls(self.back)

# === draw
draw_sprite("bench", 0, 0, 0)
draw_set_alpha(0.6)
draw_set_color("#1a1030")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)

# === draw_gui
p = progress()
text(VIEW_W / 2, 14, f"Awards   ·   {len(p['awards'])} of {len(ACHIEVEMENTS)}", GOLD, 28, "center")
colours = [c for _, _, c in GROUPS]
for i, (key, name, words) in enumerate(ACHIEVEMENTS):
    c, r = i % 4, i // 4
    x, y = 30 + c * 246, 64 + r * 92
    got = key in p["awards"]
    medal(x + 26, y + 26, 20, colours[i % len(colours)], got)
    text(x + 56, y + 8, name, GOLD if got else "#9a94aa", 15)
    text(x + 56, y + 30, words, INK if got else "#8a849a", 11, "left", 180)
