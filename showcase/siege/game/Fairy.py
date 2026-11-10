# object: Fairy
# parent: Unit
# A frost fairy: flies, and her shots slow what they hit for a moment (CHILL).
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "Fairy")

# === draw
draw_troop(self, "owl", 0.6, "#bfe8ff")
super().on_draw()
