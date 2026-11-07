# object: Game
# depth: -100
# The whole ballpark, step by step: the title, then pitch after pitch. The
# rules are in rules, a pitch and a swing in pitch, a hit's flight and who
# fields it in flight, the Derby in derby, a game's count and innings in
# innings, the computer in cpu, the keys in controls, the steps between
# pitches in flow, and the drawing in screen.

# === create
self.t = 0
self.menu = 0
self.idle = 0
self.since = 0
self.mode = "title"
go_title(self)
music_play("organ", volume=0.4)

# === step
# A Python check question (in a showcase game) waits for a fair moment: never between
# the windup and the end of the play.
question_ok(self.mode not in ("windup", "pitch", "hit", "field"))
self.t += 1

if self.mode == "title":
    self.idle += 1
    step = menu_moved(0) + (menu_moved(1) if gamepad_connected(1) else 0)
    if step:
        self.menu = (self.menu + step) % len(MENU)
        self.idle = 0
        sound_play("click", volume=0.4)
    if button_pressed(0, 0) and self.t - self.since > 10:
        music_stop()
        if self.menu == 0:
            start(self, "derby", {})
        elif self.menu == 1:
            start(self, "game", {"away": 0, "home": None})
        else:
            start(self, "game", {"away": 0, "home": 1}, two=True)
    elif self.idle > 900:              # nobody's playing: the computer plays itself
        start(self, "game", {"away": None, "home": None}, demo=True)
    return

if MATCH.get("demo") and keyboard_check_pressed("any"):
    go_title(self)
    return

if self.mode == "ready":
    ready_step(self)
elif self.mode == "windup":
    windup_step(self)
elif self.mode == "pitch":
    pitch_step(self)
elif self.mode == "hit":
    hit_step(self)
elif self.mode == "field":
    field_step(self)
elif self.mode == "result":
    result_step(self)
elif self.mode == "half":
    half_step(self)
elif self.mode == "final":
    if self.t - self.since > 90 and (keyboard_check_pressed("any") or button_pressed(0, 0)):
        go_title(self)
        music_play("organ", volume=0.4)

# === draw
# The ballpark itself is drawn in the room (which is exactly the screen), so
# the confetti of a home run, drawn by the engine in the room too, lands on
# top of it. Everything written over it is in Draw GUI.
if self.mode == "title":
    return
if self.mode == "field":
    draw_field_view(self)
else:
    draw_plate_view(self)

# === draw_gui
if self.mode == "title":
    draw_title(self.menu, self.t)
    return
if self.mode not in ("half", "final"):         # those have their own boards
    if derby():
        draw_derby_board()
    else:
        draw_scoreboard()
draw_pitch_tag(self)
draw_secret_target()
draw_pitch_menu()
if self.mode == "result":
    draw_words(AB["words"])
elif self.mode == "half":
    draw_half_card(self.t - self.since)
elif self.mode == "final":
    draw_final(self.t - self.since)
if MATCH.get("demo"):
    draw_hint("DEMO  -  press any key")
elif self.mode in ("ready", "windup", "pitch") and batter_is() is not None and pitcher_is() is None:
    draw_hint(f"Up and down to aim the swing,  {button_name(batter_is(), 0)} to swing")
if question_waiting():
    text(VIEW_W / 2, VIEW_H - 40, "Python question after this play", GOLD, 15, "center")
