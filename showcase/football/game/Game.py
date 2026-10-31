# object: Game
# The referee of the whole evening: the title, the season, the coin toss,
# the chalkboard, the snap, the play, the whistle, the replay, the try and
# the final score. The rules are in match, one play in play, the drawing in
# screen, the steps between in flow, and the season in season.

# === create
self.mode = "title"
self.t = 0
self.menu = 0
self.idle = 0
self.mascot = 0
self.since = 0
self.cursor = 0
self.try_cursor = 0
self.replay_next = False
for team in ("home", "away"):
    for num in range(7):
        p = instance_create(0, 0, "Player")
        p.team, p.num = team, num
        PLAYERS.append(p)
BALL.append(instance_create(0, 0, "Ball"))
instance_create(0, 0, "Referee")
go_title(self)
music_play("fight", volume=0.45)

# === step
self.t += 1
if self.mascot > 0:
    self.mascot -= 1
if ANNOUNCE["t"] > 0:
    ANNOUNCE["t"] -= 1

if self.mode == "title":
    self.idle += 1
    for c in (0, 1):
        step = menu_moved(c)
        if step:
            self.menu = (self.menu + step) % len(MENU)
            self.idle = 0
            sound_play("click", volume=0.4)
    if button_pressed(0, 0) or (gamepad_connected(1) and button_pressed(1, 0)):
        if self.menu == 2:
            open_season(self)
        else:
            two = self.menu == 1
            begin_match(self, {"home": 0, "away": 1 if two else None}, two=two)
    elif self.idle > 900:              # nobody's playing: the computer plays itself
        begin_match(self, {"home": None, "away": None})
        MATCH["demo"] = True
    return
if self.mode == "pick":
    pick_step(self)
    return
if self.mode == "season":
    season_step(self)
    return

if MATCH.get("demo") and keyboard_check_pressed("any"):
    go_title(self)
    return

if self.mode == "toss":
    toss_step(self)
elif self.mode == "call":
    call_step(self)
elif self.mode == "try":
    try_step(self)
elif self.mode == "set":
    waited = self.t - self.since
    if PLAY["play"]["kind"] == "kickoff":
        # The kicking team's first button kicks it deep, the second onside.
        k = MATCH["humans"].get(PLAY["deff"])
        if k is not None and waited > 30 and (button_pressed(k, 0) or button_pressed(k, 1)):
            snap(onside=button_pressed(k, 1))
        elif k is None and waited > 70:
            snap(onside=cpu_onside(PLAY["deff"]))
    else:
        c = MATCH["humans"].get(PLAY["off"])
        if (c is not None and waited > 30 and button_pressed(c, 0)) or (c is None and waited > 70):
            snap()
        d = MATCH["humans"].get(PLAY["deff"])
        if d is not None and button_pressed(d, 1):
            switch_defender(PLAY["deff"])
    if PLAY["snapped"]:
        self.mode = "live"
elif self.mode == "live":
    human_buttons()
    kick_step()
    live_step()
    record_frame()
    if not MATCH.get("try"):
        run_clock(1 / 60)
    if PLAY["result"] is not None:
        blow_whistle(self)
elif self.mode == "whistle":
    whistle_step(self)
elif self.mode == "replay":
    replay_step(self)
elif self.mode == "final":
    if self.t - self.since > 90 and (keyboard_check_pressed("any") or button_pressed(0, 0)):
        if MATCH.get("season"):
            set_teams()
            open_season(self)
        else:
            go_title(self)

# === draw
# Tonight's two teams in the end zones and at midfield (the field itself is one picture).
draw_field_teams()

# === draw_gui
if self.mode == "title":
    draw_title(self.menu, self.t)
    return
if self.mode == "pick":
    draw_pick(self.cursor, self.t)
    return
if self.mode == "season":
    draw_season(self.cursor, self.t)
    return
if self.mode == "toss":
    draw_toss(MATCH["toss"], self.t)
    return
if self.mode == "call":
    draw_chalkboard(self.t)
    return
if self.mode == "final":
    draw_final(self.t - self.since)
    return
if self.mode == "replay":
    draw_replay(self.t)
    return
draw_scoreboard()
draw_announcer()
if self.mode == "whistle":
    draw_says(self.t)
if self.mode == "try":
    draw_try(self.try_cursor)
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
car = PLAY.get("carrier")
kickoff = PLAY["play"]["kind"] == "kickoff"
if self.mode == "set" and kickoff and d is not None:
    draw_hint(f"{button_name(d, 0)} to kick it deep, {button_name(d, 1)} to kick onside")
elif self.mode in ("set", "live") and kickoff and c is not None and car is None:
    draw_hint("You're the returner: get under the ball")
elif self.mode == "set" and c is not None:
    draw_hint(f"{button_name(c, 0)} to hike the ball")
elif self.mode == "live" and c is not None and k is not None and k["good"] is None:
    draw_hint(f"{button_name(c, 0)} to kick, in the green")
elif self.mode == "live" and c is not None and holding_to_throw():
    draw_hint(f"Throw: {button_name(c, 0)} {button_name(c, 1)} {button_name(c, 2)} for receiver 1 2 3")
elif self.mode == "live" and c is not None and PLAY["ball"] == "air" and not PLAY.get("toss"):
    draw_hint(f"{button_name(c, 0)} to dive for it!")
elif self.mode == "live" and c is not None and car is not None and car.human == c:
    if PLAY["play"].get("pitch") and car.role == PLAY["play"]["carrier"] and not PLAY["second_done"]:
        draw_hint(f"{button_name(c, 0)} to pitch it to the back")
    else:
        left = [f"{button_name(c, m['button'])} {name}" for name, m in MOVES.items() if name not in PLAY["moves"]]
        if left:
            draw_hint("  ".join(left).replace("stiff", "stiff-arm"))
elif self.mode in ("set", "live") and d is not None and c is None:
    draw_hint(f"{button_name(d, 0)} to dive, {button_name(d, 1)} to switch player")
