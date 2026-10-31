# object: Game
# depth: 1000
# The whole game, step by step: the title (with the jeep driving itself
# behind it), the garage, a run, and what you got. The stages are in
# stages, the car's physics in car, a run in run, what's saved in garage,
# and the drawing in screen.

# === create
self.mode = "title"
self.t = 0
self.since = 0
self.row = len(ROWS) - 1             # the menu starts on DRIVE!
self.stage_i = 0
self.kind_i = 0
self.msg, self.msg_bad = "", False
self.cam_x, self.cam_y = 0, BASE - 230
self.engine = None                   # the engine sound playing
self.ended = None                    # when the run ended
start_run("Countryside", "Jeep", {})
touch_controls(True, ("g", "b", "space"))

# === step
self.t += 1
go = keyboard_check_pressed("space") or keyboard_check_pressed("enter") or gamepad_check_pressed("a")
gas = keyboard_check("right") or keyboard_check("d") or keyboard_check("g") or gamepad_check("right") or gamepad_check("rt")
brake = keyboard_check("left") or keyboard_check("a") or keyboard_check("b") or gamepad_check("left") or gamepad_check("lt")

if self.mode == "title":
    # The jeep drives itself behind the title: gas, easing off when its nose is high.
    gas, brake = autopilot(RUN["car"], RUN["road"])
    run_step(gas, brake)
    if RUN["end"] or RUN["steps"] > 1500:
        start_run("Countryside", "Jeep", {})
    follow_car(self, RUN["car"])
    if go or keyboard_check_pressed("g"):
        self.mode, self.since = "garage", self.t
        sound_play("click")
    return

if self.mode == "garage":
    stages, kinds = [s["name"] for s in STAGES], list(VEHICLES)
    kind = kinds[self.kind_i]
    step = keyboard_check_pressed("down") - keyboard_check_pressed("up")
    if step:
        self.row = (self.row + step) % len(ROWS)
        self.msg = ""
        sound_play("click", volume=0.5)
    side = keyboard_check_pressed("right") - keyboard_check_pressed("left")
    row = ROWS[self.row]
    if side and row == "stage":
        self.stage_i = (self.stage_i + side) % len(STAGES)
        self.msg = ""
        sound_play("click", volume=0.5)
    elif side and row == "vehicle":
        self.kind_i = (self.kind_i + side) % len(kinds)
        self.msg = ""
        sound_play("click", volume=0.5)
    if (go or keyboard_check_pressed("g")) and self.t - self.since > 10:
        stage = stages[self.stage_i]
        if row == "stage" and stage not in owned_stages():
            done = buy_stage(stage)
            self.msg, self.msg_bad = ("Unlocked " + stage + "!", False) if done else ("Not enough coins yet.", True)
        elif row == "vehicle" and kind not in owned_vehicles():
            done = buy_vehicle(kind)
            self.msg, self.msg_bad = ("The " + kind + " is yours!", False) if done else ("Not enough coins yet.", True)
        elif row in UPGRADES:
            if kind not in owned_vehicles():
                done, self.msg, self.msg_bad = False, "Buy the " + kind + " first.", True
            elif upgrade_price(kind, row) is None:
                done, self.msg, self.msg_bad = False, "That's as good as it gets.", True
            else:
                done = buy_upgrade(kind, row)
                self.msg, self.msg_bad = (row.capitalize() + " upgraded!", False) if done else ("Not enough coins yet.", True)
        else:
            done = False
            if stage not in owned_stages():
                self.msg, self.msg_bad = "Unlock this stage first.", True
            elif kind not in owned_vehicles():
                self.msg, self.msg_bad = "Buy the " + kind + " first.", True
            else:
                save_set("last", [stage, kind])
                start_run(stage, kind, levels_of(kind))
                self.mode, self.since, self.ended = "race", self.t, None
                self.cam_x, self.cam_y = RUN["car"].x - 220, RUN["car"].y - 210
                sound_play("go")
        sound_play("buy" if done else "click", volume=0.7 if done else 0.4)
    return

if self.mode == "race":
    car = RUN["car"]
    if keyboard_check_pressed("escape"):
        RUN["end"] = "quit"
    happened = run_step(gas, brake)
    for what in happened:
        if what in ("coin", "fuel", "flip", "air", "crash", "finish", "land", "fuel_out"):
            sound_play(what, volume=0.6 if what == "coin" else 0.8)
    if "coin" in happened:
        particles(car.x, car.y - 10, 6, GOLD, speed=2, size=2, life=20)
    if "fuel" in happened:
        effect("sparkle", car.x, car.y - 10, "#7ee05a")
    if "crash" in happened:
        hx, hy, r = car.head()
        particles(hx, hy, 20, "white", speed=4, size=3, life=30)
        camera_shake(6, 20)
    if "finish" in happened:
        effect("confetti", car.x, car.y - 60)
    if "land" in happened:
        camera_shake(2, 8)
        for w in car.wheels:
            particles(w.x, w.y + w.r, 8, RUN["stage"]["look"]["dirt"], speed=2, size=3, life=25, gravity=0.1, direction=90, spread=120)
    # Dust from the wheels when the engine pushes them.
    if gas and car.fuel > 0 and self.t % 4 == 0:
        for w in car.wheels:
            if w.on:
                particles(w.x - 6, w.y + w.r - 2, 1, RUN["stage"]["look"]["dirt"], speed=1.5, size=3, life=20, gravity=0.05, direction=150, spread=30)
    engine_sound(self, car, gas and car.fuel > 0 and not RUN["end"])
    follow_car(self, car)
    if RUN["end"] and self.ended is None:
        self.ended = self.t
    if self.ended is not None and self.t - self.ended > (70 if RUN["end"] == "head" else 30):
        finish_run(self)
    return

if self.mode == "over":
    follow_car(self, RUN["car"])
    run_step(False, False)
    if (go or keyboard_check_pressed("g")) and self.t - self.since > 30:
        self.mode, self.since = "garage", self.t
        self.msg = ""
        sound_play("click")

# === draw
draw_backdrop(RUN["stage"], self.cam_x, self.cam_y)
draw_road(RUN["stage"], RUN["road"], self.cam_x, self.cam_y)
draw_things(RUN["road"], self.cam_x, self.t)
if self.mode == "race":
    draw_ghost(RUN["steps"])
draw_car(RUN["car"], 1, RUN["end"] == "head", self.t)

# === draw_gui
if self.mode == "title":
    draw_title(self.t)
elif self.mode == "garage":
    draw_garage(self, self.t)
elif self.mode == "race":
    draw_hud(self.t)
elif self.mode == "over":
    draw_over(self, self.t - self.since)
