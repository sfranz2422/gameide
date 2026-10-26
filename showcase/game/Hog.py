# object: Hog
# sprite: hog_walk
# parent: Boar
# The Deep Cave's boar: bigger, tougher, and its charge is faster. Everything
# else it does is Boar's — only the numbers and the pictures change.

# === create
super().on_create()
self.hp = 6
self.contact_damage = 2
self.look = "hog"
self.walk_speed = 0.8
self.charge_speed = 4.2
self.corpse = "hog_hit"
