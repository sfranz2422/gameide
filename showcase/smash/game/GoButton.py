# object: GoButton
# sprite: button
# parent: Button
# Goes to another room, or starts this one again. Say which in .to and .again.

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
