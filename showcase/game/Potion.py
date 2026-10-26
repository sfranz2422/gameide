# object: Potion
# sprite: potion
# parent: Pickup

# === collision Player
if global_vars.hp < global_vars.max_hp or not self.dropped:
    global_vars.hp = min(global_vars.max_hp, global_vars.hp + 2)
    sound_play("pickup")
    effect("sparkle", self.x, self.y - 8, color="#ff8080")
    if not self.dropped:
        mark_done(self)
    self.destroy()
