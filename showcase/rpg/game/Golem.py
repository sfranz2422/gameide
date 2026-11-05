# object: Golem
# sprite: map_golem
# parent: MapFoe
# The boss of the Ashdeep. Never solid: a solid thing stops you a pixel short of it,
# so you never touch it and no fight starts.

# === create
super().on_create()
if flag("golem_beaten"):
    self.destroy()

def touched(hero):
    if not flag("met_golem"):
        golem_meets(self)
    else:
        start_battle(["golem"], hero.x, hero.y + 40, run=False, then="golem_beaten")

self.touched = touched

# === step
self.depth = -self.y
