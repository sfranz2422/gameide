# object: Bin
# parent: Spot
# Tap it to throw away what's on the selected plate (a burger built wrong, say).

# === create
super().on_create()

# === draw
pic("bin", self.x + self.wide / 2, self.y + self.high / 2, 1)
draw_focus(self)
