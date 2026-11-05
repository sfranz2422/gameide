# object: Chest
# sprite: chest
# parent: Usable
# What's in it is said by each chest's own creation code: self.item, self.gold.

# === create
super().on_create()
self.solid = True
self.item = None
self.gold = 0
self.gear = None
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
    if self.gear:
        S["gear"].append(self.gear)
        say(f"Inside: {GEAR[self.gear]['name']}! Look in your Gear.")
    elif self.item:
        add_item(self.item)
        if self.item == "mine_key":
            reach_stage("ember_mine", 3)
        say(f"Inside: {ITEMS[self.item]['name']}!")
    else:
        S["gold"] += self.gold
        say(f"Inside: {self.gold} gold!")

self.use = open_it
