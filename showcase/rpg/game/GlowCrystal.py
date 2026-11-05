# object: GlowCrystal
# sprite: glow_crystal
# parent: Usable
# A Glow Crystal, for the shopkeeper. Stays picked for the rest of the game.

# === create
super().on_create()
self.tag = f"crystal{S['room']}{self.x},{self.y}"
if flag(self.tag) or "crystals" in S["done"]:
    self.destroy()

def pick():
    set_flag(self.tag)
    add_item("glow_crystal")
    sound_play("coin")
    say(f"A Glow Crystal! That's {count_item('glow_crystal')}.")
    self.destroy()

self.use = pick

# === step
light(self.x, self.y - 12, 70, "#ff9a4a", 1)
