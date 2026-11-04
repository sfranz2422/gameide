# object: HeroFighter
# parent: Fighter
# A hero in a fight. Their numbers are the party's own, and go back to it.

# === create
super().on_create()
self.is_hero = True


def setup(hero):
    self.hero = hero
    self.key = hero["key"]
    self.name = HEROES[hero["key"]]["name"]
    self.max_hp, self.hp, self.mp = stat(hero, "hp"), hero["hp"], hero["mp"]
    self.sprite = f"fight_{hero['key']}"
    self.home_x = self.x
    self.after_hit()

self.setup = setup
self.stat_of = lambda name: stat(self.hero, name)
self.power = lambda: stat(self.hero, "atk")
self.guard = lambda: stat(self.hero, "dfn")
self.quickness = lambda: stat(self.hero, "spd")


def spend(n):
    self.mp -= n
    self.hero["mp"] = self.mp

self.spend = spend


def after_hit():
    self.hero["hp"] = self.hp
    self.image_index = 3 if self.hp <= 0 else 0

self.after_hit = after_hit
