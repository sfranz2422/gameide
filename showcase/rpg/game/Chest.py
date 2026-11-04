# object: Chest
# sprite: chest
# parent: Usable
# What's in it is said by each chest's own creation code: self.item, self.gold.

# === create
super().on_create()
self.solid = True
self.item = None
self.gold = 0
self.tag = f"chest{S['room']}{self.x},{self.y}"
self.image_speed = 0
self.image_index = 1 if flag(self.tag) else 0

def open_it():
    if flag(self.tag):
        say("Empty now.")
        return
    set_flag(self.tag)
    self.image_index = 1
    sound_play("coin")
    if self.item:
        add_item(self.item)
        say(f"Inside: {ITEMS[self.item]['name']}!")
    else:
        S["gold"] += self.gold
        say(f"Inside: {self.gold} gold!")

self.use = open_it
