# object: Squirrel
# parent: Unit
# A squirrel thief: quick and weak, goes for buildings, and each hit on a tower
# takes an energy from them for you (strike). They come two at a time.

# === create
super().on_create()
setup_unit(self, "Squirrel")

# === draw
draw_troop(self, "squirrel")
super().on_draw()
