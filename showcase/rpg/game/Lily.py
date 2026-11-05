# object: Lily
# sprite: lily
# parent: Usable
# A Marsh Lily, for Sedge. Stays picked for the rest of the game.

# === create
super().on_create()
self.tag = f"lily{S['room']}{self.x},{self.y}"
if flag(self.tag) or "lilies" in S["done"]:
    self.destroy()

def pick():
    set_flag(self.tag)
    add_item("lily")
    sound_play("coin")
    say(f"A Marsh Lily! That's {count_item('lily')}.")
    self.destroy()

self.use = pick
