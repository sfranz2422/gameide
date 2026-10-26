# object: Enemy
# Every enemy's parent: what being hit does, and what touching one does to
# the hero (Player has a Collision with Enemy). Snail, Boar, Bee and the
# boss inherit this; each starts its own Create with super().on_create().

# === create
self.hp = 1
self.contact_damage = 1
self.knock = 0           # pushed back by a hit, slowing to nothing
self.hit_by = None       # the swing that last hit it: one swing, one hit
self.facing = -1
self.vy = 0
self.corpse = None       # an animation to leave behind (Corpse plays it once)
self.harmless = False

# === collision Slash
if self.hit_by is not other and self.hp > 0:
    self.hit_by = other
    enemy_hit(self, other.damage, other.owner.x if other.owner else other.x)
