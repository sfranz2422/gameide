# object: Fairy
# parent: Unit
# A frost fairy: flies, and her shots slow what they hit for a moment (CHILL).

# === create
super().on_create()
setup_unit(self, "Fairy")

# === draw
draw_troop(self, "fairy")
super().on_draw()
