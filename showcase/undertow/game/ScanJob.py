# object: ScanJob
# parent: Job
# Stand on the scanner and hold still while it scans: any arrow (or WASD)
# starts it again.

# === create
super().on_create()
self.scanned = 0

# === step
super().on_step()
# Gone (Esc): nothing more to do.
if not self._alive:
    return
moved = any(keyboard_check(k) for k in ("left", "right", "up", "down", "a", "d", "w", "s"))
if moved:
    if self.scanned > 10:
        sound_play("buzz", volume=0.4)
    self.scanned = 0
else:
    self.scanned += 1
    if self.scanned % 30 == 1:
        sound_play("beep", volume=0.3)
if self.scanned >= 180:
    job_finished(self)

# === draw_gui
super().on_draw_gui()
# A body outline, and the scan line going over it.
draw_set_color("#1d5a44")
draw_circle(320, 110, 22)
draw_rect(296, 136, 344, 220)
draw_rect(282, 140, 294, 200)
draw_rect(346, 140, 358, 200)
y = 86 + (self.scanned * 3) % 140
draw_set_color("#7dffc4")
draw_set_alpha(0.8)
draw_rect(262, y, 378, y + 4)
draw_set_alpha(1)
draw_set_color("#0b1620")
draw_rect(160, 248, 480, 260)
draw_set_color("#3ecf8e")
draw_rect(160, 248, 160 + 320 * self.scanned / 180, 260)
words(VIEW_W / 2, 270, "Hold still...", 14, "#cfeaff", "center")
