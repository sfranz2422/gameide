# object: Snail
# sprite: snail_walk
# parent: Enemy
# Slow, and turns at walls and edges. Hit it once and it hides in its
# shell, where the sword can't hurt it: wait for it to come out.

# === create
super().on_create()
self.hp = 2
self.hiding = 0
self.corpse = "snail_dead"

# === step
if self.knock:
    self.move_and_collide(self.knock, 0)
    self.knock = approach(self.knock, 0, 0.25)
if self.hiding > 0:
    self.hiding -= 1
    set_anim(self, "snail_hide")
    if self.image_index >= 7:
        self.image_index = 7
        self.image_speed = 0
    self.harmless = True
else:
    self.harmless = False
    set_anim(self, "snail_walk")
    if ledge_ahead(self, self.facing, 12):
        self.facing = -self.facing
    self.move_and_collide(self.facing * 0.35, 0)
fall(self)
self.image_xscale = -self.facing      # the picture faces left

# === collision Slash
if self.hiding > 0:
    if self.hit_by is not other:
        self.hit_by = other
        sound_play("hit", volume=0.4)
        particles(self.x, self.y - 10, count=6, color="#ffe8a3", speed=2, size=2, life=10)
    return
super().on_collision_slash(other)
if self.hp > 0:
    self.hiding = 150
