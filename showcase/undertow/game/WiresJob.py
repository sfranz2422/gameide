# object: WiresJob
# parent: Job
# Four loose wires on the left; join each to the socket of its colour on the
# right. Click a wire, then its socket (or arrows and Enter: pick on the left,
# then on the right). A wrong socket buzzes and lets go.

# === create
super().on_create()
self.colors = ["#ff5a4f", "#ffd23f", "#4fa3ff", "#3ecf8e"]
self.left = random.sample(range(4), 4)       # the colour of each wire, top to bottom
self.right = random.sample(range(4), 4)      # the colour of each socket
self.joined = {}                          # wire row -> socket row
self.picked = None                        # a wire row in hand
self.cursor = 0
self.side = 0                             # keys: 0 choosing a wire, 1 a socket

# === step
super().on_step()
# Gone (Esc): nothing more to do.
if not self._alive:
    return
mx, my = gui_mouse()
row_at = lambda y: int((y - 92) // 50) if 92 <= y < 292 else None
choose = None
if mouse_check_pressed("left"):
    r = row_at(my)
    if r is not None and 150 <= mx <= 200:
        choose = (0, r)
    elif r is not None and 440 <= mx <= 490:
        choose = (1, r)
if keyboard_check_pressed("up"):
    self.cursor = (self.cursor - 1) % 4
if keyboard_check_pressed("down"):
    self.cursor = (self.cursor + 1) % 4
if keyboard_check_pressed("enter") or keyboard_check_pressed("space"):
    choose = (self.side, self.cursor)
if choose is not None:
    side, r = choose
    if side == 0 and r not in self.joined:
        self.picked, self.side = r, 1
        sound_play("click", volume=0.4)
    elif side == 1 and self.picked is not None and r not in self.joined.values():
        if self.colors[self.left[self.picked]] == self.colors[self.right[r]]:
            self.joined[self.picked] = r
            sound_play("plug", volume=0.5)
        else:
            sound_play("buzz", volume=0.5)
        self.picked, self.side = None, 0
if len(self.joined) == 4:
    job_finished(self)

# === draw_gui
super().on_draw_gui()
mx, my = gui_mouse()
for r in range(4):
    y = 117 + r * 50
    draw_set_color(self.colors[self.left[r]])
    draw_rect(150, y - 10, 200, y + 10)
    draw_set_color(self.colors[self.right[r]])
    draw_rect(440, y - 10, 490, y + 10)
    draw_set_color("#0b1620")
    draw_circle(465, y, 6)
for a, b in self.joined.items():
    draw_set_color(self.colors[self.left[a]])
    draw_line(200, 117 + a * 50, 440, 117 + b * 50, 6)
if self.picked is not None:
    draw_set_color(self.colors[self.left[self.picked]])
    draw_line(200, 117 + self.picked * 50, mx if mx > 200 else 440, my if mx > 200 else 117 + self.cursor * 50, 6)
# The keys' cursor: an arrow beside the wire (or, one in hand, the socket) Enter would pick.
draw_set_color("#ffd23f")
y = 117 + self.cursor * 50
if self.side == 0:
    draw_triangle(128, y - 9, 128, y + 9, 142, y)
else:
    draw_triangle(512, y - 9, 512, y + 9, 498, y)
