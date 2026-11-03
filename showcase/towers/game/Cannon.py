# object: Cannon
# sprite: base_2
# parent: Tower
# Slow and heavy: a shell bursts where it lands and hurts all around it. It
# can't reach anything in the air.

# === create
super().on_create()
self.range, self.reload, self.damage = 170, 70, 34
self.shot = "Shell"
self.top = "top_cannon"
self.air = False
