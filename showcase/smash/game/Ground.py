# object: Ground
# parent: Thing
# Holds everything up. It never moves and nothing hurts it.

# === create
super().on_create()
self.fixed = True
self.weight = 1000

# === end_step
pass

# === collision Thing
pass
