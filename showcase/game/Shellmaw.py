# object: Shellmaw
# sprite: shellmaw_walk
# parent: Boss
# depth: -5
# The Deep Cave's boss: a snail the size of a hut. It crawls at you, pulls
# into its shell — where the sword only clinks — and rolls across the cave,
# bouncing off the walls. When it comes out it is dizzy, and that is when
# the sword does double damage. Angry (below half), it rolls faster, hops
# as it bounces, and calls small snails to help.

# === create
super().on_create()
self.max_hp = self.hp = 20
self.name = "Shellmaw"
self.vx = 0
self.bounces = 0
self.called = 0             # small snails called so far (never more than 3)
self.corpse = None

# === step
p = player()
self.timer -= 1
fast = 1.3 if self.angry else 1.0
self.harmless = self.state in ("sleep", "dizzy", "dying")
if self.state == "sleep":
    set_anim(self, "shellmaw_walk", 0.2)
elif self.state == "roar":
    set_anim(self, "shellmaw_walk", 1.5)
    if self.timer <= 0:
        self.state = "crawl"
        self.timer = 150
elif self.state == "crawl":
    set_anim(self, "shellmaw_walk", fast)
    if p:
        self.facing = sign(p.x - self.x) or self.facing
    self.move_and_collide(self.facing * 0.5 * fast, 0)
    if self.timer <= 0:
        self.state = "hide"
        self.timer = 40
        sound_play("door", volume=0.6)
elif self.state == "hide":
    set_anim(self, "shellmaw_hide")
    hold_last_frame(self)
    if self.timer <= 0:
        self.state = "roll"
        self.bounces = 0
        self.vx = self.facing * 4.0 * fast
        self.angle = 0
        sound_play("roar", volume=0.5)
elif self.state == "roll":
    self.angle = getattr(self, "angle", 0) - sign(self.vx) * 14
    if self.timer % 3 == 0:
        effect("dust", self.x - sign(self.vx) * 30, self.y, scale=0.6)
    if self.move_and_collide(self.vx, 0):
        # A wall: back the other way, and the cave shakes.
        self.vx = -self.vx
        self.bounces += 1
        sound_play("boom", volume=0.6)
        camera_shake(6, 18)
        if self.angry and self.vy == 0:
            self.vy = -5.5            # angry, it hops off the wall
        if self.bounces >= (4 if self.angry else 3):
            self.state = "dizzy"
            self.timer = 80 if self.angry else 110
            self.facing = -sign(self.vx) or self.facing
            if self.angry and self.called < 3 and p:
                for side in (-1, 1):
                    s = instance_create(self.x + side * 50, self.y, "Snail")
                    s.facing = side
                self.called += 2
elif self.state == "dizzy":
    set_anim(self, "shellmaw_walk", 0)
    if self.timer % 12 == 0:
        particles(self.x + random.uniform(-20, 20), self.y - 100, count=3, color=["#ffe066", "#ffffff"], speed=1.2, size=3, life=20, direction=90, spread=180)
    if self.timer <= 0:
        self.state = "crawl"
        self.timer = 120
elif self.state == "dying":
    set_anim(self, "shellmaw_dead", 0.6)
    hold_last_frame(self)
    if self.timer % 10 == 0:
        effect("smoke", self.x + random.uniform(-50, 50), self.y - random.uniform(10, 80), scale=0.8)
        sound_play("boom", volume=0.4)
    self.image_alpha = max(0, self.timer / 60) if self.timer < 60 else 1
    if self.timer <= 0:
        boss_defeated(self)
        self.destroy()
        return
fall(self)
if self.state != "roll":
    self.image_xscale = -self.facing

# === draw
if self.state == "roll":
    # The shell, spinning about its middle, where the body would be.
    draw_sprite_ext("shellmaw_shell", 0, self.x, self.y - 27, 1, 1, getattr(self, "angle", 0), self.image_blend)   # its middle, half its 54 px up
else:
    draw_self()

# === collision Slash
if self.state in ("sleep", "dying") or self.hit_by is other:
    return
self.hit_by = other
if self.state in ("hide", "roll"):
    # The shell: the sword glances off.
    sound_play("hit", volume=0.4)
    particles(other.x, other.y, count=8, color="#ffe8a3", speed=3, size=2, life=10)
    return
self.hp -= 2 if self.state == "dizzy" else 1
self.flash("white", 6)
sound_play("hit")
hit_pause(4)
particles(other.x, other.y, count=10, color=["#ffffff", "#ffe8a3"], speed=3, size=2, life=14)
if not self.angry and self.hp <= self.max_hp // 2:
    self.angry = True
    self.image_blend = "#c8a0ff"
    sound_play("roar")
    camera_shake(6, 40)
    show_message("Shellmaw is furious!", 120)
if self.hp <= 0:
    self.hp = 0
    self.state = "dying"
    self.timer = 150
    music_stop()
    sound_play("roar")
    screen_flash("white", 20)
    hit_pause(20)
