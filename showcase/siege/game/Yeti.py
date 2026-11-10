# object: Yeti
# parent: Unit
# A yeti: huge and slow, it walks straight for buildings and soaks up
# damage while the others get to work.

# === create
super().on_create()
setup_unit(self, "Yeti")

# === draw
draw_troop(self, "yeti")
super().on_draw()
