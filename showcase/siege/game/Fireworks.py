# object: Fireworks
# depth: -40
# Fireworks: a burst every few steps somewhere in a wide circle, each hurting
# everything of theirs near it (towers and buildings a little). Where each burst
# goes comes from .seed (burst_at), so the other player's game, sent the seed,
# draws the same bursts in the same places.

# === create
self.side = 0
self.uid = next_uid()
self.puppet = False
self.power = 1.0            # the card's level makes it stronger (upgrade)
self.t = 0
self.seed = random.randint(0, 99999)

# === step
if self.puppet or stopped():
    return
self.t += 1
if self.t % FIREWORKS_EVERY == 0 and self.t // FIREWORKS_EVERY <= FIREWORKS_BURSTS:
    bx, by = burst_at(self, self.t // FIREWORKS_EVERY - 1)
    for o in enemies_of(self.side):
        if point_distance(bx, by, o.x, o.y) <= FIREWORKS_BURST_R + o.radius:
            hurt(o, (FIREWORKS_TOWER if is_a(o, "Building") else FIREWORKS_DAMAGE) * self.power)
    sound_play("pop", volume=0.35)
if self.t >= FIREWORKS_EVERY * FIREWORKS_BURSTS + 20:
    self.destroy()

# === draw
draw_set_alpha(0.15)
draw_set_color(SIDE_COLOR[self.side])
draw_circle(self.x, self.y, FIREWORKS_R)
draw_set_alpha(1)
colors = ["#ff4f4f", "#ffd23f", "#3ecf8e", "#5fb0ff", "#ff7ad9"]
for k in range(min(FIREWORKS_BURSTS, self.t // FIREWORKS_EVERY)):
    age = self.t - (k + 1) * FIREWORKS_EVERY
    if age < 16:
        bx, by = burst_at(self, k)
        draw_sprite_ext("sparkle", 0, bx, by, 0.4 + age / 16, 0.4 + age / 16, k * 40, colors[k % len(colors)], 1 - age / 16)
