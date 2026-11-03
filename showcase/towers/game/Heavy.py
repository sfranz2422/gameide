# object: Heavy
# sprite: heavy
# parent: Enemy
# A bigger tank: only massed fire stops it.

# === create
super().on_create()
self.hp = self.hp_max = 620
self.walk = 0.7
self.bounty = 80
self.bite = 3
