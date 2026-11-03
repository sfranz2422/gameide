# object: Button
# sprite: button
# A panel with words on it. Its children say what the words are and, in their
# own Mouse Pressed events, what a click does.

# === create
self.words = ""
self.small = ""
self.off = False
self.depth = -100
self.image_speed = 0

# === draw_gui
over = collision_point(mouse_x, mouse_y, "Button") is self
draw_sprite_ext(self.sprite, 0, self.x, self.y, 1, 1, 0, "#808890" if self.off else "#ffffc8" if over else "white")
wide = 232 if self.sprite == "card" else 122
text(self.x + wide / 2, self.y + (7 if self.small else 11), self.words, "#a0a0a0" if self.off else INK, 16, "center")
if self.small:
    text(self.x + wide / 2, self.y + 30, self.small, "#a0a0a0" if self.off else GOLD, 14, "center")
