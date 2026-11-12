# object: Evening
# depth: 1000
# The day's ledger (left), what customers said and money over the summer
# (middle), and what to spend on (right). On the last evening, the summer's end.

# === create
weather(None)
lighting(0)
global_vars.focus = None
s = global_vars.s
self.t = s["history"][-1]
self.buys = []
if s["finished"]:
    # The board: the money at the end of the summer, in whole dollars.
    high_score(s["money"] // 100)
    self.first = make_button(VIEW_W / 2 - 150, 498, 300, 56, "Back to the title", "title", size=22)
    self.first.hot = True
else:
    y = 132
    for key, name, cost, _ in UPGRADES:
        self.buys.append(make_button(700, y, 300, 34, "", "upgrade", key, 15))
        y += 40
    for i, place in enumerate(PLACES):
        if place["unlock"]:
            self.buys.append(make_button(700, y, 300, 34, "", "unlock", i, 15))
            y += 40
    self.first = make_button(VIEW_W / 2 - 150, 498, 300, 56, "Next morning", "next", size=22)
    self.first.hot = True

# === step
question_ok(True)
s = global_vars.s
for b in self.buys:
    if b.act == "upgrade":
        _, name, cost, _ = next(u for u in UPGRADES if u[0] == b.arg)
        owned = has(s, b.arg)
    else:
        name, cost = f"Sell at {PLACES[b.arg]['name']}", PLACES[b.arg]["unlock"]
        owned = b.arg in s["places"]
    b.words = f"{name}: yours" if owned else f"{name}  {money(cost)}"
    b.off = owned or s["money"] < cost
run_controls(self.first)

# === draw
draw_sprite("place_" + PLACES[self.t["place"]]["key"], 0, 0, 0)

# === draw_gui
s = global_vars.s
t = self.t
draw_set_alpha(0.55)
draw_set_color("#120a20")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
text(20, 14, f"Evening, day {t['day'] + 1} of {DAYS}", GOLD, 28)
text(VIEW_W - 20, 14, f"Money {money(s['money'])}", INK, 26, "right")

# The ledger: money tonight is money this morning, less what was spent, plus what came in.
panel(16, 64, 360, 486)
text(28, 72, "The ledger", GOLD, 20)
rows = [("Money this morning", money(t["money_start"]), INK),
        ("Shopping", money(-t["supplies"]), RED),
        ("Rent", money(-t["rent"]), RED),
        (f"Sales: {t['cups']} cups at {money(t['price'])}", money(t["income"]), MINT),
        ("Money tonight", money(t["money_end"]), GOLD)]
y = 104
for words, amount, colour in rows:
    text(28, y, words, INK, 15)
    text(348, y, amount, colour, 15, "right")
    y += 26
draw_set_color(PANEL_EDGE)
draw_line(28, y - 4, 348, y - 4)
text(28, y + 2, "Profit today", INK, 18)
text(348, y + 2, money(t["profit"]), MINT if t["profit"] >= 0 else RED, 18, "right")
y += 40
text(28, y, f"{t['passers']} people walked by.", DIM, 14)
text(28, y + 20, f"{t['temp']}°F and {sky_words(t).lower()} at {PLACES[t['place']]['name']}.", DIM, 14)
text(28, y + 46, "Reputation", INK, 15)
draw_stars(140, y + 56, t["rep_end"])
change = t["rep_end"] - t["rep_start"]
text(348, y + 46, ("up" if change >= 0 else "down") + f" {abs(change) * 100:.0f}", MINT if change >= 0 else RED, 14, "right")
y += 76
if t["soft"] or t["melted"]:
    text(28, y, f"Wasted: {t['soft']} soft lemons, {t['melted']} melted cubes", "#ffb36b", 13)
    y += 20
left = t["left"]
text(28, y, f"Left: {left['lemons']} lemons, {left['sugar']} scoops, {left['ice']} ice, {left['cups']} cups", DIM, 13)

# What they said, and the summer's money.
panel(372, 64, 676, 486)
text(384, 72, "What they said", GOLD, 20)
for i, v in enumerate(VERDICTS):
    x, y = 392 + (i % 2) * 146, 112 + (i // 2) * 44
    draw_sprite_ext("bubbles", BUBBLE[v], x + 14, y + 12, 0.42, 0.42, 0, "white", 1)
    text(x + 34, y + 2, f"{t['said'][v]}  {VERDICT_WORDS[v]}", INK if t["said"][v] else DIM, 13)
text(384, 296, "Money each evening", GOLD, 16)
cx1, cy1, cx2, cy2 = 388, 322, 662, 470
draw_set_color("#2a1d10")
draw_rect(cx1, cy1, cx2, cy2)
points = [START_MONEY] + [h["money_end"] for h in s["history"]]
top = max(max(points), START_MONEY * 2)
bottom = min(0, min(points))
draw_set_color(PANEL_EDGE)
for i in range(1, len(points)):
    x0 = cx1 + (i - 1) / DAYS * (cx2 - cx1)
    x1 = cx1 + i / DAYS * (cx2 - cx1)
    y0 = cy2 - (points[i - 1] - bottom) / (top - bottom) * (cy2 - cy1)
    y1 = cy2 - (points[i] - bottom) / (top - bottom) * (cy2 - cy1)
    draw_line(x0, y0, x1, y1, 2)
text(cx1 + 4, cy1 + 2, money(top), DIM, 11)

# What to spend on, or the summer's end.
panel(688, 64, 1010, 486)
if s["finished"]:
    best = best_day(s)
    text(849, 80, "The end of summer!", GOLD, 24, "center")
    text(849, 128, money(s["money"]), INK, 40, "center")
    text(849, 186, rank_of(s["money"]), MINT, 24, "center")
    text(849, 236, f"Best day: day {best['day'] + 1}, {money(best['profit'])} profit", INK, 15, "center")
    text(849, 262, f"Cups sold: {sum(h['cups'] for h in s['history'])}", INK, 15, "center")
    text(849, 288, f"Started with {money(START_MONEY)}", DIM, 14, "center")
else:
    text(700, 72, "Spend on", GOLD, 20)
    text(700, 98, "Upgrades and new places last all summer.", DIM, 12)
    # What the one pointed at (or chosen by the keys) does.
    for b in self.buys:
        if (keyed() and global_vars.focus is b) or (not keyed() and inside(b, mouse_x, mouse_y)):
            if b.act == "upgrade":
                words = next(u[3] for u in UPGRADES if u[0] == b.arg)
            else:
                p = PLACES[b.arg]
                words = f"Crowds of about {p['crowd']} on a good day; rent {money(p['rent'])}"
            text(849, 456, words, SKY, 12, "center")
