# object: Bee
# sprite: bee_fly
# parent: Enemy
# Hovers near its home until the hero comes close, then lines up and
# dives at where the hero was, and flies home again.

# === create
super().on_create()
self.hp = 1
self.home_x, self.home_y = self.x, self.y - 24
self.y = self.home_y
self.t = random.random() * 100
self.state = "hover"
self.timer = 0
self.vx = 0
self.corpse = "bee_hit"

# === step
p = player()
self.t += 1
self.timer -= 1
if self.knock:
    self.move_and_collide(self.knock, 0)
    self.knock = approach(self.knock, 0, 0.3)
if self.state == "hover":
    set_anim(self, "bee_fly")
    tx = self.home_x + math.cos(self.t * 0.03) * 24
    ty = self.home_y + math.sin(self.t * 0.07) * 8
    self.vx = (tx - self.x) * 0.08
    self.move_and_collide(self.vx, (ty - self.y) * 0.08)
    if p and point_distance(self.x, self.y, p.x, p.y - 20) < 110:
        self.state = "aim"
        self.timer = 36
elif self.state == "aim":
    set_anim(self, "bee_attack")
    self.x += math.sin(self.t) * 0.6           # a shiver before the dive
    self.vx = sign(p.x - self.x) if p else self.vx
    if self.timer <= 0 and p:
        d = point_direction(self.x, self.y, p.x, p.y - 18)
        self.dx = math.cos(math.radians(d)) * 3.4
        self.dy = -math.sin(math.radians(d)) * 3.4
        self.state = "dive"
        self.timer = 40
elif self.state == "dive":
    if self.move_and_collide(self.dx, self.dy) or self.timer <= 0:
        self.state = "home"
    self.vx = self.dx
elif self.state == "home":
    set_anim(self, "bee_fly")
    d = point_direction(self.x, self.y, self.home_x, self.home_y)
    self.vx = math.cos(math.radians(d)) * 1.2
    self.move_and_collide(self.vx, -math.sin(math.radians(d)) * 1.2)
    if point_distance(self.x, self.y, self.home_x, self.home_y) < 4:
        self.state = "hover"
if abs(self.vx) > 0.05:
    self.facing = sign(self.vx)
self.image_xscale = -self.facing
