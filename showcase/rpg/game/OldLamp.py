# object: OldLamp
# sprite: old_lamp
# parent: Usable
# A lamp from before the lanterns, still warm. Standing by it heals and saves.

# === create
super().on_create()
self.solid = True

def warm():
    say("The old lamp still holds a little warmth. Everyone feels better. Your journey is saved.")
    sound_play("heal")
    rest_party()
    save_game()

self.use = warm

# === step
light(self.x, self.y - 60, 150, "#ffcf7a", 1)
