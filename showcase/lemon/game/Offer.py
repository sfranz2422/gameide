# object: Offer
# depth: 1000
# A contract offered for tomorrow (contract_offer), from the evening: what it wants and
# pays, and what it would take from your shelf at today's recipe. Take it or leave it.
# Taken, it's delivered as the stand opens; short, it falls through, and your
# reputation pays.

# === create
global_vars.focus = None
self.take = make_button(VIEW_W / 2 - 320, 430, 300, 56, "Take it", "accept", size=22)
self.take.hot = True
self.leave = make_button(VIEW_W / 2 + 20, 430, 300, 56, "No thanks", "decline", size=22)
self.first = self.take

# === step
question_ok(True)
run_controls(self.first)

# === draw
draw_sprite("place_" + place_now(global_vars.s)["key"], 0, 0, 0)

# === draw_gui
s = global_vars.s
c = s["offer"]
draw_set_alpha(0.55)
draw_set_color("#120a20")
draw_rect(0, 0, VIEW_W, VIEW_H)
draw_set_alpha(1)
panel(VIEW_W / 2 - 360, 60, VIEW_W / 2 + 360, 410)
text(VIEW_W / 2, 74, "A contract for tomorrow", GOLD, 28, "center")
if c is not None:
    text(VIEW_W / 2, 124, f"{c['who']} wants", INK, 20, "center")
    what = f"{c['cups']} cups" + (" of pink lemonade" if c["pink"] else "") + (f" and {c['bags']} bags of popcorn" if c["bags"] else "")
    text(VIEW_W / 2, 152, what, GOLD, 24, "center")
    text(VIEW_W / 2, 192, f"and will pay {money(c['pay'])}" + (f" ({money(c['each'])} a cup)" if not c["bags"] else ""), MINT, 20, "center")
    need = contract_needs(s, c)
    names = dict((x[0], x[3]) for x in SUPPLIES + POP_SUPPLIES)
    parts = [f"{need[k]} {names[k]}" for k in SUPPLY_KEYS + POP_KEYS if need.get(k)]
    text(VIEW_W / 2, 236, "At today's recipe it takes from your shelf:", DIM, 15, "center")
    text(VIEW_W / 2, 260, ", ".join(parts), INK, 15, "center")
    text(VIEW_W / 2, 300, "Buy enough in the morning: it's taken as the stand opens.", DIM, 14, "center")
    text(VIEW_W / 2, 322, "Short of anything, it falls through, and your reputation drops.", "#ffb36b", 14, "center")
    if c["pink"]:
        text(VIEW_W / 2, 350, "It must be pink lemonade: choose Pink in the morning.", "#ffb36b", 14, "center")
