# object: Key
# sprite: key
# parent: Pickup

# === collision Player
global_vars.keys += 1
mark_done(self)
sound_play("power")
effect("sparkle", self.x, self.y - 8, color="#ffd166", scale=1.5)
show_message("A key! It must open a gate somewhere.")
self.destroy()
