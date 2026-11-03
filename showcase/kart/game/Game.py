# object: Game
# depth: 100000
# The race's referee and the view: the title (a race driving itself behind it),
# the clock, the camera, the sky and the floor, and the results. Its depth is
# deeper than anything on the track, so everything is drawn over its floor.

# === create
self.mode = "title"
self.t = 0
self.since = 0
self.engine = None
self.best = None
self.new_best = False
self.leader = None
RACE["camera"] = {"x": 0, "y": 0, "a": 0}
place_scenery(TRACKS[0])
new_race(self, False)
touch_controls(True, ("x", "z", "space"))

# === step
self.t += 1
go = keyboard_check_pressed("space") or keyboard_check_pressed("enter") or gamepad_check_pressed("a")
if RACE["count"] > 0:
    RACE["count"] -= 1
    if self.mode == "race":
        if RACE["count"] == 0:
            sound_play("go", volume=0.7)
        elif RACE["count"] % 60 == 0:
            sound_play("beep", volume=0.7)
else:
    RACE["steps"] += 1

if self.mode == "title":
    if RACE["steps"] > 3600 or race_over():
        new_race(self, False)
    if go:
        sound_play("click")
        new_race(self, True)
        self.mode, self.since = "race", self.t
elif self.mode == "race":
    you = RACE["karts"][0]
    engine_sound(self, you, you.done is None)
    if keyboard_check_pressed("escape"):
        engine_sound(self, you, False)
        self.mode, self.since = "title", self.t
        new_race(self, False)
    elif race_over():
        engine_sound(self, you, False)
        self.new_best = keep_best(RACE["track"]["name"], you.done)
        self.best = save_get("best_" + RACE["track"]["name"])
        self.mode, self.since = "results", self.t
elif go and self.t - self.since > 40:
    sound_play("click")
    self.mode, self.since = "title", self.t
    new_race(self, False)

# === end_step
# After every kart has moved. Who's where, then the camera, which swings after
# the kart rather than turning with it: that lag is what shows the kart's side
# as it turns, and more of it on a drift.
place_karts()
you = RACE["karts"][0]
if RACE["count"] == 0 and self.mode == "race":
    ax, ay = RACE["line"][you.i]
    bx, by = RACE["line"][(you.i + 1) % len(RACE["line"])]
    road = math.degrees(math.atan2(-(by - ay), bx - ax))
    backwards = abs(angle_diff(you.a, road)) > 110 and you.v > 0.3
    RACE["wrong_way"] = RACE["wrong_way"] + 1 if backwards else 0
follow = min(RACE["karts"], key=lambda c: c.place) if self.mode == "title" else you
move_camera(follow)

# === draw
cam = RACE["camera"]
# The sky slides as you turn: a whole turn is two whole pictures.
sx = -(cam["a"] / 360 * SKY_W * 2) % SKY_W
draw_sprite("sky_0", 0, sx - SKY_W, 0)
draw_sprite("sky_0", 0, sx, 0)
draw_floor("track_0", 0, cam["x"], cam["y"], cam["a"], CAM_HEIGHT, HORIZON, FOCAL, RACE["track"]["look"]["hedge"])

# === draw_gui
if self.mode == "title":
    draw_title(self.t)
elif self.mode == "race":
    draw_hud(self.t)
elif self.mode == "results":
    draw_results(self, self.t - self.since)
