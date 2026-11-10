# object: LevelsButton
# sprite: button
# parent: Button

# === create
super().on_create()
self.words = "Levels (Esc)"

# === mouse pressed left
sound_play("click", volume=0.5)
room_goto("Title")
