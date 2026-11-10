# object: IceChunk
# parent: Unit
# A chunk of an Ice Golem, still fighting.
# (Drawn from another troop's picture until the teacher's own come.)

# === create
super().on_create()
setup_unit(self, "IceChunk")

# === draw
draw_troop(self, "snowman", 0.6, "#a8dcff")
super().on_draw()
