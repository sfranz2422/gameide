# object: Rubble
# sprite: rubble
# parent: Usable
# A rockfall across a tunnel. Bram's hammer is the only way through, and it stays broken.

# === create
super().on_create()
self.solid = True
self.tag = f"rubble{S['room']}{self.x},{self.y}"
if flag(self.tag):
    self.destroy()

def smash():
    set_flag(self.tag)
    sound_play("foe_hit")
    camera_shake(4, 20)
    effect("smoke", self.x, self.y - 16)
    say("Stand back. HRRAH!", "Bram", picture="face_bram")
    self.destroy()

self.use = smash
