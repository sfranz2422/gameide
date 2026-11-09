# object: ValveJob
# parent: Job
# Turn the valve (hold the mouse on it, or hold Space or Right) until the
# needle is in the green, and keep it there for a moment and a half. Too far,
# and the pressure blows off and drops back.

# === create
super().on_create()
self.pressure = 30.0
self.held = 0           # steps in the green, in a row
self.angle = 0

# === step
super().on_step()
# Gone (Esc): nothing more to do.
if not self._alive:
    return
mx, my = gui_mouse()
turning = keyboard_check("space") or keyboard_check("right") or (mouse_check("left") and point_distance(mx, my, 240, 180) < 70)
if turning:
    self.pressure += 1.1
    self.angle -= 6
else:
    self.pressure -= 0.45
self.pressure = max(0.0, self.pressure)
if self.pressure > 96:
    self.pressure = 30.0
    self.held = 0
    sound_play("buzz", volume=0.5)
if 60 <= self.pressure <= 76:
    self.held += 1
    if self.held % 15 == 1:
        sound_play("click", volume=0.25)
else:
    self.held = 0
if self.held >= 90:
    job_finished(self)

# === draw_gui
super().on_draw_gui()
# The wheel.
draw_set_color("#c0392b")
draw_circle(240, 180, 62)
draw_set_color("#1b2a38")
draw_circle(240, 180, 46)
draw_set_color("#c0392b")
for k in range(4):
    a = math.radians(self.angle + k * 45)
    draw_line(240 - 60 * math.cos(a), 180 - 60 * math.sin(a), 240 + 60 * math.cos(a), 180 + 60 * math.sin(a), 8)
# The gauge: green between 60 and 76.
draw_set_color("#0b1620")
draw_rect(380, 80, 420, 280)
draw_set_color("#2f7d4f")
draw_rect(380, 280 - 2 * 76, 420, 280 - 2 * 60)
draw_set_color("#ffd23f" if self.held else "#ffffff")
y = 280 - 2 * min(100, self.pressure)
draw_rect(372, y - 3, 428, y + 3)
draw_set_color("#3ecf8e")
draw_rect(140, 262, 140 + 340 * self.held / 90, 270)
