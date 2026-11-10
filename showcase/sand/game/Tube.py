# object: Tube
# sprite: tube
# A glass tube of sand. Its .sand is a list of colour letters from the bottom
# up; the Director made it with its level's sand. Tap it to pick it up, then tap
# another to pour into.

# === create
self.sand = []
self.hidden = 0          # how many layers from the bottom are still covered
self.home_x = self.x
self.home_y = self.y
self.picked = False
self.busy = False        # in the middle of a pour: no taps
self.drain = 0.0         # sand that's left logically but is still pouring out
self.pending = 0.0       # sand that's arrived logically but is still pouring in
self.drain_colour = None
self.shake = 0
self.image_speed = 0

# === mouse pressed left
tap(self)

# === step
if self.shake > 0:
    self.shake -= 1
    self.x = self.home_x + (4 if self.shake % 4 < 2 else -4)
    if self.shake == 0:
        self.x = self.home_x

# === draw
# The sand, then the glass over it. Everything turns with the tube, about its
# mouth, so a tipped tube's sand stays in it.
a = math.radians(self.image_angle)
cs, sn = math.cos(a), math.sin(a)
height = 0.0
for i, (colour, part) in enumerate(shown_layers(self.sand, self.drain, self.drain_colour, self.pending)):
    mid = SAND_BOTTOM - height - part * LAYER_H / 2
    # The middle of this layer, turned with the tube (image_angle turns anticlockwise).
    lx, ly = self.x + sn * mid, self.y + cs * mid
    hide = i < self.hidden
    pic = "sand_bottom" if i == 0 else "sand"
    draw_sprite_ext(pic, i % 3, lx, ly, 1, part, self.image_angle, HIDDEN_COLOUR if hide else COLOURS[colour])
    if part > 0.5:
        if hide:
            draw_sprite_ext("mark", 10, lx, ly, 1, 1, self.image_angle)
        elif global_vars.shapes:
            draw_sprite_ext("mark", "ROYGCBPKWN".index(colour), lx, ly, 1, 1, self.image_angle, "white", 0.85)
    height += part * LAYER_H
draw_sprite_ext("tube", 0, self.x, self.y, 1, 1, self.image_angle, "#fff6c0" if self.picked else "white")
if tube_done(self.sand) and not self.busy and self.hidden == 0:
    draw_sprite_ext("cork", 0, self.x, self.y, 1, 1, self.image_angle)
