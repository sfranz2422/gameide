# object: LevelCard
# sprite: card
# parent: Button
# On the title: one level and its best, locked until the one before is done.
# Each card's creation code in the room says which level it is.

# === create
super().on_create()
self.wide = 156
self.size = 13
self.i = 0

# === step
self.words = f"{self.i + 1}. {LEVELS[self.i]['name']}"
self.off = self.i > 0 and not save_get(f"stars_{self.i - 1}", 0)
self.small = "Locked" if self.off else ""

# === draw_gui
super().on_draw_gui()
if not self.off:
    best = save_get(f"stars_{self.i}", 0)
    for k in range(3):
        draw_sprite_ext("star", 0, self.x + 58 + k * 20, self.y + 41, 0.32, 0.32, 0, "white" if k < best else "#5a4048")

# === mouse pressed left
if not self.off:
    sound_play("click", volume=0.6)
    global_vars.level = self.i
    room_goto("Play")
