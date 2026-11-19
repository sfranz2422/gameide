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
self.pic = None         # a sprite drawn in it, above its words (a battle's troops), and
self.count = None       # a number in its corner: drawn here, as the Battlefield's draw_gui is behind the buttons

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
    # Iron, slate and a deep green: Highmoor's plainer look (Cloverbrook's were painted wood).
    fill = "#6d6a64" if self.off else ("#3d6e3a" if self.hot else ("#7a6844" if self.picked else "#4a443b"))
    if over and not self.off:
        fill = "#4c8648" if self.hot else ("#8c7a52" if self.picked else "#5c554a")
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
    draw_set_color("#15130f")
    draw_rect(self.x, self.y, self.x + self.wide, self.y + self.high, True)
    tx = self.x + self.wide / 2
    tall = bool(self.icon) and self.high >= 56
    if tall:
        # A tall button (a battle's spells): the icon above, the words under it.
        icon(self.icon, tx, self.y + (self.high - 16) / 2, self.high - 28, 0.4 if self.off else 1)
        text(tx, self.y + self.high - 19, self.words, "#ece6da" if self.off else INK, self.size, "center")
    else:
        if self.icon:
            icon(self.icon, self.x + self.high / 2 + 2, self.y + self.high / 2, self.high - 10)
            tx += self.high / 2 - 4
        if self.pic:
            draw_sprite_ext(self.pic, 0, self.x + self.wide / 2, self.y + self.high - 22, 0.8, 0.8, 0, "white", 0.4 if self.off else 1)
            text(tx, self.y + self.high - 20, self.words, "#ece6da" if self.off else INK, self.size, "center")
        else:
            text(tx, self.y + self.high / 2 - self.size * 0.62, self.words, "#ece6da" if self.off else INK, self.size, "center")
    if self.count is not None:
        text(self.x + self.wide - 8, self.y + 4, str(self.count), DIM if self.off else GOLD, 16, "right")
    draw_focus(self)
