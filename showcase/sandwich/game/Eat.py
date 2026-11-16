# object: Eat
# depth: 1000
# Eating it: you're the one eating. Every tap (or Space) is a bite out of the very
# sandwich you built, right to left, crunching and dropping crumbs, and you say
# what you think. The last bite puts any recipes it was in the book.

# === create
global_vars.focus = None
global_vars.drag = None
s = global_vars.s
es = stack_scale(s, 330, 1.6)
cx, base = VIEW_W / 2, 470
global_vars.eat = {"t": 0, "words": [], "result": None, "done_at": None, "scale": es, "cx": cx, "base": base,
                   "side_x": 190, "side_y": 470, "drink_x": 840, "drink_y": 440}
h = height(s) * es
w = LAYER_W * es
self.sw = make_spot(cx - w / 2, base - h - 10, w, h + 20, "eat_sandwich")
if s["side"]:
    make_spot(190 - 70, 470 - 60, 140, 110, "eat_side")
if s["drink"]:
    make_spot(840 - 55, 440 - 110, 110, 190, "eat_drink")
self.buttons = False

# === step
question_ok(False)
e = global_vars.eat
e["t"] += 1
pointer()
run_controls(self.sw)
for w in e["words"]:
    w[3] += 1
e["words"] = [w for w in e["words"] if w[3] < 70]
if e["done_at"] is not None:
    self.sw.shown = False
    if not self.buttons and e["t"] - e["done_at"] > 40:
        self.buttons = True
        global_vars.focus = make_button(VIEW_W / 2 - 230, 470, 220, 50, "Make Another", "again", None, 20)
        global_vars.focus.hot = True
        make_button(VIEW_W / 2 + 10, 470, 220, 50, "Recipe Book", "book", None, 20)

# === draw
s = global_vars.s
e = global_vars.eat
draw_sprite("kitchen", 0, 0, 0)
big_plate(e["cx"], e["base"] + 8, LAYER_W * e["scale"] * 1.4 + 40)
draw_sandwich(s, e["cx"], e["base"], e["scale"])
if s["side"] and s["side_bites"] < SIDE_BITES:
    pic(f"side_{s['side']}", e["side_x"], e["side_y"], 1.2, 1, s["side_bites"])
if s["drink"]:
    pic(f"drink_{s['drink']}", e["drink_x"], e["drink_y"], 1.25, 1 - 0.22 * s["sips"])

# === draw_gui
s = global_vars.s
e = global_vars.eat
if e["result"] is None:
    text(VIEW_W / 2, 18, "Eat it!", "#fff6d8", 40, "center")
    text(VIEW_W / 2, 70, "Tap the sandwich to take a bite.", CREAM, 18, "center")
for w, x, y, t in e["words"]:
    draw_set_alpha(min(1, (70 - t) / 20))
    text(x, y - t * 0.8, w, GOLD, 26, "center")
draw_set_alpha(1)
r = e["result"]
if r is not None and e["t"] - e["done_at"] > 20:
    # What the panel says, worked out first, so the panel is just big enough for it.
    lines = []
    if r["new"]:
        lines.append(("New in your recipe book:", CREAM, 18, 30))
        lines += [(n, "#9ff0c0", 26, 36) for n in r["new"][:4]]
    elif r["all"]:
        lines.append(("That was " + ", ".join(r["all"][:3]) + " (already in your book).", CREAM, 17, 54))
    else:
        lines.append(("No secret recipe this time. Try the hints in the book!", CREAM, 18, 54))
    lines += [(f"Unlocked: {n}!", GOLD, 20, 30) for n in r["opened"]]
    lines.append(("", INK, 10, 10))
    lines.append((f"That sandwich was {r['tall']} layers tall.", INK, 20, 30))
    lines.append((f"Your tallest: {best()} layers   ·   recipes found: {found_count()} of {len(RECIPES)}", CREAM, 16, 30))
    bottom = 116 + sum(l[3] for l in lines) + 10
    panel(VIEW_W / 2 - 300, 40, VIEW_W / 2 + 300, bottom)
    text(VIEW_W / 2, 56, "All gone!", GOLD, 40, "center")
    y = 116
    for words, colour, size, gap in lines:
        if words:
            text(VIEW_W / 2, y, words, colour, size, "center", 540)
        y += gap
