# object: Popcorn
# depth: 1000
# Popcorn, from the morning (the popcorn machine): whether it's on sale today, the
# kernels and bags to buy, and its price. Bought with the rest as the stand opens.
# It pops in batches as people ask; what's popped goes stale overnight, but kernels
# and bags keep. It's salty: people eating it get thirsty, and buy lemonade too.

# === create
global_vars.focus = None
y = 120
for k in ("pop_on", "buy_kernels", "buy_bags", "pop_price"):
    make_stepper(352, y, k, 316)
    y += 54
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
text(20, 14, "Popcorn", GOLD, 28)
text(VIEW_W - 20, 14, f"Money {money(s['money'])}", INK, 26, "right")
text(20, 52, "Popcorn sells on hot days and cool ones, and it's salty: people eating it get thirsty.", DIM, 15)

panel(16, 96, 332, 470)
text(30, 104, "On the shelf", GOLD, 20)
icon("kernels", 44, 150, 0.5)
text(68, 140, f"{s['kernels']} bags' worth of kernels", INK, 15)
icon("popcorn", 44, 182, 0.5)
text(68, 172, f"{s['bags']} popcorn bags", INK, 15)
text(30, 214, "Kernels and bags keep.", DIM, 13)
text(30, 234, f"The machine pops {POP_BATCH} bags at a time;", DIM, 13)
text(30, 254, "what's left goes stale by morning.", DIM, 13)
last = next((h for h in reversed(s["history"]) if h.get("popcorn")), None)
if last is not None:
    text(30, 336, "Last time", GOLD, 16)
    text(30, 362, f"Sold {last['pop_bags']} bags at {money(last['pop_price'])}", INK, 14)
    text(30, 384, f"{money(last['pop_income'])} from popcorn", MINT, 14)

panel(340, 96, 676, 470)
text(352, 100, "Today", GOLD, 18)
packs = dict((x[0], x[2]) for x in POP_SUPPLIES)
have = {k: s[k] + plan["buy"].get(k, 0) * packs[k] for k in POP_KEYS}
bags = min(have["kernels"], have["bags"])
text(352, 350, f"Popcorn shopping {money(sum(plan['buy'].get(k, 0) * pop_prices(s)[k] for k in POP_KEYS))}", INK, 16)
text(352, 376, f"Makes {bags} bags" + ("" if plan["popcorn"] else " (not on sale today)"), MINT, 15)
text(352, 404, "Paid with the rest as the stand opens.", DIM, 13)

panel(684, 96, 1010, 470)
text(696, 104, "Who buys it", GOLD, 20)
for i, line in enumerate(["Kids love it most.", "It doesn't need a hot day.",
                          "Eating it makes people thirsty:", "more of them stop for lemonade.",
                          "", "Too dear, and they walk on."]):
    text(706, 146 + i * 26, line, INK if line else DIM, 15)
if global_vars.problem:
    text(VIEW_W / 2, 474, global_vars.problem, RED, 15, "center")
text(VIEW_W / 2, 558, "Arrows choose · Left and Right change a number · Space presses", "#fff6d8", 13, "center")
