# object: Wizard
# sprite: map_wizard
# parent: MapFoe
# Stands before the stairs to the top. Never solid, like every foe: see Golem.

# === create
super().on_create()
if flag("wizard_beaten"):
    self.destroy()

def touched(hero):
    if not flag("met_wizard"):
        wizard_meets(self)
    else:
        start_battle(["wizard"], hero.x, hero.y + 40, run=False, then="wizard_beaten")

self.touched = touched

# === step
self.depth = -self.y
