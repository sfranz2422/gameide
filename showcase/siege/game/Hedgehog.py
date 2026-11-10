# object: Hedgehog
# parent: Unit
# A hedgehog: spiky, so whatever hits it up close is hurt back (THORNS; strike).
# Shots from afar don't touch the spikes.
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "Hedgehog")

# === draw
draw_troop(self, "chunk", 0.9, "#9a7048")
super().on_draw()
