# object: Player
# sprite: hero_idle
# depth: -10

# === create
# Back at the last checkpoint after dying; otherwise where the room put us.
cp = global_vars.checkpoint
if cp and cp[0] == global_vars.level:
    self.x, self.y = cp[1], cp[2]
global_vars.hp = global_vars.max_hp
self.vx = 0
self.vy = 0
self.facing = 1
self.state = "move"        # "move", "attack", "hurt" or "dead"
self.on_ground = True
self.coyote = 0            # steps in which a jump still works after walking off a ledge
self.buffer = 0            # steps in which a jump pressed just before landing still happens
self.air_jumps = 0         # the relic gives one jump in the air
self.swing = 0             # steps into the current sword swing
self.combo = 0             # 0: the first swing, 1: the second
self.queued = False        # attack pressed during a swing: swing again straight after
self.invincible = 0
self.hurt_steps = 0
self.drop = 0              # steps of falling through planks (Down while on one)
self.safe = (self.x, self.y)   # last firm ground, for climbing out of water
self.dust = 0

# === step
global_vars.frames += 1
if self.invincible > 0:
    self.invincible -= 1
    self.image_alpha = 0.35 if self.invincible % 8 < 4 else 1
else:
    self.image_alpha = 1

# ---- dead: fall where we are and wait for the alarm
if self.state == "dead":
    fall(self)
    hold_last_frame(self)
    return

move = input_x()
if self.drop > 0:
    self.drop -= 1

# ---- running
if self.state == "hurt":
    self.hurt_steps -= 1
    self.vx = approach(self.vx, 0, 0.1)
    if self.hurt_steps <= 0:
        self.state = "move"
elif self.state == "attack" and self.on_ground:
    self.vx = approach(self.vx, 0, DECEL)        # a swing on the ground plants your feet
else:
    self.vx = approach(self.vx, move * RUN_SPEED, ACCEL if move else DECEL)
    if move != 0 and self.state != "attack":
        self.facing = move

# ---- jumping
if jump_pressed():
    self.buffer = JUMP_BUFFER
elif self.buffer > 0:
    self.buffer -= 1
on_plank = self.on_ground and self.place_free(self.x, self.y + 1)
if self.state in ("move", "attack") and self.buffer > 0:
    if input_down() and on_plank:
        self.drop = 12                            # Down + jump: through the plank
        self.buffer = 0
    elif self.on_ground or self.coyote > 0:
        self.vy = -JUMP_SPEED
        self.buffer = self.coyote = 0
        sound_play("jump", volume=0.6)
        effect("dust", self.x, self.y)
    elif self.air_jumps > 0:
        self.vy = -AIR_JUMP_SPEED
        self.air_jumps -= 1
        self.buffer = 0
        sound_play("jump", volume=0.6)
        particles(self.x, self.y, count=10, color=["#bff6ff", "#ffffff"], speed=1.6, size=2, life=18, direction=270, spread=120)
if self.vy < JUMP_CUT and not jump_held() and self.state != "hurt":
    self.vy = JUMP_CUT                            # a short tap is a short hop
if on_plank and input_down() and self.state == "move" and keyboard_check_pressed("down"):
    self.drop = 12

# ---- the sword
if attack_pressed():
    if self.state == "move":
        self.state = "attack"
        self.combo = 0
        self.swing = 0
        set_anim(self, "hero_attack")
        sound_play("swing", volume=0.7)
    elif self.state == "attack" and self.swing > SLASH_FROM:
        self.queued = True
if self.state == "attack":
    self.swing += 1
    if self.swing == SLASH_FROM:
        s = instance_create(self.x + self.facing * SLASH_REACH, self.y - 20, "Slash")
        s.owner = self
        s.image_xscale = self.facing
    if self.swing >= SWING_STEPS:
        if self.queued and self.combo == 0:
            self.combo = 1                        # the second swing, the other way up
            self.swing = 0
            self.queued = False
            set_anim(self, "hero_attack2")
            sound_play("swing", volume=0.7)
        else:
            self.state = "move"
            self.queued = False

# ---- moving: sideways, then down (landing on ground or planks)
if self.vx != 0 and self.move_and_collide(self.vx, 0):
    self.vx = 0
was_on_ground = self.on_ground
landed = fall(self, through_planks=self.drop > 0)
self.on_ground = standing(self) if self.drop == 0 else not self.place_free(self.x, self.y + 1)
if self.on_ground:
    self.coyote = COYOTE
    self.air_jumps = 1 if "double_jump" in global_vars.abilities else 0
    if not self.place_free(self.x, self.y + 1):
        self.safe = (self.x, self.y)
elif self.coyote > 0:
    self.coyote -= 1
if landed and not was_on_ground:
    effect("dust", self.x, self.y, scale=0.7)

# ---- how we look
self.image_xscale = self.facing
if self.state in ("move", "hurt"):
    if not self.on_ground:
        set_anim(self, "hero_jump" if self.vy < 0 else "hero_fall")
        hold_last_frame(self)
    elif abs(self.vx) > 0.4 and move != 0:
        set_anim(self, "hero_run")
        self.dust += 1
        if self.dust % 18 == 0:
            effect("dust", self.x - self.facing * 6, self.y, scale=0.4)
    else:
        set_anim(self, "hero_idle")

# Fell out of the world (shouldn't happen, but never leave the hero lost)
if self.y > room_height + 64:
    hurt_player(1, self.x)
    self.x, self.y = self.safe
    self.vy = 0

# === collision Enemy
if other.hp > 0 and not getattr(other, "harmless", False):
    hurt_player(other.contact_damage, other.x)

# === collision Water
if self.state != "dead" and self.invincible == 0:
    sound_play("splash")
    particles(self.x, other.y - 16, count=20, color=["#8fd3ff", "#ffffff"], speed=2.5, size=2, life=24, direction=90, spread=70, gravity=0.15)
    hurt_player(1, self.x)
    if self.state != "dead":
        self.x, self.y = self.safe
        self.vx = self.vy = 0
        self.state = "move"

# === alarm 0
# Dead for long enough: back to the last checkpoint.
global_vars.deaths += 1
room_restart()
