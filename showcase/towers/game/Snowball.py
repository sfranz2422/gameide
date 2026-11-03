# object: Snowball
# sprite: snowball
# parent: Shot
# A little damage, and the enemy it hits is slowed.

# === create
super().on_create()
self.fly = 7
self.air = False
self.freeze = 150
