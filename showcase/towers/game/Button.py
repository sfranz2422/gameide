# object: Button
# sprite: button
# A panel with words on it. Its children say what the words are and, in their
# own Mouse Pressed events, what a click does. Set self.off to grey it out, and
# self.hidden to take it away.

# === create
self.words = ""
self.small = ""
self.off = False
self.hidden = False
self.depth = -100
self.image_speed = 0
self.picture = None
self.frame_of = 0

# === draw
if self.hidden:
    return
over = collision_point(mouse_x, mouse_y, "Button") is self
draw_sprite_ext(self.sprite, 0, self.x, self.y, 1, 1, 0, "#808890" if self.off else "#ffffc8" if over else "white")
if self.picture:
    draw_sprite_ext(self.picture, 0, self.x + 24, self.y + 28, 0.62, 0.62, 0)
left = self.x + (46 if self.picture else 10)
text(left, self.y + 8, self.words, "#a0a0a0" if self.off else INK, 14)
text(left, self.y + 30, self.small, "#a0a0a0" if self.off else GOLD, 13)
