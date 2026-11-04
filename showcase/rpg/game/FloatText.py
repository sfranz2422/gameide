# object: FloatText
# depth: -60000
# A number that rises and fades.

# === create
self.words = ""
self.colour = "#ffffff"
self.life = 40

# === step
self.y -= 0.8
self.life -= 1
if self.life <= 0:
    self.destroy()

# === draw
draw_set_font(None, 20)
draw_set_alpha(min(1, self.life / 15))
draw_set_color(self.colour)
draw_set_halign("center")
draw_text(self.x, self.y, self.words)
draw_set_halign("left")
draw_set_alpha(1)
