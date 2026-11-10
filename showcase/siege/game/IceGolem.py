# object: IceGolem
# parent: Unit
# An ice golem: goes for buildings, and when it's knocked out it breaks into two
# ice chunks that keep fighting (hurt).

# === create
super().on_create()
setup_unit(self, "IceGolem")

# === draw
draw_troop(self, "icegolem")
super().on_draw()
