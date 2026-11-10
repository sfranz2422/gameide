# object: BeaverDam
# depth: 10
# A beaver dam across a bridge: the other side's troops on foot can't use that
# bridge while it stands, so they go round by the other lane (waypoint, dammed).
# It can't be knocked down; it washes away after a while. Your own troops cross.

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
draw_sprite_ext("beaver_" + TEAM[self.side], 0, self.x, self.y, 1, 1, 0, "white", min(1, self.life / 60))
