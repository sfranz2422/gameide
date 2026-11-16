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
self.picked = False     # a group that's open, drawn lighter

# === step
if self.shown and mouse_check_pressed("left") and inside(self, mouse_x, mouse_y):
    global_vars.focus = self
    press(self)

# === draw_gui
if self.shown:
    over = inside(self, mouse_x, mouse_y)
    fill = "#8a7f72" if self.off else ("#3f9b4a" if self.hot else ("#8a6ae0" if self.picked else "#5a4a8a"))
    if over and not self.off:
        fill = "#4fb85b" if self.hot else ("#9a7af0" if self.picked else "#6e5aa8")
    draw_set_alpha(0.3)
    draw_set_color("#000000")
    draw_rect(self.x + 3, self.y + 4, self.x + self.wide + 3, self.y + self.high + 4)
    draw_set_alpha(1)
    draw_set_color(fill)
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high)
    draw_set_color("#ffffff")
    draw_set_alpha(0.22)
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high * 0.35)
    draw_set_alpha(1)
    draw_set_color("#1a1030")
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high, True)
    text(self.x + self.wide / 2, self.y + self.high / 2 - self.size * 0.62, self.words, "#ece6da" if self.off else INK, self.size, "center")
    draw_focus(self)
