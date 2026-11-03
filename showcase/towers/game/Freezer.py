# object: Freezer
# sprite: base_4
# parent: Tower
# Hardly any damage, but what it hits walks at half speed for a while. On the
# ground only.

# === create
super().on_create()
self.range, self.reload, self.damage = 130, 40, 2
self.shot = "Snowball"
self.top = "top_freeze"
self.air = False
