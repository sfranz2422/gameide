# object: GoButton
# sprite: card
# parent: Button
# On the end-of-level panel: goes to another room. Made there when the level ends.

# === create
super().on_create()
self.to = "Title"
self.again = False

# === mouse pressed left
sound_play("click", volume=0.5)
if self.again:
    room_restart()
else:
    room_goto(self.to)
