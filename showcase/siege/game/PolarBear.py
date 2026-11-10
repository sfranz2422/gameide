# object: PolarBear
# parent: Unit
# A polar bear: fairly tough, and each swipe hits every troop of theirs on foot
# around what it hits (strike, BEAR_SPLASH).
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "PolarBear")

# === draw
draw_troop(self, "yeti", 0.75, "#fff3d6")
super().on_draw()
