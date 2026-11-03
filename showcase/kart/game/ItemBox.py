# object: ItemBox
# sprite: item_box
# parent: Scenery
# Drive through one to pick up an item, if you aren't holding one. It comes back
# a few seconds later.

# === create
self.image_speed = 0
self.image_xscale = self.image_yscale = 20 / 64
self.look_low = 1
self.ready = True

# === collision Kart
if self.ready and other.done is None:
    self.ready = False
    self.alarm[0] = 240
    if other.item is None and not other.turbos:
        other.item = pick_item(other)
        other.item_wait = 40 + (RACE["steps"] + other.who * 37) % 160
        kart_sound(other, "pickup")

# === alarm 0
self.ready = True

# === draw
if self.ready:
    super().on_draw()
