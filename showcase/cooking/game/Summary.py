# object: Summary
# depth: 1000
# The end of a day: who was served and who wasn't, the tips, what was wasted, the
# coins against the star goals; then the next day, this one again, or the map.

# === create
global_vars.focus = None
k = global_vars.k
self.k = k
p = progress()
nxt = k["day"] + 1
self.next = make_button(VIEW_W / 2 + 130, 480, 220, 54, "Next day", "next_day", None, 22)
self.next.hot = True
self.next.off = nxt >= DAYS_EACH or not day_open(p, k["rest"], nxt)
self.again = make_button(VIEW_W / 2 - 110, 480, 220, 54, "Try again", "retry", None, 22)
self.map = make_button(VIEW_W / 2 - 350, 480, 220, 54, "Map", "map", None, 22)
self.first = self.again if self.next.off else self.next
if k["stars"] == 3:
    sound_play("cheer", volume=0.6)

# === step
question_ok(True)
run_controls(self.first)

# === draw
draw_sprite(f"place_{RESTAURANTS[self.k['rest']]['key']}", 0, 0, 0)
draw_set_alpha(0.6)
draw_set_color("#1a0f08")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)

# === draw_gui
k = self.k
rs = RESTAURANTS[k["rest"]]
text(VIEW_W / 2, 28, f"{rs['name']}: Day {k['day'] + 1} done", GOLD, 32, "center")
stars_row(VIEW_W / 2 - 68, 120, k["stars"], 1.2)
panel(VIEW_W / 2 - 260, 170, VIEW_W / 2 + 260, 450, 0.85)
rows = [
    ("Served", str(k["served"])),
    ("Went home hungry", str(k["lost"])),
    ("Tips", coins_words(k["tips"])),
    ("Best combo", str(k["best_combo"])),
    ("Thrown away", str(k["burnt"])),
    ("Coins today", coins_words(k["coins"])),
]
for j, (a, b) in enumerate(rows):
    text(VIEW_W / 2 - 230, 186 + j * 36, a, INK, 20)
    text(VIEW_W / 2 + 230, 186 + j * 36, b, GOLD if j == 5 else INK, 20, "right")
g = star_goals(k["goal"])
text(VIEW_W / 2, 412, f"Stars at {g[0]}, {g[1]} and {g[2]} coins", DIM, 15, "center")
if self.next.off and k["day"] + 1 < DAYS_EACH:
    text(VIEW_W / 2 + 240, 540, "A star opens the next day", DIM, 13, "center")
