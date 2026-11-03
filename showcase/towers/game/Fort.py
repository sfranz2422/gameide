# object: Fort
# sprite: fort
# What you're defending. Each enemy that reaches it takes lives.

# === create
self.depth = -3

# === collision Enemy
global_vars.lives = max(0, global_vars.lives - other.bite)
other.destroy()
self.flash("red", 8)
camera_shake(5, 12)
sound_play("hit", volume=0.8)
