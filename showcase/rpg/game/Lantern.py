# object: Lantern
# sprite: lantern
# parent: Usable
# A lantern in town, lit in order: self.number is in each one's creation code, and the
# big one in the square is the first. Lit, it gives its light to the whole game's mood.

# === create
super().on_create()
self.solid = True
self.number = 1
self.lit = False
self.image_speed = 0

def show():
    self.lit = S["lit"] >= self.number
    self.image_index = 1 if self.lit else 0

self.show = show

def light_up():
    self.lit = True
    self.image_index = 1
    set_darkness()

self.light_up = light_up
self.use = lambda: say("It's lit, and warm to stand beside." if self.lit else "It's cold. It needs an ember.")

# === step
# Creation code sets the number after Create has run, so it's read here.
if not self.lit:
    self.show()
if self.lit:
    light(self.x, self.y - 40, 240, "#ffcf7a", 1)
