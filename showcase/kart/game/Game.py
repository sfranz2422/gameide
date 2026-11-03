# object: Game
# depth: 100000
# The race's referee and the view: the title (a race driving itself behind it),
# the menu, the clock, the camera, the sky and the floor, the results and the
# cup's table. Its depth is deeper than anything on the track, so everything is
# drawn over its floor.

# === create
self.mode = "title"
self.t = 0
self.since = 0
self.engine = None
self.best = None
self.new_best = False
self.row = 0
self.mode_i = 0                 # Cup or Time trial
self.racer = 0
self.track_i = 0
self.cup_race = 0
self.cup_points = [0] * len(RACERS)
RACE["camera"] = {"x": 0, "y": 0, "a": 0}
new_race(0)
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

if self.mode == "title" or self.mode == "menu":
    if RACE["steps"] > 3600 or (RACE["karts"] and race_over()):
        new_race(0)

if self.mode == "title":
    if go:
        sound_play("click")
        self.mode, self.since, self.row = "menu", self.t, 0
elif self.mode == "menu":
    rows = menu_rows(self)
    move = keyboard_check_pressed("down") - keyboard_check_pressed("up")
    if move:
        self.row = (self.row + move) % len(rows)
        sound_play("click", volume=0.5)
    side = keyboard_check_pressed("right") - keyboard_check_pressed("left")
    row = rows[self.row]
    if side:
        sound_play("click", volume=0.5)
        if row == "mode":
            self.mode_i = (self.mode_i + side) % len(MODES)
        elif row == "racer":
            self.racer = (self.racer + side) % len(RACERS)
        elif row == "track":
            self.track_i = (self.track_i + side) % len(TRACKS)
    if keyboard_check_pressed("escape"):
        self.mode, self.since = "title", self.t
    elif go and row == "go" and self.t - self.since > 10:
        sound_play("click")
        if MODES[self.mode_i] == "Cup":
            self.cup_race = 0
            self.cup_points = [0] * len(RACERS)
            new_race(0, self.racer)
        else:
            new_race(self.track_i, self.racer, False)
        self.mode, self.since = "race", self.t
elif self.mode == "race":
    you = RACE["karts"][0]
    engine_sound(self, you, you.done is None)
    if RACE["count"] == 0 and RACE["steps"] % PATH_EVERY == 0:
        RACE["path"].append([round(you.x, 1), round(you.y, 1), round(you.a)])
    if keyboard_check_pressed("escape"):
        engine_sound(self, you, False)
        self.mode, self.since = "title", self.t
        new_race(0)
    elif race_over():
        engine_sound(self, you, False)
        finish_race(self)
        self.mode, self.since = "results", self.t
elif self.mode == "results":
    if go and self.t - self.since > 40:
        sound_play("click")
        if RACE["rivals"]:
            self.mode, self.since = "standings", self.t
            if self.cup_race >= len(TRACKS):
                end_cup(self)
        else:
            self.mode, self.since = "menu", self.t
            new_race(0)
elif self.mode == "standings":
    if go and self.t - self.since > 40:
        sound_play("click")
        if self.cup_race >= len(TRACKS):
            self.mode, self.since = "title", self.t
            new_race(0)
        else:
            new_race(self.cup_race, self.racer)
            self.mode, self.since = "race", self.t

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
follow = min(RACE["karts"], key=lambda c: c.place) if self.mode in ("title", "menu") else you
move_camera(follow)

# === draw
cam = RACE["camera"]
n = RACE["track_i"]
# The sky slides as you turn: a whole turn is two whole pictures.
sx = -(cam["a"] / 360 * SKY_W * 2) % SKY_W
draw_sprite(f"sky_{n}", 0, sx - SKY_W, 0)
draw_sprite(f"sky_{n}", 0, sx, 0)
draw_floor(f"track_{n}", 0, cam["x"], cam["y"], cam["a"], CAM_HEIGHT, HORIZON, FOCAL, RACE["track"]["look"]["hedge"])

# === draw_gui
if self.mode == "title":
    draw_title(self.t, save_get("cup_best"))
elif self.mode == "menu":
    draw_menu(self, self.t)
elif self.mode == "race":
    draw_hud(self.t)
elif self.mode == "results":
    draw_results(self, self.t - self.since)
elif self.mode == "standings":
    draw_standings(self, self.t - self.since)
