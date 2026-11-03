# object: Plane
# sprite: plane
# parent: Enemy
# Flies straight to the fort, over everything. Cannons and Freezers can't touch it.

# === create
super().on_create()
self.hp = self.hp_max = 70
self.walk = 1.9
self.bounty = 20
self.flying = True
self.depth = -20
