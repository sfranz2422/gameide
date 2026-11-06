# object: Snowball
# sprite: snowball
# depth: -20
# A thrown snowball: it arcs down, and bursts on anything it meets.

# === create
self.vx = 0
self.vy = 0
self.life = 150
self.image_speed = 0

# === step
self.vy += SNOW_GRAVITY
self.x += self.vx
self.y += self.vy
self.image_index = 1 if abs(self.vx) > 5 else 0
self.image_xscale = 1 if self.vx >= 0 else -1
hit = self.x < WALL_L or self.x > WALL_R
for ledge in instances("Ledge"):
    if not ledge.broken and abs(self.x - ledge.x) < ledge.half and ledge.y - 2 <= self.y <= ledge.y + 16:
        hit = True
self.life -= 1
if hit:
    instance_create(self.x, self.y, "Splat")
    sound_play("splat", volume=0.35)
    self.destroy()
elif self.life <= 0 or self.y > view_y + VIEW_H + 100 or abs(self.x - (view_x + VIEW_W / 2)) > VIEW_W:
    self.destroy()
