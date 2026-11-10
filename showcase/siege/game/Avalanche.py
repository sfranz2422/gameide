# object: Avalanche
# depth: -40
# An avalanche: a shadow grows where it was dropped, then the snow crashes down,
# hurting everything of theirs in the circle (towers and buildings a little).

# === create
self.side = 0
self.uid = next_uid()
self.puppet = False
self.power = 1.0            # the card's level makes it stronger (upgrade)
self.t = 0

# === step
if self.puppet or stopped():
    return
self.t += 1
if self.t == AVALANCHE_FALL:
    for o in enemies_of(self.side):
        if point_distance(self.x, self.y, o.x, o.y) <= AVALANCHE_R + o.radius:
            hurt(o, (AVALANCHE_TOWER if is_a(o, "Building") else AVALANCHE_DAMAGE) * self.power)
    sound_play("crash", volume=0.6)
    camera_shake(3, 10)
if self.t >= AVALANCHE_FALL + 20:
    self.destroy()

# === draw
k = min(1, self.t / AVALANCHE_FALL)
draw_set_alpha(0.25 + 0.25 * k)
draw_set_color("#6f8fa8")
draw_circle(self.x, self.y, AVALANCHE_R * k)
draw_set_alpha(1)
# The wave of snow rolls in from above and crashes down on the circle.
if self.t < AVALANCHE_FALL:
    draw_sprite_ext("avalanche", 0, self.x, self.y - 50 * (1 - k), 0.5 + 0.5 * k, 0.5 + 0.5 * k, 0, "white", 0.5 + 0.5 * k)
else:
    fade = 1 - (self.t - AVALANCHE_FALL) / 20
    draw_sprite_ext("avalanche", 0, self.x, self.y, 1, 1 - 0.4 * (1 - fade), 0, "white", fade)
