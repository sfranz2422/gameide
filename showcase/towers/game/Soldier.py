# object: Soldier
# sprite: soldier
# parent: Enemy
# The ordinary foot soldier.

# === create
super().on_create()
self.hp = self.hp_max = 42
self.walk = 1.5
self.bounty = 9
