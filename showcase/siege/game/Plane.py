# object: Plane
# parent: Unit
# A paper plane: flies over the gap and everything else, and only attacks
# buildings. Only archers and towers can hit it.

# === create
super().on_create()
setup_unit(self, "Plane")

# === draw
f = forward(self.side)
draw_set_color("#000000")
draw_set_alpha(0.2)
draw_triangle(self.x + 10 * f, self.y + 12, self.x - 8 * f, self.y + 6, self.x - 8 * f, self.y + 18)
draw_set_alpha(1)
draw_set_color("#ffffff" if self.flash else "#f4f1e8")
draw_triangle(self.x + 10 * f, self.y, self.x - 8 * f, self.y - 7, self.x - 8 * f, self.y + 7)
draw_set_color(SIDE_COLOR[self.side])
draw_line(self.x + 10 * f, self.y, self.x - 8 * f, self.y, 2)
super().on_draw()
