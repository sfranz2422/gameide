# object: Owl
# parent: Unit
# A snowy owl: flies over the creek and everything else, and only attacks
# buildings. Only penguins and towers can hit it.

# === create
super().on_create()
setup_unit(self, "Owl")

# === draw
draw_troop(self, "owl")
super().on_draw()
