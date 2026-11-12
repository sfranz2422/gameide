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
self.cursor = None        # the tube the keys point at (_5keys.py)
for sand in level["tubes"]:
    t = instance_create(0, 0, "Tube")
    t.sand = list(sand)
    t.hidden = max(0, len(sand) - 1) if level["hidden"] else 0
    self.tubes.append(t)
place_tubes(self, False)

# === step
# A Python check question (in a showcase game) waits until no sand is falling.
question_ok(not instance_exists("Pour"))
track_mouse()
if self.won:
    # The Sorted! panel's buttons: arrows choose, Space presses, Esc goes back.
    buttons = sorted(instances("GoButton"), key=lambda b: b.x)
    focus = global_vars.focus
    if focus not in buttons:
        focus = next((b for b in buttons if b.does == "next"), buttons[0] if buttons else None)
    global_vars.focus = move_focus(buttons, focus)
    if act("ok"):
        press(global_vars.focus)
    elif act("back"):
        room_goto("Title")
else:
    # The keys' cursor on the tubes: Space does what a tap on that tube would.
    if self.cursor not in self.tubes:
        self.cursor = next((t for t in self.tubes if t.sand and not tube_done(t.sand)), self.tubes[0])
    self.cursor = move_focus(self.tubes, self.cursor)
    if act("ok"):
        tap(self.cursor)
    if act("back"):
        if self.picked:
            put_down(self)
        else:
            room_goto("Title")
    if act("undo"):
        undo(self)
    if act("tube"):
        add_tube(self)
if act("restart"):
    room_restart()
if not self.won and not instance_exists("Pour") and all_done(self.tubes):
    finish(self)

# === mouse global pressed left
# A tap on nothing puts a picked-up tube back down.
global_vars.keyed = False
if collision_point(mouse_x, mouse_y, "Tube") is None and collision_point(mouse_x, mouse_y, "Button") is None:
    put_down(self)

# === draw
# The keys' cursor: a gold box round the tube Space would tap. It follows the tube
# as it lifts and pours.
if keyed() and not self.won and self.cursor is not None:
    t = self.cursor
    draw_focus(t.x - 38, t.y - 12, t.x + 38, t.y + 156)

# === draw_gui
level = LEVELS[self.level]
text(VIEW_W - 20, 14, "Arrows: choose a tube   Space: pick up, pour   Esc: put down", "#d8cfe0", 13, "right")
text(VIEW_W - 20, 32, "Z: undo   R: restart   X: extra tube", "#d8cfe0", 13, "right")
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
