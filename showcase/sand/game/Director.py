# object: Director
# depth: -90
# Runs a level: makes its tubes, picks up and pours, keeps the pours for Undo,
# and says when every tube is one colour. global_vars.level says which level.

# === create
global_vars.director = self
self.level = global_vars.level
level = LEVELS[self.level]
self.par = level["par"]
self.pours = 0
self.history = []
self.picked = None
self.extra = False
self.won = False
self.stars = 0
self.tubes = []
for sand in level["tubes"]:
    t = instance_create(0, 0, "Tube")
    t.sand = list(sand)
    t.hidden = max(0, len(sand) - 1) if level["hidden"] else 0
    self.tubes.append(t)
place_tubes(self, False)

# === step
# A Python check question (in a showcase game) waits until no sand is falling.
question_ok(not instance_exists("Pour"))
if keyboard_check_pressed("z"):
    undo(self)
if keyboard_check_pressed("r"):
    room_restart()
if keyboard_check_pressed("escape"):
    room_goto("Title")
if not self.won and not instance_exists("Pour") and all_done(self.tubes):
    finish(self)

# === mouse global pressed left
# A tap on nothing puts a picked-up tube back down.
if collision_point(mouse_x, mouse_y, "Tube") is None and collision_point(mouse_x, mouse_y, "Button") is None:
    put_down(self)

# === draw_gui
level = LEVELS[self.level]
text(20, 14, f"{self.level + 1}. {level['name']}", GOLD, 24)
text(20, 46, f"Pours: {self.pours}    Par: {self.par}", INK, 18)
if self.pours == 0 and self.level < 2:
    text(VIEW_W / 2, 470, "Tap a tube to pick it up, then tap another to pour into it.", INK, 18, "center")
    text(VIEW_W / 2, 494, "Sand only goes onto the same colour, or into an empty tube.", MINT, 16, "center")
elif not instance_exists("Pour") and stuck(self):
    text(VIEW_W / 2, 480, "No more pours! Undo, Restart, or add a tube.", RED, 20, "center")
if self.won:
    draw_set_alpha(0.8)
    draw_set_color(SHADOW)
    draw_rect(242, 130, VIEW_W - 242, 420)
    draw_set_alpha(1)
    text(VIEW_W / 2, 146, "Sorted!", GOLD, 44, "center")
    for k in range(3):
        draw_sprite_ext("star", 0, VIEW_W / 2 - 70 + k * 70, 240, 1, 1, 0, "white" if k < self.stars else "#4a4058")
    text(VIEW_W / 2, 290, f"{self.pours} pours (par {self.par})", INK, 20, "center")
    if self.extra and self.stars == 2:
        text(VIEW_W / 2, 318, "The extra tube costs the third star.", MINT, 15, "center")
if question_waiting():
    text(VIEW_W / 2, 8, "Python question after this pour", GOLD, 15, "center")
