# object: Gate
# sprite: gate
# solid: yes
# depth: 50
# A stone gate the hero can't pass without a key. It opens on its own when
# the hero walks up to it holding one.

# === create
self.told = False
place_key(self)
if is_done(self):
    self.destroy()

# === step
p = player()
if p and abs(p.x - self.x) < 24 and abs(p.y - self.y) < 40:
    if global_vars.keys > 0:
        global_vars.keys -= 1
        mark_done(self)
        sound_play("door")
        camera_shake(3, 20)
        effect("smoke", self.x, self.y - 24, scale=1.5)
        show_message("The gate grinds open.")
        self.destroy()
    elif not self.told:
        self.told = True
        show_message("Locked. There must be a key somewhere.")
