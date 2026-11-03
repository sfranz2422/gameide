# object: Rocket
# sprite: base_3
# parent: Tower
# Long reach and hard hitting: its rockets chase their target, and go for planes too.

# === create
super().on_create()
self.range, self.reload, self.damage = 230, 80, 46
self.shot = "Missile"
self.top = "top_rocket"
