# object: Fox
# parent: Unit
# An arctic fox: fast and weak; they come four at a time.

# === create
super().on_create()
setup_unit(self, "Fox")

# === draw
draw_troop(self, "fox")
super().on_draw()
