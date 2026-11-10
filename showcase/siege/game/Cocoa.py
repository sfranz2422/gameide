# object: Cocoa
# depth: -40
# Hot cocoa: a warm glow that heals your own troops in the circle, once.

# === create
self.side = 0
self.uid = next_uid()
self.puppet = False
self.t = 0

# === step
if self.puppet or stopped():
    return
self.t += 1
if self.t == 1:
    for u in instances("Unit"):
        if u.side == self.side and point_distance(self.x, self.y, u.x, u.y) <= COCOA_R + u.radius:
            u.hp = min(u.max_hp, u.hp + COCOA_HEAL)
    sound_play("pop", volume=0.5)
if self.t >= 40:
    self.destroy()

# === draw
k = self.t / 40
draw_set_alpha(0.35 * (1 - k))
draw_set_color("#ffcf8a")
draw_circle(self.x, self.y, COCOA_R)
draw_set_alpha(1)
draw_sprite_ext("mug", 0, self.x, self.y - 10 * k, 1.6, 1.6, 0, "white", 1 - k)
draw_sprite_ext("sparkle", 0, self.x, self.y - 16 - 10 * k, 0.6, 0.6, 0, "white", 1 - k)
