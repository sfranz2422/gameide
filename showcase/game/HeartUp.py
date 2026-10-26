# object: HeartUp
# sprite: heart_up
# parent: Pickup

# === create
super().on_create()
self.glow = "#ff6b6b"

# === collision Player
global_vars.max_hp += 1
global_vars.hp = global_vars.max_hp
mark_done(self)
sound_play("power")
effect("sparkle", self.x, self.y - 8, color="#ff6b6b", scale=1.5)
show_message("Your heart grows stronger: one more life point.")
save_progress()
self.destroy()
