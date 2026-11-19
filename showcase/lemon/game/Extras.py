# object: Extras
# depth: 1000
# From the morning: advertising (any day), and with the popcorn machine, popcorn and the
# snack combo. Paid for with the rest as the stand opens. (It was the Popcorn screen;
# the teacher's list of 2026-11-19 put the ads and combos here too.)

# === create
global_vars.focus = None
s = global_vars.s
y = 120
if has(s, "popcorn"):
    for k in ("pop_on", "buy_kernels", "buy_bags", "pop_price", "combo_on", "combo"):
        make_stepper(352, y, k, 316)
        y += 54
make_stepper(696, 120, "ad", 300)
self.done = make_button(VIEW_W / 2 - 150, 498, 300, 56, "Done", "done_second", size=24)
self.done.hot = True
self.first = self.done

# === step
question_ok(True)
run_controls(self.first)

# === draw
draw_sprite("place_" + place_now(global_vars.s)["key"], 0, 0, 0)

# === draw_gui
s = global_vars.s
plan = s["plan"]
draw_set_alpha(0.45)
draw_set_color("#000000")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
text(20, 14, "Extras", GOLD, 28)
text(VIEW_W - 20, 14, f"Money {money(s['money'])}", INK, 26, "right")
text(20, 52, "Advertise to bring more people; with a popcorn machine, sell popcorn and a combo deal.", DIM, 15)

panel(16, 96, 332, 470)
if has(s, "popcorn"):
    text(30, 104, "Popcorn on the shelf", GOLD, 20)
    icon("kernels", 44, 150, 0.5)
    text(68, 140, f"{s['kernels']} bags' worth of kernels", INK, 15)
    icon("popcorn", 44, 182, 0.5)
    text(68, 172, f"{s['bags']} popcorn bags", INK, 15)
    text(30, 214, "Kernels and bags keep. It pops", DIM, 13)
    text(30, 234, f"{POP_BATCH} bags at a time; what's left", DIM, 13)
    text(30, 254, "goes stale by morning.", DIM, 13)
    text(30, 290, "It's salty: people eating it", DIM, 13)
    text(30, 310, "get thirsty, and buy lemonade.", DIM, 13)
    last = next((h for h in reversed(s["history"]) if h.get("popcorn")), None)
    if last is not None:
        text(30, 350, "Last time", GOLD, 16)
        text(30, 374, f"Sold {last['pop_bags']} bags at {money(last['pop_price'])}", INK, 14)
        if last.get("combos"):
            text(30, 396, f"{last['combos']} combos at {money(last['combo_price'])}", INK, 14)
else:
    text(30, 104, "Popcorn", GOLD, 20)
    text(30, 140, "Buy a popcorn machine in the", INK, 15)
    text(30, 162, "evening to sell popcorn, and", INK, 15)
    text(30, 184, "a cup-and-a-bag combo deal.", INK, 15)

panel(340, 96, 676, 470)
if has(s, "popcorn"):
    text(352, 100, "Popcorn and the combo", GOLD, 18)
    packs = dict((x[0], x[2]) for x in POP_SUPPLIES)
    have = {k: s[k] + plan["buy"].get(k, 0) * packs[k] for k in POP_KEYS}
    text(352, 446, f"Makes {min(have['kernels'], have['bags'])} bags" + ("" if plan["popcorn"] else " (not on sale today)"), MINT, 14)
else:
    text(352, 100, "", GOLD, 18)

panel(684, 96, 1010, 470)
text(696, 100, "Advertising", GOLD, 18)
for i, (key, name, cost, more) in enumerate(ADS[1:]):
    y = 196 + i * 58
    text(706, y, name, INK if plan["ad"] != i + 1 else GOLD, 16)
    text(706, y + 22, f"{money(cost)} · about {round((more - 1) * 100)}% more people walk by", DIM, 13)
text(706, 390, "Just for today, at your own stand.", DIM, 13)
text(706, 410, "Worth it on a busy day; not on a cold", DIM, 13)
text(706, 430, "or rainy one, when few will buy.", DIM, 13)
if global_vars.problem:
    text(VIEW_W / 2, 474, global_vars.problem, RED, 15, "center")
text(VIEW_W / 2, 558, "Arrows choose · Left and Right change a number · Space presses", "#fff6d8", 13, "center")
