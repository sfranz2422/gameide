# object: BuyButton
# sprite: button
# parent: Button
# Picks a tower to place. Which one is set when it's placed in the room.

# === create
super().on_create()
self.kind = "Gunner"

# === step
self.words = self.kind
self.small = f"{PRICES[self.kind]} gold"
self.picture = "top_" + {"Gunner": "gun", "Cannon": "cannon", "Rocket": "rocket", "Freezer": "freeze"}[self.kind]
self.off = global_vars.gold < PRICES[self.kind]

# === mouse pressed left
if global_vars.mode == "playing" and not self.off:
    global_vars.buying = None if global_vars.buying == self.kind else self.kind
    global_vars.selected = None
    sound_play("click", volume=0.5)
