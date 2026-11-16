# object: Spot
# depth: -50
# Something you can tap or drag: a thing in the collection (what "card") or one
# on the bench (what "piece"). It holds the box a press must land in (x, y, wide,
# high) and which thing it is (key). Presses are handled by pointer() in the acts
# script, which waits to see whether a press is a tap or a drag.

# === create
self.wide = ICON
self.high = ICON
self.shown = True
self.off = False
self.what = ""
self.key = None
self.born = 0
self.pop = 0            # just made: it grows in
self.shake = 0          # mixed with something that made nothing: it shakes

# === step
if self.pop > 0:
    self.pop -= 1
if self.shake > 0:
    self.shake -= 1

# === draw
if self.what == "card":
    hinted = getattr(global_vars, "hinted", None)
    tile(self.key, self.x, self.y, CELL, hinted is not None and hinted[0] == self.key)
else:
    cx = self.x + ICON / 2 + math.sin(self.shake * 1.3) * self.shake * 0.4
    cy = self.y + ICON / 2
    if picked() is self:
        draw_set_alpha(0.45)
        draw_set_color(GOLD)
        draw_circle(cx, cy, ICON * 0.62)
        draw_set_alpha(1)
    size = 1 + 0.5 * math.sin(math.pi * self.pop / 20) if self.pop else 1
    draw_set_alpha(0.22)
    draw_set_color("#000000")
    draw_ellipse(cx - ICON * 0.36, cy + ICON * 0.34, cx + ICON * 0.36, cy + ICON * 0.5)
    draw_set_alpha(1)
    icon(self.key, cx, cy, size)
    text(cx, self.y + ICON + 1, name_of(self.key), INK, 12, "center")
draw_focus(self)
