# object: Player
# parent: Climber
# You: runs, jumps and throws snowballs, lands on ledges from above, and keeps
# your best height.

# === create
super().on_create()
self.pic = save_get("climber", "red")
self.sprite = "climber_" + self.pic
self.vx = 0
self.vy = 0
self.on = None          # the ledge you're standing on, or None in the air
self.coyote = 0
self.buffer = 0
self.throw_wait = 0
self.throwing = 0
self.run_t = 0
self.top_of_fall = self.y
self.best = save_get("best", 0)
global_vars.best = self.best
global_vars.height = 0
global_vars.player = self
camera_follow(self, 0.15)
touch_controls(True, ("space", "x"))

# === step
left = keyboard_check("left") or keyboard_check("a")
right = keyboard_check("right") or keyboard_check("d")
jump_held = keyboard_check("up") or keyboard_check("w") or keyboard_check("space")
if keyboard_check_pressed("up") or keyboard_check_pressed("w") or keyboard_check_pressed("space"):
    self.buffer = JUMP_BUFFER
move = (1 if right else 0) - (1 if left else 0)

# Running. On ice it takes a while to get going, and to stop.
if self.on is None:
    accel = AIR_ACCEL
elif self.on.slippery:
    accel = ICE_ACCEL
else:
    accel = RUN_ACCEL
self.vx = approach(self.vx, move * RUN, accel)
if move != 0:
    self.facing = move
self.vx += global_vars.wind * WIND_PUSH * (0.4 if self.on else 1)

# Jumping: a moment's grace after running off an edge, and a press just before landing counts.
if self.on is not None:
    self.coyote = COYOTE
elif self.coyote > 0:
    self.coyote -= 1
if self.buffer > 0:
    self.buffer -= 1
    if self.coyote > 0:
        self.vy = JUMP_V
        self.on = None
        self.coyote = 0
        self.buffer = 0
        sound_play("jump", volume=0.4)
if self.vy < JUMP_CUT and not jump_held:
    self.vy = JUMP_CUT

# Across, carried along by a moving ledge, and never into the walls.
self.x += self.vx
if self.on is not None:
    self.x += self.on.dx
if self.x < WALL_L + HALF:
    self.x, self.vx = WALL_L + HALF, 0
if self.x > WALL_R - HALF:
    self.x, self.vx = WALL_R - HALF, 0

# Standing: still on it? A ledge can break, move away, or be walked off.
if self.on is not None:
    ledge = self.on
    if instance_exists(ledge) and not ledge.broken and abs(self.x - ledge.x) <= ledge.half + HALF / 2:
        self.y = ledge.y
        self.vy = 0
        ledge.stood = 2
    else:
        self.on = None
        self.top_of_fall = self.y

# Falling: land on the first ledge whose top the feet go past, coming down.
if self.on is None:
    self.vy = min(self.vy + GRAVITY, MAX_FALL)
    new_y = self.y + self.vy
    landing = None
    if self.vy > 0:
        for ledge in instances("Ledge"):
            if ledge.broken or abs(self.x - ledge.x) > ledge.half + HALF / 2:
                continue
            if self.y <= ledge.y - ledge.dy + 0.01 and new_y >= ledge.y:
                if landing is None or ledge.y < landing.y:
                    landing = ledge
    self.top_of_fall = min(self.top_of_fall, self.y)
    if landing is None:
        self.y = new_y
    else:
        fell = landing.y - self.top_of_fall
        self.y, self.vy, self.on = landing.y, 0, landing
        self.top_of_fall = self.y
        if fell > BIG_FALL:
            particles(self.x, self.y, 18, "white", 3, 4, 30, 0.2, 140)
            camera_shake(min(8, fell / 120), 14)
            sound_play("thud", volume=0.6)
        elif fell > 30:
            sound_play("land", volume=0.25)

# Snowballs: X (or J) throws the way you face; a click throws at the pointer.
if self.throw_wait > 0:
    self.throw_wait -= 1
aimed = mouse_check_pressed("left")
if (keyboard_check_pressed("x") or keyboard_check_pressed("j") or aimed) and self.throw_wait == 0:
    self.throw_wait = THROW_EVERY
    self.throwing = 14
    if aimed:
        self.facing = 1 if mouse_x >= self.x else -1
    hand_x, hand_y = self.x + self.facing * 12, self.y - 40
    ball = instance_create(hand_x, hand_y, "Snowball")
    if aimed:
        d = math.atan2(mouse_y - hand_y, mouse_x - hand_x)
        ball.vx, ball.vy = 7.5 * math.cos(d), 7.5 * math.sin(d) - 1
    else:
        ball.vx, ball.vy = self.facing * 6.5 + self.vx * 0.5, -3.2
    sound_play("throw", volume=0.4)

# The pose.
if self.throwing > 0:
    self.throwing -= 1
    self.image_index = 5
elif self.on is None:
    self.image_index = 3 if self.vy < 0 else 4
elif abs(self.vx) > 0.4:
    self.run_t += abs(self.vx) * 0.06
    self.image_index = 1 + int(self.run_t) % 2
else:
    self.image_index = 0
self.image_xscale = self.facing

# How high: now, and the best ever (kept, and on the school's board).
metres = metres_at(self.y)
global_vars.height = metres
if metres > self.best:
    self.best = metres
    global_vars.best = metres
    save_set("best", metres)
    high_score(metres)
