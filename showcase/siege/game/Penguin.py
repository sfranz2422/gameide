# object: Penguin
# parent: Unit
# A penguin with a slingshot: shoots from afar, and can hit owls.

# === create
super().on_create()
setup_unit(self, "Penguin")

# === draw
draw_troop(self, "penguin")
super().on_draw()
