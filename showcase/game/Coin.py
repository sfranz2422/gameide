# object: Coin
# sprite: coin
# parent: Pickup

# === collision Player
global_vars.coins += 1
sound_play("pickup", volume=0.5)
effect("sparkle", self.x, self.y - 8, scale=0.6)
if not self.dropped:
    mark_done(self)
self.destroy()
