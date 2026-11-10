# object: Soldier
# parent: Unit
# A toy soldier: cheap, small, and they come three at a time.

# === create
super().on_create()
setup_unit(self, "Soldier")

# === draw
draw_troop(self, "soldier")
super().on_draw()
