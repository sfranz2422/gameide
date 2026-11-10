# object: Snowman
# parent: Unit
# A snowman: tough and hits hard, but slows as it melts.

# === create
super().on_create()
setup_unit(self, "Snowman")
self.base_pace = self.pace

# === step
self.pace = self.base_pace * max(0.5, 1 - self.age / MELT / 2)
super().on_step()

# === draw
draw_troop(self, "snowman")
super().on_draw()
