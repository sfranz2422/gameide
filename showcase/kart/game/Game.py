# object: Game
# depth: 0
# The whole game, step by step: the title (a race driving itself behind it),
# a race, and the results.

# === create
self.mode = "title"
self.t = 0
self.since = 0
self.engine = None
self.best = None
self.new_best = False
self.cam = {"x": 0, "y": 0, "a": 0}
start_race(0, player=False)
move_camera(self.cam, RACE["karts"][0], snap=True)
touch_controls(True, ("x", "z", "space"))

# === step
self.t += 1
go = keyboard_check_pressed("space") or keyboard_check_pressed("enter") or gamepad_check_pressed("a")
gas = keyboard_check("up") or keyboard_check("x") or gamepad_check("a") or gamepad_check("rt")
brake = keyboard_check("down") or gamepad_check("b") or gamepad_check("lt")
steer = (keyboard_check("right") or gamepad_check("right")) - (keyboard_check("left") or gamepad_check("left"))
drift = bool(keyboard_check("z") or keyboard_check("shift") or gamepad_check("rb"))

if self.mode == "title":
    race_step(False, False, 0, False)
    # Any kart makes a good demo: this one is the leader.
    leader = min(RACE["karts"], key=lambda c: c.place)
    move_camera(self.cam, leader)
    if RACE["over"] or RACE["steps"] > 3600 or any(c.done for c in RACE["karts"]):
        start_race(0, player=False)
        move_camera(self.cam, RACE["karts"][0], snap=True)
    if go:
        sound_play("click")
        start_race(0)
        move_camera(self.cam, RACE["karts"][0], snap=True)
        self.mode, self.since = "race", self.t
    return

if self.mode == "race":
    you = RACE["karts"][0]
    happened = race_step(gas, brake, steer, drift)
    for what in happened:
        sound_play(what, volume=0.7)
    if "bump" in happened:
        camera_shake(3, 10)
    engine_sound(self, you, you.done is None)
    move_camera(self.cam, you)
    if keyboard_check_pressed("escape"):
        engine_sound(self, you, False)
        self.mode, self.since = "title", self.t
        start_race(0, player=False)
    elif RACE["over"]:
        engine_sound(self, you, False)
        self.new_best = keep_best(RACE["track"]["name"], you.done)
        self.best = save_get("best_" + RACE["track"]["name"])
        self.mode, self.since = "results", self.t
    return

if self.mode == "results":
    race_step(False, False, 0, False)
    move_camera(self.cam, RACE["karts"][0])
    if go and self.t - self.since > 40:
        sound_play("click")
        self.mode, self.since = "title", self.t
        start_race(0, player=False)
        move_camera(self.cam, RACE["karts"][0], snap=True)

# === draw
draw_world(self.cam, self.t)

# === draw_gui
if self.mode == "title":
    draw_title(self.t)
elif self.mode == "race":
    draw_hud(self.t)
elif self.mode == "results":
    draw_results(self, self.t - self.since)
