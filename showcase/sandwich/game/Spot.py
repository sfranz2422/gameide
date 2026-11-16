# object: Spot
# depth: -50
# Something you can tap or drag: a bread to choose, the loaf to cut, a plate on the
# kitchen's shelf, or (while eating) the sandwich, the side and the drink. It holds
# the box a press must land in (x, y, wide, high), what it is (`what`) and which
# one (`key`). A press is handled by pointer() in the acts script, which waits to
# see whether it's a tap or a drag; what a tap does is tap() there.

# === create
self.wide = 100
self.high = 100
self.shown = True
self.off = False        # locked: on the shelf, but not yet found
self.what = ""
self.key = None

# === draw
cx, cy = self.x + self.wide / 2, self.y + self.high / 2
if self.what == "bread":
    pic(f"loaf_{self.key}", cx, cy - 16, 0.82)
    i = [b["key"] for b in BREADS].index(self.key)
    ribbon(cx, self.y + self.high - 22, self.wide - 40, bread_of(self.key)["name"], RIBBONS[i % len(RIBBONS)], 16)
elif self.what in ("layer", "side", "drink"):
    held = dragged() is not None and dragged()["from"] is self and dragged()["moved"]
    picked = self.what != "layer" and self.key in (global_vars.s["side"], global_vars.s["drink"])
    round_plate(cx, cy - 8, 44, picked)
    if self.off:
        draw_set_color("#c9bfae")
        text(cx, cy - 30, "?", "#b8ab98", 36, "center")
        text(cx, self.y + self.high - 16, f"Find {LAYERS[self.key]['unlock']}", DIM, 12, "center")
    elif not held:
        if self.what == "layer" and LAYERS[self.key]["kind"] == "sauce":
            pic(f"bottle_{self.key}", cx, cy - 10, 0.5)
        elif self.what == "layer":
            pic(f"food_{self.key}", cx, cy - 8)
        elif self.what == "side":
            pic(f"side_{self.key}", cx, cy - 8, 0.62)
        else:
            pic(f"drink_{self.key}", cx, cy - 10, 0.46)
    if not self.off:
        name = LAYERS[self.key]["name"] if self.what == "layer" else (SIDES if self.what == "side" else DRINKS)[self.key]
        text(cx, self.y + self.high - 16, name, INK, 12, "center")
draw_focus(self)
