# object: LevelCard
# sprite: card
# parent: Button
# On the title: one level, its best result, and locked until the one before is won.
# Each card's creation code in the room says which level it is.

# === create
super().on_create()
self.i = 0

# === step
self.words = LEVELS[self.i]["name"]
stars = save_get(f"stars_{self.i}", 0)
self.off = self.i > 0 and not save_get(f"stars_{self.i - 1}", 0)
self.small = "Locked" if self.off else f"Best: {stars_text(stars)}"

# === mouse pressed left
if not self.off:
    sound_play("click", volume=0.6)
    room_goto(LEVELS[self.i]["name"])
