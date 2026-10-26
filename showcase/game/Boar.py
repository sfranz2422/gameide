# object: Boar
# sprite: boar_walk
# parent: Enemy
# Trots back and forth. If it sees the hero ahead on its own level, it
# stops, stamps, and charges — and can't stop until something stops it.

# === create
super().on_create()
self.hp = 3
self.state = "walk"
self.timer = 0
self.look = "boar"          # its sprites: boar_walk, boar_idle… (Hog has its own)
self.walk_speed = 0.6
self.charge_speed = 3.2
self.corpse = "boar_hit"

# === step
p = player()
if self.knock:
    self.move_and_collide(self.knock, 0)
    self.knock = approach(self.knock, 0, 0.3)
self.timer -= 1
if self.state == "walk":
    set_anim(self, self.look + "_walk")
    if ledge_ahead(self, self.facing, 16):
        self.facing = -self.facing
    self.move_and_collide(self.facing * self.walk_speed, 0)
    # It sees the hero ahead, near its own level, with nothing solid in between.
    if (p and abs(p.y - self.y) < 24 and abs(p.x - self.x) < 150 and sign(p.x - self.x) == self.facing
            and collision_line(self.x, self.y - 10, p.x, p.y - 10) is None):
        self.state = "alert"
        self.timer = 30
        self.flash("red", 4)
elif self.state == "alert":
    set_anim(self, self.look + "_idle")
    if self.timer % 8 == 0:
        effect("dust", self.x - self.facing * 10, self.y, scale=0.5)
    if self.timer <= 0:
        self.state = "charge"
        self.timer = 120
elif self.state == "charge":
    set_anim(self, self.look + "_run", 1.5)
    if ledge_ahead(self, self.facing, 16) or self.timer <= 0 or self.move_and_collide(self.facing * self.charge_speed, 0):
        self.state = "rest"
        self.timer = 50
        effect("dust", self.x + self.facing * 12, self.y, scale=0.8)
    elif self.timer % 6 == 0:
        effect("dust", self.x - self.facing * 12, self.y, scale=0.4)
elif self.state == "rest":
    set_anim(self, self.look + "_idle")
    if self.timer <= 0:
        self.state = "walk"
fall(self)
self.image_xscale = -self.facing
