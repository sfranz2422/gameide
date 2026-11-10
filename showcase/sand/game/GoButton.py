# object: GoButton
# sprite: button
# parent: Button
# On the Sorted! panel: .does says where it goes.

# === create
super().on_create()
self.does = "levels"

# === mouse pressed left
sound_play("click", volume=0.5)
if self.does == "next":
    global_vars.level += 1
    room_restart()
elif self.does == "again":
    room_restart()
else:
    room_goto("Title")
