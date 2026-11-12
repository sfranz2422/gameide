# object: Button
# sprite: button
# A panel with words on it. Its children say what the words are and, in their
# own Mouse Pressed events, what a click does.

# === create
self.words = ""
self.small = ""
self.off = False
self.depth = -100
self.wide = 150         # the button picture's width; a LevelCard is wider
self.high = 44
self.size = 17
self.image_speed = 0

# === draw_gui
over = collision_point(mouse_x, mouse_y, "Button") is self
draw_sprite_ext(self.sprite, 0, self.x, self.y, 1, 1, 0, "#7a7080" if self.off else "#fff2c0" if over else "white")
wide = self.wide
text(self.x + wide / 2, self.y + (8 if self.small else 11), self.words, "#b0a8b8" if self.off else INK, self.size, "center")
if self.small:
    text(self.x + wide / 2, self.y + 32, self.small, "#b0a8b8" if self.off else GOLD, 15, "center")
# The keys' cursor (_5keys.py): a gold box round the one Space would press.
if keyed() and getattr(global_vars, "focus", None) is self:
    draw_focus(self.x - 3, self.y - 3, self.x + wide + 3, self.y + self.high + 3)
