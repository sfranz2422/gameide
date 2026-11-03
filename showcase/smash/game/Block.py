# object: Block
# parent: Thing
# Anything that can be broken. Its children say what it's made of; their children
# say what shape it is, with no code at all. To make a new material, add a child
# that calls made_of() with its numbers.

# === create
super().on_create()

# === destroy
particles(self.x, self.y, 16, self.dust, 3, 4, 28, 0.15)
sound_play(self.crack, volume=0.6)
global_vars.score += self.points
