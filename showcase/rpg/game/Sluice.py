# object: Sluice
# sprite: sluice
# parent: Usable
# A rusty wheel. Turn all three in the fen and the causeway comes up out of the water.

# === create
super().on_create()
self.solid = True
self.image_speed = 0
self.tag = f"sluice{self.x},{self.y}"
self.image_index = 1 if flag(self.tag) else 0

def turned():
    return len([k for k in S["flags"] if k.startswith("sluice")])

def turn():
    if flag(self.tag):
        say("It's open, and it isn't turning back.")
    elif S["quests"].get("ember_marsh", 0) < 1 and "ember_marsh" not in S["done"]:
        say("A big rusty wheel. It would take some reason to go heaving on that.")
    else:
        set_flag(self.tag)
        self.image_index = 1
        sound_play("foe_hit")
        camera_shake(3, 15)
        if turned() < SLUICES:
            say(f"The wheel groans round. Far off, water starts to run. That's {turned()} of {SLUICES}.")
        else:
            fen_drains()

self.use = turn

# === step
# A wheel still to turn shows up in the fog, so nobody has to search every bank for it.
if not flag(self.tag):
    light(self.x, self.y - 24, 70, "#ffd9a0", 1)
