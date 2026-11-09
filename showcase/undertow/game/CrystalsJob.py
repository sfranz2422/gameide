# object: CrystalsJob
# parent: Job
# Six glowing crystals, three colours, and a tray for each colour. Click a
# crystal, then its tray (or arrows and Enter). A wrong tray buzzes.

# === create
super().on_create()
self.colors = ["#4fe3ff", "#ff6bd6", "#ffb84f"]
self.crystals = random.sample([0, 0, 1, 1, 2, 2], 6)   # their colours, left to right; None once in a tray
self.picked = None
self.cursor = 0

# === step
super().on_step()
# Gone (Esc): nothing more to do.
if not self._alive:
    return
mx, my = gui_mouse()
left = [k for k, c in enumerate(self.crystals) if c is not None]
choose = None
if mouse_check_pressed("left"):
    if 100 <= my <= 160:
        k = int((mx - 160) // 55)
        if 0 <= k < 6 and self.crystals[k] is not None:
            choose = ("crystal", k)
    elif 200 <= my <= 270:
        k = int((mx - 160) // 110)
        if 0 <= k < 3:
            choose = ("tray", k)
if keyboard_check_pressed("left"):
    self.cursor -= 1
if keyboard_check_pressed("right"):
    self.cursor += 1
self.cursor %= (3 if self.picked is not None else max(1, len(left)))
if keyboard_check_pressed("enter") or keyboard_check_pressed("space"):
    choose = ("tray", self.cursor) if self.picked is not None else (("crystal", left[self.cursor]) if left else None)
if choose is not None:
    what, k = choose
    if what == "crystal":
        self.picked, self.cursor = k, 0
        sound_play("click", volume=0.4)
    elif self.picked is not None:
        if self.crystals[self.picked] == k:
            self.crystals[self.picked] = None
            sound_play("plug", volume=0.5)
        else:
            sound_play("buzz", volume=0.5)
        self.picked, self.cursor = None, 0
if all(c is None for c in self.crystals):
    job_finished(self)

# === draw_gui
super().on_draw_gui()
for k, c in enumerate(self.crystals):
    if c is None:
        continue
    x = 160 + k * 55 + 27
    draw_set_color(self.colors[c])
    draw_triangle(x, 104, x - 14, 150, x + 14, 150)
    if self.picked == k:     # in hand: lifted, with a glow under it
        draw_set_color("#ffffff")
        draw_rect(x - 16, 154, x + 16, 158)
left = [k for k, c in enumerate(self.crystals) if c is not None]
for k in range(3):
    x = 160 + k * 110
    draw_set_color("#0b1620")
    draw_rect(x + 8, 210, x + 102, 262)
    draw_set_color(self.colors[k])
    draw_rect(x + 8, 210, x + 102, 262, True)
    draw_rect(x + 40, 228, x + 70, 244)
# The keys' cursor: over a crystal, or (one in hand) over a tray.
draw_set_color("#ffd23f")
if self.picked is not None:
    x = 160 + self.cursor * 110
    draw_triangle(x + 45, 278, x + 65, 278, x + 55, 268)
elif left:
    x = 160 + left[self.cursor % len(left)] * 55 + 27
    draw_triangle(x - 10, 172, x + 10, 172, x, 162)
