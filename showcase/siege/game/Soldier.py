# object: Soldier
# parent: Unit
# A toy soldier: cheap, small, and they come three at a time.

# === create
super().on_create()
setup_unit(self, "Soldier")

# === draw
draw_set_color("#ffffff" if self.flash else SIDE_COLOR[self.side])
draw_circle(self.x, self.y, self.radius)
draw_set_color("#2f4f2f")
draw_circle(self.x, self.y - 3, 3)
super().on_draw()
