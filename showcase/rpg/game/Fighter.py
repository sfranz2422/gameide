# object: Fighter
# Someone in a fight. HeroFighter and FoeFighter say where their numbers come from.

# === create
self.hp = self.max_hp = 1
self.mp = 0
self.name = ""
self.key = ""
self.guarding = False
self.is_hero = False
self.home_x = self.x
self.depth = -self.y
self.image_speed = 0


def lunge():
    step = -24 if self.is_hero else 24
    tween(self, "x", self.home_x + step, 8, "out_quad")
    self.alarm[0] = 10

self.lunge = lunge


def hurt(n):
    self.hp = max(0, self.hp - n)
    self.flash("white", 10)
    t = instance_create(self.x, self.y - 60, "FloatText")
    t.words, t.colour = str(n), "#ffffff"
    self.after_hit()

self.hurt = hurt
self.after_hit = lambda: None


def heal(n):
    self.hp = min(self.max_hp, self.hp + n)
    self.flash("green", 15)
    t = instance_create(self.x, self.y - 60, "FloatText")
    t.words, t.colour = str(n), "#7dff9a"
    self.after_hit()

self.heal = heal

# === alarm 0
tween(self, "x", self.home_x, 8, "out_quad")
