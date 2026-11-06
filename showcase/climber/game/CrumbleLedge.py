# object: CrumbleLedge
# parent: Ledge
# sprite: crumble
# Cracked ice. Stand on it too long and it breaks; a while later it's back. A
# little slippery, not as much as plain ice: you have to be quick here already.

# === create
super().on_create()
self.grip = SLIDY_ACCEL
self.half = CRUMBLE_W / 2
self.cracking = 0
self.away = 0

# === step
if self.broken:
    self.away -= 1
    if self.away <= 0:
        self.broken = False
        self.visible = True
        self.image_index = 0
        self.cracking = 0
elif self.stood > 0:
    self.cracking += 1
    self.image_index = 1
    if self.cracking == CRUMBLE_STAND // 2:
        sound_play("crack", volume=0.5)
    if self.cracking >= CRUMBLE_STAND:
        self.broken = True
        self.away = CRUMBLE_BACK
        self.image_index = 2
        particles(self.x, self.y + 8, 14, ["#dff6ff", "#8fd3ff"], 3, 5, 40, 0.25)
        sound_play("break", volume=0.6)
elif self.cracking > 0:
    self.cracking -= 1
    if self.cracking == 0:
        self.image_index = 0

# === draw
if self.broken:
    # Back soon: a faint outline says where.
    draw_sprite_ext("crumble", 0, self.x, self.y, 1, 1, 0, "white", 0.15 * (1 - self.away / CRUMBLE_BACK))
else:
    draw_self()
