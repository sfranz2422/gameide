# object: Herb
# sprite: herb
# parent: Usable
# A Moonherb, for the baker. Stays picked for the rest of the game.

# === create
super().on_create()
self.tag = f"herb{self.x},{self.y}"
if flag(self.tag) or "herbs" in S["done"]:
    self.destroy()

def pick():
    set_flag(self.tag)
    add_item("herb")
    sound_play("coin")
    say(f"A Moonherb! That's {count_item('herb')}.")
    self.destroy()

self.use = pick
