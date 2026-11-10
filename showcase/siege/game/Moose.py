# object: Moose
# parent: Unit
# A moose: big and tough, and each hit knocks a troop on foot back down the lane
# (KNOCKBACK; strike).

# === create
super().on_create()
setup_unit(self, "Moose")

# === draw
draw_troop(self, "moose")
super().on_draw()
