# object: Plane
# parent: Unit
# A paper plane: flies over the gap and everything else, and only attacks
# buildings. Only archers and towers can hit it.

# === create
super().on_create()
setup_unit(self, "Plane")

# === draw
draw_troop(self, "plane")
super().on_draw()
