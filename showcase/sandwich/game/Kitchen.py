# object: Kitchen
# depth: 1000
# Building the sandwich: the shelf of plates on the left (a tab for each kind), the
# sandwich on its plate on the counter. Tap a plate and that layer drops on; drag
# one to let go of it wherever you like; drag a sauce bottle over the top to draw
# your own squiggle. Too far off the middle and the pile slides off. Then the top
# slice, a side and a drink, and on to eating it.

# === create
global_vars.focus = None
global_vars.drag = None
global_vars.said = None
if getattr(global_vars, "tab", None) is None:
    global_vars.tab = "meat"
self.t = 0
self.tabs = []
x = SHELF_X
for key, words in TABS + [("sides", "Sides"), ("drinks", "Drinks")]:
    w = 18 + len(words) * 9
    b = make_button(x, 40, w, 34, words, "tab", key, 15)
    b.key = key
    self.tabs.append(b)
    if key == "sauce":
        x = SHELF_X     # sides and drinks take the same places once the top is on
    else:
        x += w + 6
self.top = make_button(VIEW_W - 186, 14, 172, 50, "Top it!", "top", None, 22)
self.top.hot = True
self.eat = make_button(VIEW_W - 186, 14, 172, 50, "Eat it!", "eat", None, 24)
self.eat.hot = True
self.undo = make_button(VIEW_W - 186, 74, 82, 34, "Undo", "undo", None, 15)
self.over = make_button(VIEW_W - 98, 74, 84, 34, "New", "again", None, 15)
make_shelf()

# === step
question_ok(False)
self.t += 1
s = global_vars.s
pointer()
run_controls(None)
meal = s["topped"]
for b in self.tabs:
    b.shown = (b.key in ("sides", "drinks")) == meal
    b.picked = b.key == global_vars.tab
self.top.shown = not meal
self.eat.shown = meal
self.undo.off = len(s["layers"]) <= 1 and falling() is None
if global_vars.said is not None:
    w, left = global_vars.said
    global_vars.said = (w, left - 1) if left > 1 else None

# === draw
s = global_vars.s
draw_sprite("kitchen", 0, 0, 0)
ks = kitchen_scale(s)
big_plate(PLATE_X, PLATE_Y + 6, LAYER_W * ks * 1.45 + 40)
if s["side"]:
    pic(f"side_{s['side']}", PLATE_X - 215, 482, 1)
if s["drink"]:
    pic(f"drink_{s['drink']}", PLATE_X + 235, 432, 1)
# The wobble: a pile with its weight off-centre sways, more the nearer it is to going.
d = danger(s)
sway = lean(s) * d * d * WOBBLE * (0.6 + 0.4 * math.sin(self.t * 0.13)) if len(s["layers"]) > 2 else 0
draw_sandwich(s, PLATE_X, PLATE_Y, ks, sway)
# A sauce being drawn shows as it's drawn.
g = dragged()
if g is not None and g["moved"] and g["from"].what == "layer" and LAYERS[g["from"].key]["kind"] == "sauce" and g["dots"]:
    draw_sauce({"k": g["from"].key, "dots": sorted(g["dots"])}, PLATE_X + top_dx(s) * ks, top_y(s), ks)

# === draw_gui
s = global_vars.s
ks = kitchen_scale(s)
meal = s["topped"]
text(SHELF_X, 8, "Make it a meal: a side and a drink" if meal else "Build your sandwich", "#fff6d8", 20)
n = len(fill(s))
text(PLATE_X, 548, f"{n} layer" + ("" if n == 1 else "s") + (f"   ·   tallest eaten: {best()}" if best() else ""), CREAM, 16, "center")
if global_vars.said is not None:
    w, left = global_vars.said
    text(PLATE_X, 150 - (90 - left) * 0.4, w, RED, 34, "center")
# What's being dragged, under the pointer, over everything.
g = dragged()
if g is not None and g["moved"]:
    o = g["from"]
    if o.what == "layer" and LAYERS[o.key]["kind"] == "sauce":
        pic(f"bottle_{o.key}", mouse_x + 10, mouse_y - 70, 0.7, 1, 0, 160)
    elif o.what == "layer":
        draw_layer(s, {"k": o.key, "dx": 0}, mouse_x, mouse_y, ks, 0, 0, 0.9)
    elif o.what == "side":
        pic(f"side_{o.key}", mouse_x, mouse_y, 0.9, 0.9)
    else:
        pic(f"drink_{o.key}", mouse_x, mouse_y, 0.9, 0.9)
