# object: Tusk
# sprite: tusk_idle
# parent: Enemy
# depth: -5
# The Thornwood's boss: a boar the size of a cart. It walks at you, digs
# in, and charges until it hits a wall — which stuns it, and that is when
# the sword does double damage. Below half health it gets angry: faster,
# and its crashes shake rocks loose from the ceiling.

# === create
super().on_create()
self.max_hp = self.hp = 16
self.name = "Tusk, the Thornback"
self.state = "sleep"        # until the hero walks into the arena (BossTrigger)
self.timer = 0
self.angry = False
place_key(self)
if boss_beaten():
    self.destroy()

# === step
p = player()
self.timer -= 1
fast = 1.4 if self.angry else 1.0
self.harmless = self.state in ("sleep", "stunned", "dying")
if self.state == "sleep":
    set_anim(self, "tusk_idle", 0.5)
elif self.state == "roar":
    set_anim(self, "tusk_idle", 2)
    if self.timer <= 0:
        self.state = "walk"
        self.timer = 70
elif self.state == "walk":
    set_anim(self, "tusk_walk", fast)
    if p:
        self.facing = sign(p.x - self.x) or self.facing
    self.move_and_collide(self.facing * 0.9 * fast, 0)
    if self.timer <= 0:
        self.state = "windup"
        self.timer = int(40 / fast)
elif self.state == "windup":
    set_anim(self, "tusk_attack")
    if self.timer % 6 == 0:
        self.flash("red", 3)
        effect("dust", self.x - self.facing * 30, self.y, scale=1.2)
    if self.timer <= 0:
        self.state = "charge"
        sound_play("roar", volume=0.6)
elif self.state == "charge":
    set_anim(self, "tusk_run", 1.6)
    if self.move_and_collide(self.facing * 5.0 * fast, 0):
        # Into the wall.
        self.state = "stunned"
        self.timer = 80 if self.angry else 110
        sound_play("boom")
        camera_shake(10, 30)
        effect("explosion", self.x + self.facing * 36, self.y - 30, color="#a0896b", scale=0.8)
        if self.angry and p:
            for i in range(4):
                instance_create(p.x + random.uniform(-110, 110), p.y - 170, "Rock")
    elif self.timer % 4 == 0:
        effect("dust", self.x - self.facing * 36, self.y, scale=0.8)
elif self.state == "stunned":
    set_anim(self, "tusk_idle", 0.4)
    if self.timer % 12 == 0:
        particles(self.x + random.uniform(-14, 14), self.y - 92, count=3, color=["#ffe066", "#ffffff"], speed=1.2, size=3, life=20, direction=90, spread=180)
    if self.timer <= 0:
        self.state = "walk"
        self.timer = 50
elif self.state == "dying":
    set_anim(self, "tusk_die", 0.6)
    if self.image_index >= 3:
        self.image_index = 3
        self.image_speed = 0
    if self.timer % 10 == 0:
        effect("explosion", self.x + random.uniform(-40, 40), self.y - random.uniform(10, 80), scale=0.6)
        sound_play("boom", volume=0.4)
    self.image_alpha = max(0, self.timer / 60) if self.timer < 60 else 1
    if self.timer <= 0:
        boss_defeated(self)
        self.destroy()
        return
fall(self, half_width=36)
self.image_xscale = -self.facing

# === collision Slash
if self.state in ("sleep", "dying") or self.hit_by is other:
    return
self.hit_by = other
self.hp -= 2 if self.state == "stunned" else 1
self.flash("white", 6)
sound_play("hit")
hit_pause(4)
particles(other.x, other.y, count=10, color=["#ffffff", "#ffe8a3"], speed=3, size=2, life=14)
if not self.angry and self.hp <= self.max_hp // 2:
    self.angry = True
    self.image_blend = "#ffb0a0"
    sound_play("roar")
    camera_shake(6, 40)
    show_message("Tusk is furious!", 120)
if self.hp <= 0:
    self.hp = 0
    self.state = "dying"
    self.timer = 150
    music_stop()
    sound_play("roar")
    screen_flash("white", 20)
    hit_pause(20)
