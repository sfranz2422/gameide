# object: Slash
# sprite: slash_box
# visible: no
# The sword's reach for a few steps of a swing: an invisible box in front
# of the hero. Enemies, walls of moss and the boss each have a Collision
# with Slash event that says what a hit does to them.

# === create
self.life = SLASH_TO - SLASH_FROM
self.damage = 1
self.owner = None

# === step
if self.owner is not None and instance_exists(self.owner):
    self.x = self.owner.x + self.owner.facing * SLASH_REACH
    self.y = self.owner.y - 20
self.life -= 1
if self.life <= 0:
    self.destroy()
