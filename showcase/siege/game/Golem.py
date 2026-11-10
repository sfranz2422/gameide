# object: Golem
# parent: Unit
# An eraser golem: huge and slow, it walks straight for buildings and soaks up
# damage while the others get to work.

# === create
super().on_create()
setup_unit(self, "Golem")

# === draw
draw_troop(self, "golem")
super().on_draw()
