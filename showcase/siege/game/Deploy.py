# object: Deploy
# depth: -20
# A card just played: snowflakes swirl where it was dropped, and a moment later
# its troops (or its wall, snowball or ice) are there.

# === create
self.card = "kids"
self.side = 0
self.uid = next_uid()       # how the other player's game knows it again (Link)
self.puppet = False         # True in the other player's game: a copy, moved by Link
self.t = 0

# === step
if self.puppet or stopped():
    return
self.t += 1
if self.t < WIND_UP:
    return
c = CARDS[self.card]
n = c["count"]
for k in range(n):
    # A squad stands in a little triangle.
    a = 2 * math.pi * k / n
    r = 0 if n == 1 else 12
    o = instance_create(self.x + math.cos(a) * r, self.y + math.sin(a) * r, c["object"])
    o.side = self.side
    upgrade(o, level_of(self.side, self.card))
sound_play("pop", volume=0.5)
puff(self.x, self.y)
self.destroy()

# === draw
k = self.t / WIND_UP
draw_set_alpha(0.35)
draw_set_color(SIDE_COLOR[self.side])
draw_circle(self.x, self.y, 16)
draw_set_alpha(1)
draw_set_color("#ffffff")
draw_circle(self.x, self.y, 16 * (1 - k) + 2, True)
# A swirl of snowflakes, turning as the troops gather.
draw_sprite_ext("swirl", 0, self.x, self.y, 0.6 + 0.4 * k, 0.6 + 0.4 * k, self.t * 8)
