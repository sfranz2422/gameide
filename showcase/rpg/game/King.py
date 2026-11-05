# object: King
# sprite: map_king
# parent: MapFoe
# The Shadow King, on his floor at the top. Never solid, like every foe: see Golem.

# === create
super().on_create()
if flag("king_beaten"):
    self.destroy()

def touched(hero):
    if not flag("met_king"):
        king_meets(self)
    else:
        start_battle(["king"], hero.x, hero.y + 40, run=False, then="king_beaten")

self.touched = touched

# === step
self.depth = -self.y
