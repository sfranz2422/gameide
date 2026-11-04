# object: MenuBox
# depth: -90000
# A list to choose from, with the arrow keys and Enter, or by tapping. Every menu
# in the game is one of these, made by open_menu in the menus script. The newest
# one answers; the others wait underneath it.

# === create
self.title = ""
self.options = []     # (words, can it be picked)
self.pick = 0
self.on_pick = None
self.on_back = None
self.on_move = None
self.left, self.top, self.w = 20, 20, 240
self.age = 0
self.note = ""

# === step
self.age += 1
if self.age < 2 or dialogue_open() or newest_menu() is not self:
    return
n = len(self.options)
if keyboard_check_pressed("down"):
    self.pick = (self.pick + 1) % n
    sound_play("tick")
if keyboard_check_pressed("up"):
    self.pick = (self.pick - 1) % n
    sound_play("tick")
mx, my = mouse_x - view_x, mouse_y - view_y
hit = None
for i in range(n):
    if self.left <= mx < self.left + self.w and self.row_y(i) <= my < self.row_y(i) + ROW_H:
        hit = i
if hit is not None and (mouse_x, mouse_y) != getattr(self, "seen", None):
    self.pick = hit
self.seen = (mouse_x, mouse_y)
if self.on_move:
    self.on_move(self.pick)
chosen = confirm_pressed() and not mouse_check_pressed("left")
if mouse_check_pressed("left"):
    if hit is not None:
        self.pick = hit
        chosen = True
if chosen:
    if self.options[self.pick][1]:
        sound_play("click")
        self.on_pick(self.pick)
    else:
        sound_play("nope")
elif back_pressed() and self.on_back:
    sound_play("tick")
    self.on_back()

# === draw_gui
h = self.height()
draw_set_alpha(0.93)
draw_set_color("#141a2e")
draw_rect(self.left, self.top, self.left + self.w, self.top + h)
draw_set_alpha(1)
draw_set_color("#c9b37a")
draw_rect(self.left, self.top, self.left + self.w, self.top + h, True)
draw_set_font(None, 15)
if self.title:
    draw_set_color("#ffd166")
    draw_text(self.left + 12, self.top + 7, self.title)
for i, (words, ok) in enumerate(self.options):
    y = self.row_y(i)
    if i == self.pick and newest_menu() is self:
        draw_set_color("#3a4a78")
        draw_rect(self.left + 4, y, self.left + self.w - 4, y + ROW_H - 2)
    draw_set_color("#ffffff" if ok else "#7d8496")
    draw_text(self.left + 12, y + 4, words)
if self.note:
    draw_set_color("#b9c2d8")
    draw_text(self.left + 12, self.top + h - 26, self.note)
