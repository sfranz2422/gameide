# object: IcePatch
# depth: 30
# A patch of slippery ice: the other side's troops on foot are slowed while on
# it (Unit checks). It melts after a few seconds.

# === create
self.side = 0
self.uid = next_uid()       # how the other player's game knows it again (Link)
self.puppet = False         # True in the other player's game: a copy, moved by Link
self.life = ICE_LIFE

# === step
if not (self.puppet or stopped()):
    self.life -= 1
    if self.life <= 0:
        self.destroy()

# === draw
draw_sprite_ext("ice_patch", 0, self.x, self.y, 1, 1, 0, "white", 0.85 * min(1, self.life / 60))
draw_set_color(SIDE_COLOR[self.side])
draw_circle(self.x, self.y, ICE_R, True)
