# object: Gunner
# sprite: base_1
# parent: Tower
# Cheap and quick: small shots at anything, on the ground or in the air.

# === create
super().on_create()
self.range, self.reload, self.damage = 140, 22, 7
self.shot = "Pellet"
self.top = "top_gun"
