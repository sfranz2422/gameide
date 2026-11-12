# object: Shop
# depth: 1000
# Upgrades for the restaurant chosen on the map, bought with coins from any day.

# === create
global_vars.focus = None
p = progress()
self.p = p
r = global_vars.rest
self.rows = []
for j, (key, name, cost, what) in enumerate(RESTAURANTS[r]["upgrades"]):
    owned = key in p["ups"][r]
    b = make_button(VIEW_W - 260, 92 + j * 58, 200, 46, "Owned" if owned else f"Buy: {cost}", "buy", key, 18)
    b.off = owned or p["coins"] < cost
    self.rows.append((b, name, what))
self.back = make_button(60, 510, 200, 48, "Back", "map", None, 20)
self.back.hot = True
self.first = next((b for b, _, _ in self.rows if not b.off), self.back)

# === step
question_ok(True)
run_controls(self.first)

# === draw
draw_sprite(f"place_{RESTAURANTS[global_vars.rest]['key']}", 0, 0, 0)
draw_set_alpha(0.6)
draw_set_color("#1a0f08")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)

# === draw_gui
r = global_vars.rest
text(60, 24, f"Upgrades: {RESTAURANTS[r]['name']}", GOLD, 28)
text(VIEW_W - 60, 30, coins_words(self.p["coins"]), GOLD, 20, "right")
for b, name, what in self.rows:
    panel(60, b.y, VIEW_W - 280, b.y + b.high, 0.8)
    text(76, b.y + 4, name, INK, 18)
    text(76, b.y + 26, what, DIM, 13)
