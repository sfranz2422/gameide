# object: IceChunk
# parent: Unit
# A chunk of an Ice Golem, still fighting.

# === create
super().on_create()
setup_unit(self, "IceChunk")

# === draw
draw_troop(self, "chunk")
super().on_draw()
