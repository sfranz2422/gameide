# object: Button
# depth: -100
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
self.stars = None       # a day's best stars, shown along its bottom (the map's day buttons)

# === step
if self.shown and mouse_check_pressed("left") and inside(self, mouse_x, mouse_y):
    global_vars.focus = self
    press(self)

# === draw_gui
if self.shown:
    over = inside(self, mouse_x, mouse_y)
    fill = "#5d5a52" if self.off else ("#3f9b4a" if self.hot else "#b0482a")
    if over and not self.off:
        fill = "#4fb85b" if self.hot else "#cc5a36"
    draw_set_color(fill)
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high)
    draw_set_color("#2a1208")
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high, True)
    text(self.x + self.wide / 2, self.y + self.high / 2 - self.size * 0.62, self.words, "#a8a294" if self.off else INK, self.size, "center")
    if self.stars is not None:
        # Drawn here, not by the map: the buttons draw over the map, and hid its stars.
        stars_row(self.x + self.wide / 2 - 34, self.y + self.high - 22, self.stars, 0.6)
    draw_focus(self)
