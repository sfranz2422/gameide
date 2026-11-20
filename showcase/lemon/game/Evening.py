# object: Evening
# depth: 1000
# The day's ledger (left, the second stand's part too), what customers said and the
# money over the last month (middle), and what to spend on (right). There's no last
# evening: the summer goes on as long as you keep the stand open.

# === create
weather(None)
lighting(0)
global_vars.focus = None
s = global_vars.s
self.t = s["history"][-1]
self.buys = []
# The board: the money tonight, in whole dollars, every evening (the teacher's choice:
# sent only at the summer's end, the board stayed empty until someone played all 30
# days). The board keeps each player's best, so it ranks the most money made.
high_score(s["money"] // 100)
# Two columns: 11 upgrades and 3 places didn't fit in one.
# The stand itself first (the next one up), then the upgrades and the places, two by two.
spend = [("tier", None)] + [("upgrade", u[0]) for u in UPGRADES] + [("unlock", i) for i, p in enumerate(PLACES) if p["unlock"]]
for n, (act, arg) in enumerate(spend):
    self.buys.append(make_button(700 + (n % 2) * 152, 116 + (n // 2) * 40, 146, 36, "", act, arg, 12))
# Your staff, and the trophies.
self.staff_b = make_button(430, 10, 120, 40, "Staff", "staff", size=15)
self.trophy_b = make_button(560, 10, 130, 40, "Trophies", "trophies", size=15)
self.first = make_button(VIEW_W / 2 - 150, 498, 300, 56, "Next morning", "next", size=22)
self.first.hot = True
self.title = make_button(VIEW_W - 166, 504, 150, 44, "Title", "title", size=16)
# Tomorrow's offer (a contract), if one came: see it, take it or leave it.
self.offer = make_button(16, 504, 316, 44, "", "offer", size=15)
self.offer.shown = s.get("offer") is not None

# === step
question_ok(True)
s = global_vars.s
for b in self.buys:
    if b.act == "tier":
        nxt = next_tier(s)
        name, cost, owned = (nxt["name"], nxt["cost"], False) if nxt else (tier_now(s)["name"], 0, True)
    elif b.act == "upgrade":
        _, name, cost, _ = next(u for u in UPGRADES if u[0] == b.arg)
        owned = has(s, b.arg)
    else:
        name, cost = PLACES[b.arg]["name"], PLACES[b.arg]["unlock"]
        owned = b.arg in s["places"]
    b.words = f"{name}\n" + ("yours" if owned else money(cost))
    b.off = owned or s["money"] < cost
if s.get("offer") is not None:
    took = s.get("contract") is not None and s["contract"] == s["offer"]
    self.offer.words = "Contract taken for tomorrow ✓" if took else f"An offer! {s['offer']['who']}"
    self.offer.hot = not took
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
text(20, 14, f"Evening, day {t['day'] + 1}", GOLD, 28)
text(22, 46, rank_of(s["money"]), DIM, 14)
text(VIEW_W - 20, 14, f"Money {money(s['money'])}", INK, 26, "right")

# The ledger: money tonight is money this morning, less what was spent, plus what came in.
panel(16, 64, 360, 486)
text(28, 72, "The ledger", GOLD, 20)
sec = t.get("second")
rows = [("Money this morning", money(t["money_start"]), INK),
        ("Shopping", money(-t["supplies"]), RED),
        ("Rent", money(-t["rent"]), RED),
        (f"Sales: {t['cups']} cups at {money(t['price'])}", money(t["income"]), MINT)]
if t.get("popcorn"):
    rows.append((f"Popcorn: {t['pop_bags'] - t.get('combos', 0)} bags at {money(t['pop_price'])}", money(t["pop_income"]), MINT))
if t.get("combos"):
    rows.append((f"Combos: {t['combos']} at {money(t['combo_price'])}", money(t["combo_income"]), MINT))
if t.get("cocoa_cups"):
    rows.append((f"Cocoa: {t['cocoa_cups']} mugs at {money(t['cocoa_price'])}", money(t["cocoa_income"]), MINT))
if t.get("prizes"):
    rows.append((f"Trophies won: {len(t['trophies'])}", money(t["prizes"]), GOLD))
if t.get("ad_cost"):
    rows.append((f"Ad: {next(a[1] for a in ADS if a[0] == t['ad'])}", money(-t["ad_cost"]), RED))
c = t.get("contract")
if c:
    rows.append((f"Contract: {c['who']}" if c["done"] else "Contract fell through!", money(c["pay"]) if c["done"] else "-", MINT if c["done"] else RED))
if t.get("inspector"):
    rows.append(("Inspector: passed!" if t["inspector"] == "passed" else "Inspector's fine", money(0) if t["inspector"] == "passed" else money(-t.get("fine", INSPECTOR_FINE)),
                 MINT if t["inspector"] == "passed" else RED))
if sec:
    rows += [(f"{PLACES[sec['place']]['name']}: rent, helper", money(-sec["rent"] - sec["wage"]), RED),
             (f"  sold {sec['cups']} of {sec['sent']['cups']} at {money(sec['price'])}", money(sec["income"]), MINT)]
rows.append(("Money tonight", money(t["money_end"]), GOLD))
y = 100
# Closer together the more there are (contracts, combos, ads and the inspector add rows).
pitch = 26 if len(rows) <= 6 else 23 if len(rows) <= 8 else 20
size = 15 if len(rows) <= 8 else 13
for words, amount, colour in rows:
    text(28, y, words, INK, size)
    text(348, y, amount, colour, size, "right")
    y += pitch
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
if t.get("popcorn"):
    y += 18
    text(28, y, f"and popcorn: {left['kernels']} bags' worth of kernels, {left['bags']} bags", DIM, 13)
if sec and sec["back"]:
    b = sec["back"]
    text(28, y + 18, f"(back from the second stand: {b['lemons']}, {b['sugar']}, {b['ice']}, {b['cups']})", DIM, 12)

# What they said, and the summer's money.
panel(372, 64, 676, 486)
text(384, 72, "What they said" + (" (both stands)" if sec else ""), GOLD, 20)
for i, v in enumerate(VERDICTS):
    x, y = 392 + (i % 2) * 146, 112 + (i // 2) * 44
    n = t["said"][v] + (sec["said"][v] if sec else 0)
    draw_sprite_ext("bubbles", BUBBLE[v], x + 14, y + 12, 0.42, 0.42, 0, "white", 1)
    text(x + 34, y + 2, f"{n}  {VERDICT_WORDS[v]}", INK if n else DIM, 13)
text(384, 296, f"Money each evening, the last {MONTH} days", GOLD, 15)
cx1, cy1, cx2, cy2 = 388, 322, 662, 470
draw_set_color("#2a1d10")
draw_rect(cx1, cy1, cx2, cy2)
points = ([START_MONEY] + [h["money_end"] for h in s["history"]])[-(MONTH + 1):]
top = max(max(points), START_MONEY * 2)
bottom = min(0, min(points))
draw_set_color(PANEL_EDGE)
for i in range(1, len(points)):
    x0 = cx1 + (i - 1) / MONTH * (cx2 - cx1)
    x1 = cx1 + i / MONTH * (cx2 - cx1)
    y0 = cy2 - (points[i - 1] - bottom) / (top - bottom) * (cy2 - cy1)
    y1 = cy2 - (points[i] - bottom) / (top - bottom) * (cy2 - cy1)
    draw_line(x0, y0, x1, y1, 2)
text(cx1 + 4, cy1 + 2, money(top), DIM, 11)

# What to spend on.
panel(688, 64, 1010, 486)
text(700, 72, "Spend on", GOLD, 20)
text(700, 98, "Upgrades and new places are yours for good.", DIM, 12)
# What the one pointed at (or chosen by the keys) does.
for b in self.buys:
    if (keyed() and global_vars.focus is b) or (not keyed() and inside(b, mouse_x, mouse_y)):
        if b.act == "tier":
            nxt = next_tier(s)
            words = (f"A better stand: more people notice it, {nxt['queue'] - tier_now(s)['queue']} more in the queue" if nxt
                     else "The best stand there is!")
        elif b.act == "upgrade":
            words = next(u[3] for u in UPGRADES if u[0] == b.arg)
        else:
            p = PLACES[b.arg]
            words = f"Crowds of about {p['crowd']} on a good day; rent {money(p['rent'])}"
        text(849, 462, words, SKY, 12, "center")
# A trophy won tonight: said, above Next morning.
if t.get("trophies"):
    name, tier = t["trophies"][-1]
    more = f" (and {len(t['trophies']) - 1} more)" if len(t["trophies"]) > 1 else ""
    text(VIEW_W / 2, 470, f"Trophy won: {name}, {['bronze', 'silver', 'gold'][tier]}!{more}", GOLD, 15, "center")
