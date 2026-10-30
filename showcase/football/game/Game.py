# object: Game
# The referee of the whole evening: the title, the chalkboard, the snap,
# the play, the whistle and the final score. The rules are in match, one
# play in play, the drawing in screen, and the steps between in flow.

# === create
self.mode = "title"
self.t = 0
self.menu = 0
self.idle = 0
self.mascot = 0
self.since = 0
for team in ("home", "away"):
    for num in range(7):
        p = instance_create(0, 0, "Player")
        p.team, p.num = team, num
        PLAYERS.append(p)
BALL.append(instance_create(0, 0, "Ball"))
instance_create(0, 0, "Referee")
new_match({"home": None, "away": None})
line_up("home", "away", 0, 0, MATCH["los"], MID)
music_play("fight", volume=0.45)

# === step
self.t += 1
if self.mascot > 0:
    self.mascot -= 1

if self.mode == "title":
    self.idle += 1
    for c in (0, 1):
        step = menu_moved(c)
        if step:
            self.menu = (self.menu + step) % len(MENU)
            self.idle = 0
            sound_play("click", volume=0.4)
    if button_pressed(0, 0) or (gamepad_connected(1) and button_pressed(1, 0)):
        two = self.menu == 1
        new_match({"home": 0, "away": 1 if two else None})
        MATCH["two"] = two
        touch_controls(not two, ("z", "x", "c"))
        start_call(self)
    elif self.idle > 900:              # nobody's playing: the computer plays itself
        new_match({"home": None, "away": None})
        MATCH["demo"] = True
        start_call(self)
    return

if MATCH.get("demo") and keyboard_check_pressed("any"):
    go_title(self)
    return

if self.mode == "call":
    call_step(self)
elif self.mode == "set":
    if not PLAY["snapped"]:
        c = MATCH["humans"].get(PLAY["off"])
        if (c is not None and self.t - self.since > 30 and button_pressed(c, 0)) or (c is None and self.t - self.since > 70):
            snap()
            self.mode = "live"
    d = MATCH["humans"].get(PLAY["deff"])
    if d is not None and button_pressed(d, 1):
        switch_defender(PLAY["deff"])
elif self.mode == "live":
    human_buttons()
    kick_step()
    live_step()
    run_clock(1 / 60)
    if PLAY["result"] is not None:
        blow_whistle(self)
elif self.mode == "whistle":
    waited = self.t - self.since
    pressed = any(button_pressed(c, 0) for c in MATCH["humans"].values() if c is not None)
    if waited > 150 or (waited > 40 and pressed):
        if MATCH["over"]:
            self.mode = "final"
            self.since = self.t
            music_play("fight", volume=0.45)
        else:
            start_call(self)
elif self.mode == "final":
    if self.t - self.since > 90 and (keyboard_check_pressed("any") or button_pressed(0, 0)):
        go_title(self)

# === draw_gui
if self.mode == "title":
    draw_title(self.menu, self.t)
    return
if self.mode == "call":
    draw_chalkboard(self.t)
    return
if self.mode == "final":
    draw_final(self.t - self.since)
    return
draw_scoreboard()
if self.mode == "whistle":
    draw_says(self.t)
k = PLAY.get("kick")
if self.mode == "live" and k is not None and k["good"] is None:
    draw_kick_meter(k, self.t)
if self.mascot > 0:
    draw_mascot(150 - self.mascot)
if MATCH.get("demo"):
    draw_hint("DEMO  -  press any key")
    return
c = MATCH["humans"].get(PLAY["off"])
d = MATCH["humans"].get(PLAY["deff"])
if self.mode == "set" and c is not None:
    draw_hint(f"{button_name(c, 0)} to hike the ball")
elif self.mode == "live" and c is not None and k is not None and k["good"] is None:
    draw_hint(f"{button_name(c, 0)} to kick, in the green")
elif self.mode == "live" and c is not None and holding_to_throw():
    draw_hint(f"Throw: {button_name(c, 0)} {button_name(c, 1)} {button_name(c, 2)} for receiver 1 2 3")
elif self.mode in ("set", "live") and d is not None and c is None:
    draw_hint(f"{button_name(d, 0)} to dive, {button_name(d, 1)} to switch player")
elif self.mode == "whistle":
    draw_hint("")

