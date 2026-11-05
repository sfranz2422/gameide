# object: Knight
# sprite: map_knight
# parent: MapFoe
# The boss of the Mistfen. Never solid, like every foe: see Golem.

# === create
super().on_create()
if flag("knight_beaten"):
    self.destroy()

def touched(hero):
    if not flag("met_knight"):
        knight_meets(self)
    else:
        start_battle(["knight"], hero.x, hero.y + 40, run=False, then="knight_beaten")

self.touched = touched

# === step
self.depth = -self.y
