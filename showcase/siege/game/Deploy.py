# object: Deploy
# depth: -20
# A card just played: a wind-up key turns where it was dropped, and a moment later
# its troops (or its wall, marble or glue) are there.

# === create
self.card = "soldiers"
self.side = 0
self.t = 0

# === step
if global_vars.over:
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
sound_play("pop", volume=0.5)
self.destroy()

# === draw
k = self.t / WIND_UP
draw_set_alpha(0.5)
draw_set_color(SIDE_COLOR[self.side])
draw_circle(self.x, self.y, 16)
draw_set_alpha(1)
draw_set_color("#ffd23f")
a = self.t * 0.25
draw_line(self.x - 8 * math.cos(a), self.y - 8 * math.sin(a), self.x + 8 * math.cos(a), self.y + 8 * math.sin(a), 3)
draw_set_color("#ffffff")
draw_circle(self.x, self.y, 16 * (1 - k) + 2, True)
