# object: Plate
# parent: Spot
# A plate (or a bowl) to build a dish on. Tap it to choose it: the next part goes
# there first. A finished dish gets a tick; the customer who ordered it takes it.

# === create
super().on_create()
self.i = 0

# === draw
k = self.kday
rs = RESTAURANTS[k["rest"]]
cx, base = self.x + self.wide / 2, self.y + self.high - 16
plate = k["plates"][self.i]
if k["sel"] == self.i:
    draw_set_alpha(0.35)
    draw_set_color("#ffe9a0")
    draw_rect(self.x + 4, self.y + 4, self.x + self.wide - 4, self.y + self.high - 4)
    draw_set_alpha(1)
if rs["dish"] == "burger":
    pic("plate", cx, base - 6, 1)
    if plate:
        draw_dish(plate["parts"], "burger", cx, base - 8, 0.95)
else:
    if plate:
        draw_dish(plate["parts"], "bowl", cx, base, 0.95)
    else:
        pic("bowl", cx, base - 26, 0.95, 0.6)
if plate_done(plate, rs["dish"]):
    text(self.x + self.wide - 12, self.y + 6, "✓", MINT, 22, "right")
draw_focus(self)
