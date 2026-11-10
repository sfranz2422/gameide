# object: Moose
# parent: Unit
# A moose: big and tough, and each hit knocks a troop on foot back down the lane
# (KNOCKBACK; strike).
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "Moose")

# === draw
draw_troop(self, "bear", 1.0, "#b07a48")
super().on_draw()
