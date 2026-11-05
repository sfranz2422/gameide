# object: Stairs
# sprite: stairs
# parent: Usable
# Up or down a floor of the tower. Each one's creation code says where, and what it waits for.

# === create
super().on_create()
self.to = None
self.at_x, self.at_y = 0, 0
self.needs_flag = None
self.sorry = "Not yet."

def climb():
    if self.needs_flag and not flag(self.needs_flag):
        sound_play("nope")
        say(self.sorry)
    else:
        go_to(self.to, self.at_x, self.at_y)

self.use = climb
