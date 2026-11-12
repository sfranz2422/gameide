# object: Shelf
# parent: Spot
# One place on the pass, where sides and drinks wait to be served. Tap one to pick it
# up, then tap the customer (or the bin); or drag it to them.

# === create
super().on_create()
self.i = 0

# === draw
k = self.kday
draw_set_alpha(0.55)
draw_set_color("#e8e0d0")
draw_rect(self.x + 4, self.y + self.high - 14, self.x + self.wide - 4, self.y + self.high - 6)
draw_set_alpha(1)
item = k["shelf"][self.i]
if item is not None and k.get("held") == self.i:
    # Picked up: waiting for a customer (or the bin) to be tapped.
    draw_set_alpha(0.4)
    draw_set_color("#ffe9a0")
    draw_rect(self.x + 2, self.y + 2, self.x + self.wide - 2, self.y + self.high - 2)
    draw_set_alpha(1)
if item is not None:
    pic(item_pic(item), self.x + self.wide / 2, self.y + self.high / 2 - 2, 0.85)
draw_focus(self)
