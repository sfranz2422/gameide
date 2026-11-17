# object: Button
# depth: -1000000
# A panel with words on it, on the screen (not the map). In front of everything,
# the Farm's bar and windows included (they draw at -100000). What it does is its `act`
# (and `arg`), in the acts script, so a click, a tap and Space do the same thing.

# === create
self.words = ""
self.act = ""
self.arg = None
self.off = False
self.shown = True
self.wide = 200
self.high = 44
self.size = 16
self.order = 0
self.hot = False        # the button to press, drawn green
self.picked = False     # a window that's open, drawn lighter
self.in_panel = False   # part of a window: goes when it closes
self.icon = None        # an icon drawn at its left

# === step
if self.shown and mouse_check_pressed("left"):
    sx, sy = gui_mouse()
    if inside(self, sx, sy):
        global_vars.focus = self
        press(self)

# === draw_gui
if self.shown:
    sx, sy = gui_mouse()
    over = inside(self, sx, sy)
    fill = "#8a7f72" if self.off else ("#3f9b4a" if self.hot else ("#c08a3a" if self.picked else "#8a5226"))
    if over and not self.off:
        fill = "#4fb85b" if self.hot else ("#d49a48" if self.picked else "#a0622e")
    draw_set_alpha(0.3)
    draw_set_color("#000000")
    draw_rect(self.x + 3, self.y + 4, self.x + self.wide + 3, self.y + self.high + 4)
    draw_set_alpha(1)
    draw_set_color(fill)
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high)
    draw_set_color("#ffffff")
    draw_set_alpha(0.2)
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high * 0.35)
    draw_set_alpha(1)
    draw_set_color("#3a1e08")
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high, True)
    tx = self.x + self.wide / 2
    if self.icon:
        icon(self.icon, self.x + self.high / 2 + 2, self.y + self.high / 2, self.high - 10)
        tx += self.high / 2 - 4
    text(tx, self.y + self.high / 2 - self.size * 0.62, self.words, "#ece6da" if self.off else INK, self.size, "center")
    draw_focus(self)
