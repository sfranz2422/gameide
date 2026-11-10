# object: BeaverDam
# depth: 10
# A beaver dam across a bridge: the other side's troops on foot can't use that
# bridge while it stands, so they go round by the other lane (waypoint, dammed).
# It can't be knocked down; it washes away after a while. Your own troops cross.
# (Drawn by the game until the teacher's picture comes.)

# === create
self.side = 0
self.uid = next_uid()       # how the other player's game knows it again (Link)
self.puppet = False         # True in the other player's game: a copy, moved by Link
self.power = 1.0            # the card's level makes it last longer (upgrade)
self.life = DAM_LIFE

# === step
if not (self.puppet or stopped()):
    self.life -= 1
    if self.life <= 0:
        puff(self.x, self.y)
        self.destroy()

# === draw
fade = min(1, self.life / 60)
draw_set_alpha(fade)
draw_set_color("#7a4a22")
for k in range(4):
    draw_rect(self.x - 10 + k * 5, self.y - BRIDGE, self.x - 7 + k * 5, self.y + BRIDGE)
draw_set_color("#5a3418")
draw_line(self.x - 12, self.y - 8, self.x + 12, self.y + 6, 3)
draw_line(self.x - 12, self.y + 8, self.x + 12, self.y - 6, 3)
draw_set_color(SIDE_COLOR[self.side])
draw_rect(self.x - 12, self.y - BRIDGE - 3, self.x + 12, self.y - BRIDGE)
draw_set_alpha(1)
