# object: Source
# parent: Spot
# A tray of one part (a bun, cheese, broth, an egg…): tap it and the part goes on
# the selected plate, or the first plate that can take it.

# === create
super().on_create()
self.part = ""

# === draw
draw_set_color("#c8b49a")
draw_rect(self.x + 3, self.y + 10, self.x + self.wide - 3, self.y + self.high - 4)
draw_set_color("#6b4a2a")
draw_rect(self.x + 3, self.y + 10, self.x + self.wide - 3, self.y + self.high - 4, True)
size = min(1.0, (self.wide - 6) / FOOD_SIZE)
pic(PART_PICS[self.part], self.x + self.wide / 2, self.y + self.high / 2 + 4, size)
draw_focus(self)
