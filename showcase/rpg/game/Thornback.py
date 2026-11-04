# object: Thornback
# sprite: map_thornback
# parent: MapFoe
# The boss of Whisper Wood. It waits in its clearing until you come.

# === create
super().on_create()
if flag("thornback_beaten"):
    self.destroy()
self.solid = True

def touched(hero):
    if not flag("met_thornback"):
        thornback_meets(self)
    else:
        start_battle(["thornback"], hero.x, hero.y + 40, run=False, then="thornback_beaten")

self.touched = touched

# === step
self.depth = -self.y
