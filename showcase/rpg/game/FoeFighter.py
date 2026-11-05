# object: FoeFighter
# parent: Fighter
# A monster in a fight, its numbers from FOES.

# === create
super().on_create()


def setup(key):
    data = FOES[key]
    self.key = key
    self.name = data["name"]
    self.max_hp = self.hp = data["hp"]
    self.sprite = f"foe_{key}"
    self.turns = 0
    self.charged = False
    self.home_x = self.x

self.setup = setup


def tint(colour):
    self.image_blend = colour or "#ffffff"

self.tint = tint
self.power = lambda: FOES[self.key]["atk"]
self.guard = lambda: FOES[self.key]["dfn"]
self.quickness = lambda: FOES[self.key]["spd"]


def after_hit():
    if self.hp <= 0:
        effect("smoke", self.x, self.y - 30)
        self.visible = False

self.after_hit = after_hit
