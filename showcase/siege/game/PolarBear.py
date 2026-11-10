# object: PolarBear
# parent: Unit
# A polar bear: fairly tough, and each swipe hits every troop of theirs on foot
# around what it hits (strike, BEAR_SPLASH).

# === create
super().on_create()
setup_unit(self, "PolarBear")

# === draw
draw_troop(self, "bear")
super().on_draw()
