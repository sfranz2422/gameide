# object: Archer
# parent: Unit
# A rubber-band archer: shoots from afar, and can hit paper planes.

# === create
super().on_create()
setup_unit(self, "Archer")

# === draw
draw_troop(self, "archer")
super().on_draw()
