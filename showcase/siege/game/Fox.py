# object: Fox
# parent: Unit
# An arctic fox: fast and weak; they come four at a time.
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "Fox")

# === draw
draw_troop(self, "penguin", 0.7, "#ffb070")
super().on_draw()
