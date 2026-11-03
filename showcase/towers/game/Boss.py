# object: Boss
# sprite: boss
# parent: Enemy
# The last thing in a level: twice the size, and it takes half your fort if it gets there.

# === create
super().on_create()
self.hp = self.hp_max = 2200
self.walk = 0.55
self.bounty = 200
self.bite = 10
self.image_xscale = self.image_yscale = 1.6
