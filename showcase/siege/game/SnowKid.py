# object: SnowKid
# parent: Unit
# A snow kid in a bobble hat: cheap, small, and they come three at a time.

# === create
super().on_create()
setup_unit(self, "SnowKid")

# === draw
draw_troop(self, "kid")
super().on_draw()
