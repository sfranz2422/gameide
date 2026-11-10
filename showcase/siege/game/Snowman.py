# object: Knight
# parent: Unit
# A wind-up knight: tough and hits hard, but slows as its spring unwinds.

# === create
super().on_create()
setup_unit(self, "Knight")
self.base_pace = self.pace

# === step
self.pace = self.base_pace * max(0.5, 1 - self.age / UNWIND / 2)
super().on_step()

# === draw
draw_troop(self, "knight")
super().on_draw()
