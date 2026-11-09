# object: Archer
# parent: Unit
# A rubber-band archer: shoots from afar, and can hit paper planes.

# === create
super().on_create()
setup_unit(self, "Archer")

# === draw
draw_set_color("#ffffff" if self.flash else SIDE_COLOR[self.side])
draw_circle(self.x, self.y, self.radius)
draw_set_color("#c9874a")
f = forward(self.side)
draw_line(self.x + 4 * f, self.y - 8, self.x + 8 * f, self.y + 6, 2)
super().on_draw()
