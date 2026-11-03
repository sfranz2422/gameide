# object: Tank
# sprite: tank
# parent: Enemy
# Slow, and takes a lot of stopping.

# === create
super().on_create()
self.hp = self.hp_max = 240
self.walk = 0.9
self.bounty = 34
self.bite = 2
