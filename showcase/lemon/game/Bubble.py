# object: Bubble
# depth: -50
# What a customer thought, in a thought bubble with a word or two under it.
# It floats up and fades.

# === create
self.said = "perfect"
self.life = 150

# === step
sp = global_vars.speed if hasattr(global_vars, "speed") else 1
self.life -= sp
self.y -= 0.3 * sp
if self.life <= 0:
    self.destroy()

# === draw
a = min(1, self.life / 40)
draw_sprite_ext("bubbles", BUBBLE[self.said], self.x, self.y, 1, 1, 0, "white", a)
draw_set_alpha(a)
text(self.x, self.y + 34, VERDICT_WORDS[self.said], GOLD if self.said in ("perfect", "love") else INK, 13, "center")
draw_set_alpha(1)
