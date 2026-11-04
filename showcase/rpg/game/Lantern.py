# object: Lantern
# sprite: lantern
# parent: Usable
# The big lantern in the square. Lit, it gives its light to the whole game's mood.

# === create
super().on_create()
self.solid = True
self.lit = S["lit"] >= 1
self.image_speed = 0
self.image_index = 1 if self.lit else 0

def light_up():
    self.lit = True
    self.image_index = 1
    set_darkness()

self.light_up = light_up
self.use = lambda: say("The big lantern in the square. It's lit." if self.lit else "It's cold. It needs an ember.")

# === step
if self.lit:
    light(self.x, self.y - 40, 240, "#ffcf7a", 1)
