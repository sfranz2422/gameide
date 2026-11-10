# object: IceGolem
# parent: Unit
# An ice golem: goes for buildings, and when it's knocked out it breaks into two
# ice chunks that keep fighting (hurt).
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "IceGolem")

# === draw
draw_troop(self, "snowman", 1.15, "#a8dcff")
super().on_draw()
