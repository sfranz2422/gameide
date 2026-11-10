# object: Pour
# depth: -20
# One pour, on screen. The sand has already moved (Director.pour_from changed
# both tubes' .sand at once, so undo and the win always see the truth); this
# carries the tube over, tips it, lets the sand run and brings it back.

# === create
self.src = None
self.dst = None
self.k = 0               # layers going
self.colour = None
self.phase = "go"
self.t = 0
self.from_x = self.from_y = 0
self.to_x = self.to_y = 0
self.tilt = 0

# === step
s, d = self.src, self.dst
self.t += 1
if self.phase == "go":
    f = ease("in_out_quad", min(1, self.t / GO_STEPS))
    s.x = lerp(self.from_x, self.to_x, f)
    s.y = lerp(self.from_y, self.to_y, f)
    s.image_angle = self.tilt * f
    if self.t >= GO_STEPS:
        self.phase, self.t = "flow", 0
        sound_play("pour", volume=0.5)
elif self.phase == "flow":
    run = min(self.k, self.t / FLOW_STEPS)
    s.drain = self.k - run
    d.pending = self.k - run
    if self.t % 6 == 0:
        effect("dust", d.x, surface_y(d), COLOURS[self.colour], 0.6)
    if run >= self.k:
        s.drain = d.pending = 0
        self.phase, self.t = "back", 0
        if tube_done(d.sand):
            effect("sparkle", d.x, d.y + 60, None, 1.4)
            sound_play("cork", volume=0.7)
else:
    f = ease("in_out_quad", min(1, self.t / GO_STEPS))
    s.x = lerp(self.to_x, s.home_x, f)
    s.y = lerp(self.to_y, s.home_y, f)
    s.image_angle = self.tilt * (1 - f)
    if self.t >= GO_STEPS:
        s.x, s.y, s.image_angle = s.home_x, s.home_y, 0
        s.busy = d.busy = False
        s.depth = 0
        self.destroy()

# === draw
# The falling sand: a stream from the tipped tube's mouth down to where it lands,
# with a few grains loose around it.
if self.phase == "flow" and self.src.drain > 0:
    top_y, bottom_y = self.src.y, surface_y(self.dst)
    draw_set_color(COLOURS[self.colour])
    draw_rect(self.dst.x - 3, top_y, self.dst.x + 3, bottom_y)
    for g in range(10):
        gy = top_y + (g * 17 + self.t * 7) % max(1, bottom_y - top_y)
        draw_rect(self.dst.x - 5 + (g * 7) % 10, gy, self.dst.x - 3 + (g * 7) % 10, gy + 2)
