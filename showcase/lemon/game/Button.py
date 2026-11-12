# object: Button
# A panel with words on it. What it does is its `act` (and `arg`), in the acts
# script, so a click, a tap and Space do the same thing.

# === create
self.words = ""
self.act = ""
self.arg = None
self.off = False
self.shown = True
self.wide = 200
self.high = 44
self.size = 18
self.order = 0
self.hot = False        # the big button on a screen, drawn green

# === step
if self.shown and mouse_check_pressed("left") and inside(self, mouse_x, mouse_y):
    global_vars.focus = self
    press(self)

# === draw_gui
if self.shown:
    over = inside(self, mouse_x, mouse_y)
    fill = "#5d5a52" if self.off else ("#3f9b4a" if self.hot else "#8a5a20")
    if over and not self.off:
        fill = "#4fb85b" if self.hot else "#a8732c"
    draw_set_color(fill)
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high)
    draw_set_color("#2a1a08")
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high, True)
    text(self.x + self.wide / 2, self.y + self.high / 2 - self.size * 0.62, self.words, "#a8a294" if self.off else INK, self.size, "center")
    draw_focus(self)
