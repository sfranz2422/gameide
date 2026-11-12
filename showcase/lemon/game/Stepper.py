# object: Stepper
# A number to set, with - and + beside it: packs to buy, the recipe, the price,
# where to set up. Its `key` names which (the acts script). Left and right change
# it from the keys; a click or tap on - or + from the mouse.

# === create
self.key = ""
self.shown = True
self.off = False
self.wide = 300
self.high = 46
self.order = 0

# === step
if self.shown and mouse_check_pressed("left"):
    by = self.y + 10
    if by <= mouse_y <= by + 26:
        if self.x + self.wide - 132 <= mouse_x <= self.x + self.wide - 106:
            global_vars.focus = self
            change(self, -1)
        elif self.x + self.wide - 32 <= mouse_x <= self.x + self.wide - 6:
            global_vars.focus = self
            change(self, 1)

# === draw_gui
if self.shown:
    label, value, note = stepper_words(self.key)
    text(self.x + 6, self.y + 4, label, INK, 15)
    if note:
        text(self.x + 6, self.y + 25, note, DIM, 12)
    for bx, sign in ((self.x + self.wide - 132, "-"), (self.x + self.wide - 32, "+")):
        draw_set_color("#8a5a20")
        draw_rect(bx, self.y + 10, bx + 26, self.y + 36)
        draw_set_color("#2a1a08")
        draw_rect(bx, self.y + 10, bx + 26, self.y + 36, True)
        text(bx + 13, self.y + 11, sign, INK, 20, "center")
    text(self.x + self.wide - 69, self.y + 13, value, GOLD, 16, "center")
    draw_focus(self)
