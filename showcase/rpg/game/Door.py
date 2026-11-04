# object: Door
# sprite: door
# Walk into it and you're somewhere else. Each door's creation code says where:
# self.to (a room), self.at_x, self.at_y. A door can ask for a quest first.

# === create
self.visible = False
self.to = None
self.at_x, self.at_y = 0, 0
self.needs = None
self.sorry = "Not yet."
self.nag = 0

# === step
self.nag -= 1
hero = instance_place(self.x, self.y, "Player")
if hero and not busy():
    if self.needs and self.needs not in S["quests"] and self.needs not in S["done"]:
        if self.nag <= 0:
            self.nag = 90
            hero.y += 8 if hero.y >= self.y else -8
            say(self.sorry)
    else:
        go_to(self.to, self.at_x, self.at_y)
