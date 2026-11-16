# object: Book
# depth: 1000
# The recipe book: every secret recipe, eight to a spread. One found shows the very
# sandwich that found it and its name; one still secret shows its hint. The Python
# check's questions come here and nowhere else (the teacher's choice), so nobody
# is stopped in the middle of building or eating.

# === create
global_vars.focus = None
global_vars.drag = None
if getattr(global_vars, "page", None) is None:
    global_vars.page = 0
self.prev = make_button(30, VIEW_H - 52, 120, 40, "< Back", "page", -1, 17)
self.next = make_button(VIEW_W - 150, VIEW_H - 52, 120, 40, "Next >", "page", 1, 17)
self.close = make_button(VIEW_W / 2 - 90, VIEW_H - 52, 180, 40, "Make a Sandwich", "again", None, 17)
self.close.hot = True
self.home = make_button(12, 12, 90, 34, "Title", "title", None, 15)

# === step
question_ok(True)
self.prev.off = global_vars.page == 0
self.next.off = global_vars.page >= pages() - 1
run_controls(self.close)

# === draw
draw_sprite("book", 0, 0, 0)

# === draw_gui
b = book()
first = global_vars.page * PER_SPREAD
text(VIEW_W / 2, 14, f"Recipe Book   ·   {len(b)} of {len(RECIPES)} found", "#fff6d8", 22, "center")
for i, r in enumerate(RECIPES[first:first + PER_SPREAD]):
    side, slot = i // 4, i % 4
    # the book picture's pages: left 114-500, right 535-910 (x); 70-490 (y)
    cx = (210, 404, 640, 834)[side * 2 + slot % 2]
    y = 72 + (slot // 2) * 222
    if r["name"] in b:
        s = from_book(b[r["name"]])
        sc = stack_scale(s, 130, 0.55)
        draw_set_alpha(0.25)
        draw_set_color("#8a5a2a")
        draw_ellipse(cx - 66, y + 152, cx + 66, y + 168)
        draw_set_alpha(1)
        draw_sandwich(s, cx, y + 160, sc)
        draw_set_font("Ubuntu", 17)
        draw_set_halign("center")
        draw_set_color("#5a2a10")
        draw_text(cx, y + 172, r["name"], 176)
    else:
        draw_set_font("Ubuntu", 64)
        draw_set_halign("center")
        draw_set_color("#d8c6a4")
        draw_text(cx, y + 30, "?")
        draw_set_font("Ubuntu", 14)
        draw_set_color("#7a5a3a")
        draw_text(cx, y + 120, r["hint"], 168)
    draw_set_halign("left")
nxt = next_unlock()
if nxt is not None:
    name, more = nxt
    text(VIEW_W / 2, VIEW_H - 84, f"Find {more} more to unlock {name}.", CREAM, 15, "center")
