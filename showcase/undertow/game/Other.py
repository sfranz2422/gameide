# object: Other
# parent: Crew
# Another player, drawn where the room says they are (Director moves it). Its
# number over its head; a Mimic sees fellow Mimics' numbers in red. A ghost is
# seen only by other ghosts.

# === create
super().on_create()
self.number = 0
self.name = ""
self.ghost = False

# === step
self.image_xscale = self.facing
self.image_alpha = 0.55 if self.ghost else 1

# === draw
draw_self()
mate = self.number in global_vars.mates
words(self.x, self.y - 62, f"#{self.number}", 12, "#ff5a4f" if mate else "white", "center")
