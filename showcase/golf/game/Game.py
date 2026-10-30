# object: Game
# depth: 1000
# The round, step by step: the title, each hole's card, aiming, the swing,
# the ball rolling, and the scorecard. The course is in course, the ball's
# flight in ball, turns and scores in play, and the drawing in screen.

# === create
self.mode = "title"
self.t = 0
self.players = 1
self.aim = 0
self.club = 0
self.power = 0
self.words = ""
self.since = 0
for i in range(4):
    BALLS.append(instance_create(0, 0, "Ball"))
    BALLS[i].player = i
new_round(1)
start_hole()
touch_controls(True, ("space",))

# === step
self.t += 1
go = keyboard_check_pressed("space") or keyboard_check_pressed("enter") or gamepad_check_pressed("a")

if self.mode == "title":
    step = keyboard_check_pressed("right") - keyboard_check_pressed("left")
    self.players = clamp(self.players + step, 1, 4)
    if go:
        new_round(self.players)
        start_hole()
        self.mode, self.since = "card", self.t
    return

if self.mode == "card":
    if go and self.t - self.since > 10:
        self.mode = "aim"
        aim_at_pin(self)
    return

if self.mode == "aim":
    ball = BALLS[ROUND["turn"]]
    turn = keyboard_check("left") - keyboard_check("right") + gamepad_check("left") - gamepad_check("right")
    self.aim = (self.aim + turn * (0.4 if keyboard_check("shift") else 1.5)) % 360
    if keyboard_check_pressed("up") or gamepad_check_pressed("up"):
        self.club = max(0, self.club - 1)
    if keyboard_check_pressed("down") or gamepad_check_pressed("down"):
        self.club = min(len(CLUBS) - 1, self.club + 1)
    if ground(hole_now(), ball.x, ball.y) == "green":
        self.club = len(CLUBS) - 1         # on the green it's always the putter
    if go:
        self.mode, self.since, self.power = "swing", self.t, 0
    return

if self.mode == "swing":
    # The meter fills in 45 steps, then empties: press again to hit at that much.
    k = (self.t - self.since) / 45
    self.power = k if k <= 1 else 2 - k
    if go and self.t - self.since > 2:
        hit(BALLS[ROUND["turn"]], self.club, self.power, self.aim, ROUND["wind"])
        sound_play("putt" if CLUBS[self.club]["name"] == "Putter" else "swing", volume=0.7)
        self.mode = "rolling"
    elif self.power <= 0:
        self.mode = "aim"                  # let it empty, and you can think again
    return

if self.mode == "rolling":
    ball = BALLS[ROUND["turn"]]
    result = roll(ball, hole_now())
    if result:
        if result == "holed":
            sound_play("cup", volume=0.8)
        elif result == "water":
            sound_play("splash", volume=0.7)
        self.words = shot_over(result)
        self.mode, self.since = "after", self.t
    return

if self.mode == "after":
    if self.t - self.since > (90 if self.words else 20) or (go and self.t - self.since > 15):
        self.words = ""
        if ROUND["turn"] is None:
            self.mode, self.since = "scores", self.t
        else:
            self.mode = "aim"
            aim_at_pin(self)
    return

if self.mode == "scores":
    if go and self.t - self.since > 40:
        if ROUND["hole"] + 1 < len(HOLES):
            ROUND["hole"] += 1
            start_hole()
            self.mode, self.since = "card", self.t
        else:
            if ROUND["players"] == 1:
                best = save_get("best", None)
                if best is None or total(0) < best:
                    save_set("best", total(0))
            self.mode, self.since = "final", self.t
    return

if self.mode == "final":
    if go and self.t - self.since > 40:
        self.mode = "title"
        new_round(1)
        start_hole()

# === draw
hole = hole_now()
draw_sprite(f"hole_{ROUND['hole']}", 0, 0, 0)
draw_pin(hole, self.t)
if self.mode in ("aim", "swing") and ROUND["turn"] is not None:
    ball = BALLS[ROUND["turn"]]
    if self.mode == "aim":
        draw_aim(ball, self.aim, self.club)
    draw_golfer(ROUND["turn"], ball, self.aim, self.power if self.mode == "swing" else 0)

# === draw_gui
if self.mode == "title":
    draw_title(self.players, self.t)
    return
hole = hole_now()
if self.mode == "card":
    draw_card_for_hole(hole)
    return
if self.mode in ("scores", "final"):
    draw_scorecard(self.t - self.since, self.mode == "final")
    return
if ROUND["turn"] is not None:
    draw_hud(hole, ROUND["turn"], self.club, BALLS[ROUND["turn"]])
draw_map(hole)
if self.mode == "swing":
    draw_meter(self.power)
draw_words(self.words)
