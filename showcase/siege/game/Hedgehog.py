# object: Hedgehog
# parent: Unit
# A hedgehog: spiky, so whatever hits it up close is hurt back (THORNS; strike).
# Shots from afar don't touch the spikes.

# === create
super().on_create()
setup_unit(self, "Hedgehog")

# === draw
draw_troop(self, "hedgehog")
super().on_draw()
