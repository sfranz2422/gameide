# object: Golem
# parent: Unit
# An eraser golem: huge and slow, it walks straight for buildings and soaks up
# damage while the others get to work.

# === create
super().on_create()
setup_unit(self, "Golem")

# === draw
draw_set_color("#000000")
draw_set_alpha(0.25)
draw_rect(self.x - 13, self.y - 9, self.x + 17, self.y + 17)
draw_set_alpha(1)
draw_set_color("#ffffff" if self.flash else "#ff9fb0")
draw_rect(self.x - 15, self.y - 13, self.x + 15, self.y + 13)
draw_set_color(SIDE_COLOR[self.side])
draw_rect(self.x - 15, self.y + 3, self.x + 15, self.y + 13)
draw_set_color("#1b1208")
draw_rect(self.x - 15, self.y - 13, self.x + 15, self.y + 13, True)
super().on_draw()
