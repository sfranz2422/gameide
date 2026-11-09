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
draw_set_color("#ffffff" if self.flash else SIDE_COLOR[self.side])
draw_rect(self.x - 9, self.y - 9, self.x + 9, self.y + 9)
draw_set_color("#c0c8d0")
draw_rect(self.x - 6, self.y - 12, self.x + 6, self.y - 4)
# The wind-up key on its back, turning slower and slower.
a = self.age * 0.3 * (self.pace / self.base_pace if self.base_pace else 0)
draw_set_color("#ffd23f")
draw_line(self.x - 9, self.y, self.x - 15 - 3 * math.cos(a), self.y - 3 * math.sin(a), 2)
super().on_draw()
