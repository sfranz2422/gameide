# object: Player
# parent: Kid
# You. WASD or the arrows walk; aim with the mouse and hold the left button to
# throw further (or hold Space to throw the way you face); E at a drift scoops.
# A gamepad: left stick walks, right stick aims, the right trigger (or RB)
# throws, X scoops.

# === create
super().on_create()
self.is_player = True
self.tag = my_tag()
self.charge = 0            # steps the throw has been held
self.aim_x, self.aim_y = 1, 0
global_vars.player = self
camera_follow(self, 0.2)
touch_controls(True, ("space", "e"))

# === step
held = self.stun > 0 or global_vars.m["over"] is not None
self.mx = (keyboard_check("right") or keyboard_check("d")) - (keyboard_check("left") or keyboard_check("a"))
self.my = (keyboard_check("down") or keyboard_check("s")) - (keyboard_check("up") or keyboard_check("w"))
sx, sy = gamepad_axis("left_x"), gamepad_axis("left_y")
if abs(sx) + abs(sy) > 0.25:
    self.mx, self.my = sx, sy
self.scooping = keyboard_check("e") or gamepad_check("x")

# Aim: the right stick, else the mouse when it moves, else the way you walk.
ax, ay = gamepad_axis("right_x"), gamepad_axis("right_y")
if abs(ax) + abs(ay) > 0.3:
    self.aim_x, self.aim_y = ax, ay
elif mouse_check("left") or mouse_check_released("left"):
    self.aim_x, self.aim_y = mouse_x - self.x, mouse_y - self.y
elif self.mx or self.my:
    self.aim_x, self.aim_y = self.mx, self.my

# Throw: hold to throw further, let go to throw.
holding = mouse_check("left") or keyboard_check("space") or gamepad_check("rt") or gamepad_check("rb")
let_go = mouse_check_released("left") or keyboard_check_released("space") or gamepad_check_released("rt") or gamepad_check_released("rb")
if holding and not held and self.stock > 0:
    self.charge = min(self.charge + 1, CHARGE_STEPS)
if let_go and self.charge > 0:
    d = math.hypot(self.aim_x, self.aim_y) or 1
    if ask_throw(self, self.x + self.aim_x / d * 100, self.y + self.aim_y / d * 100, self.charge / CHARGE_STEPS) is not None:
        sound_play("throw", volume=0.4)
    self.charge = 0
if held:
    self.charge = 0
super().on_step()

# === draw
if self.team is None:
    return          # in a room, until the host has put you on a team
super().on_draw()
if self.charge > 0:
    # How far it'll go: a line of dots along the aim.
    d = math.hypot(self.aim_x, self.aim_y) or 1
    reach = THROW_MIN + (THROW_MAX - THROW_MIN) * self.charge / CHARGE_STEPS
    draw_set_color("#ffffff")
    draw_set_alpha(0.7)
    for i in range(1, 9):
        f = i / 8
        draw_circle(self.x + self.aim_x / d * reach * f, self.y + self.aim_y / d * reach * f - 4, 2)
    draw_set_alpha(1)
