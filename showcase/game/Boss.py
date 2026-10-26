# object: Boss
# parent: Enemy
# Every boss's parent: asleep until the arena's tripwire (BossTrigger) wakes
# it, harmless while it sleeps, and gone for good once beaten. Tusk and
# Shellmaw are its children, each with its own way of fighting.

# === create
super().on_create()
self.state = "sleep"
self.timer = 0
self.angry = False
self.name = "?"
self.max_hp = self.hp = 10
if boss_beaten():
    self.destroy()
