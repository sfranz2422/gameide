# object: Map
# depth: 1000
# Choosing a day: the two restaurants, each day's best stars, upgrades. Day 1 is
# open; each next day once the one before has a star. The noodle bar opens once
# the burger shack's tenth day has one.

# === create
global_vars.focus = None
global_vars.k = None
p = progress()
self.p = p
r = global_vars.rest if restaurant_open(p, global_vars.rest) else 0
global_vars.rest = r
self.tabs = []
for i, rs in enumerate(RESTAURANTS):
    b = make_button(60 + i * 300, 64, 280, 46, rs["name"], "rest", i, 20)
    b.hot = i == r
    b.off = not restaurant_open(p, i)
    self.tabs.append(b)
self.days = []
first = None
for d in range(DAYS_EACH):
    row, col = divmod(d, 5)
    b = make_button(60 + col * 184, 150 + row * 140, 164, 110, f"Day {d + 1}", "day", d, 24)
    b.off = not day_open(p, r, d)
    b.stars = p["stars"][r][d]
    if not b.off:
        first = b
    self.days.append(b)
self.first = first
self.shop = make_button(60, 470, 260, 50, "Upgrades", "shop", None, 20)
self.back = make_button(VIEW_W - 220, 470, 160, 50, "Title", "title", None, 18)

# === step
question_ok(True)
run_controls(self.first)

# === draw
draw_sprite(f"place_{RESTAURANTS[global_vars.rest]['key']}", 0, 0, 0)
draw_set_alpha(0.55)
draw_set_color("#1a0f08")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)

# === draw_gui
p = self.p
r = global_vars.rest
text(60, 18, "Choose a day", GOLD, 28)
text(VIEW_W - 60, 22, f"{coins_words(p['coins'])}  ·  {total_stars(p)} stars", GOLD, 20, "right")
if not restaurant_open(p, 1):
    text(660, 116, "Opens when Day 10 here has a star", DIM, 13)
text(340, 486, "Spend your coins: faster cookers, more room, more patience.", DIM, 14)
