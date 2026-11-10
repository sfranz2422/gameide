# object: RestartButton
# sprite: button
# parent: Button

# === create
super().on_create()
self.words = "Restart (R)"

# === mouse pressed left
sound_play("click", volume=0.5)
room_restart()
