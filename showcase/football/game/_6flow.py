# script: flow
# The Game's steps between plays: the title, the coin toss, the chalkboard,
# kickoffs, the whistle, the replay, the try, the season's screens, and
# back to the title. Each takes the Game instance as `game`.

REF = {"pose": None, "t": 0}     # what the referee is signalling, and for how long

# The slow-motion replay after a touchdown: the last REPLAY_KEEP steps of
# the play are kept (everyone's place and picture, and the ball's), and
# played back at REPLAY_SPEED.
REPLAY = {"frames": [], "i": 0.0, "on": False, "ball": None}
REPLAY_KEEP = 150
REPLAY_SPEED = 0.4


def go_title(game):
    game.mode, game.menu, game.idle = "title", 0, 0
    touch_controls(True, ("z", "x", "c"))       # a phone needs the buttons to pick from the menu
    sound_stop("crowd")
    set_teams()
    new_match({"home": None, "away": None})
    line_up("home", "away", 0, 0, MATCH["los"], MID)


def begin_match(game, humans, home="comets", away="badgers", two=False, season=False):
    """A new game between two LEAGUE teams: the crowd, then the coin toss."""
    set_teams(home, away)
    new_match(humans)
    champ = season and in_final()
    MATCH.update(two=two, season=season, champ=champ, no_ties=champ)
    touch_controls(not two, ("z", "x", "c"))
    sound_play("crowd", loop=True, volume=0.25)
    start_toss(game)


# ---------------------------------------------------------------- the coin toss

def start_toss(game):
    """The visitors call it — unless only the home team has a person playing, who then gets to."""
    game.mode, game.since = "toss", game.t
    humans = MATCH["humans"]
    caller = "home" if humans.get("home") is not None and humans.get("away") is None else "away"
    MATCH["toss"] = {"caller": caller, "call": None, "cursor": 0, "flip": 0, "result": None,
                     "winner": None, "choice": None}


def toss_step(game):
    toss = MATCH["toss"]
    waited = game.t - game.since
    if toss["call"] is None:
        c = MATCH["humans"].get(toss["caller"])
        if c is None:
            if waited > 40:
                toss["call"] = coin_toss_call()
        else:
            step = menu_moved(c)
            if step:
                toss["cursor"] = (toss["cursor"] + step) % 2
                sound_play("click", volume=0.4)
            if button_pressed(c, 0) and waited > 10:
                toss["call"] = ["HEADS", "TAILS"][toss["cursor"]]
        if toss["call"] is not None:
            toss["flip"] = 1
            sound_play("coin", volume=0.7)
        return
    if toss["result"] is None:
        toss["flip"] += 1
        if toss["flip"] >= 70:
            toss["result"] = choose(["HEADS", "TAILS"])
            toss["winner"] = toss["caller"] if toss["result"] == toss["call"] else other(toss["caller"])
            toss["cursor"] = 0
            game.since = game.t
            sound_play("coin", volume=0.7)
        return
    if toss["choice"] is None:
        c = MATCH["humans"].get(toss["winner"])
        if c is None:
            if waited > 40:
                toss["choice"] = "RECEIVE"          # the computer always wants the ball first
        else:
            step = menu_moved(c)
            if step:
                toss["cursor"] = (toss["cursor"] + step) % 2
                sound_play("click", volume=0.4)
            if button_pressed(c, 0) and waited > 10:
                toss["choice"] = ["RECEIVE", "KICK"][toss["cursor"]]
        if toss["choice"] is not None:
            game.since = game.t
        return
    if waited > 60 or (waited > 15 and any(button_pressed(c, 0) for c in MATCH["humans"].values() if c is not None)):
        kicker = toss["winner"] if toss["choice"] == "KICK" else other(toss["winner"])
        MATCH["first_kicker"] = kicker
        set_kickoff(kicker)
        start_kickoff(game)


# ---------------------------------------------------------------- lining up for the next play

def start_kickoff(game):
    """Both teams line up for a kickoff: no chalkboard, the kicker picks deep or onside."""
    line_up(MATCH["off"], MATCH["kickoff"], None, None, MATCH["los"], MATCH["ball_y"], play=KICKOFF)
    game.mode = "set"
    game.since = game.t


def start_call(game):
    """Both coaches to the chalkboard. The computer's coach picks at once."""
    game.mode = "call"
    game.since = game.t
    MATCH["chosen"] = {}
    MATCH["cursor"] = {"home": 0, "away": 0}
    off, deff = MATCH["off"], other(MATCH["off"])
    if MATCH["humans"].get(off) is None:
        MATCH["chosen"][off] = cpu_offense()
    if MATCH["humans"].get(deff) is None:
        MATCH["chosen"][deff] = cpu_defense()


def call_step(game):
    off, deff = MATCH["off"], other(MATCH["off"])
    for team, choices in ((off, plays_for(off)), (deff, list(range(len(DEFENSE))))):
        c = MATCH["humans"].get(team)
        if c is None or team in MATCH["chosen"]:
            continue
        step = menu_moved(c)
        if step:
            MATCH["cursor"][team] = (MATCH["cursor"][team] + step) % len(choices)
            sound_play("click", volume=0.4)
        if button_pressed(c, 0) and game.t - game.since > 10:
            MATCH["chosen"][team] = choices[MATCH["cursor"][team]]
            sound_play("click", volume=0.6)
    wait = 20 if MATCH.get("demo") else 0       # the demo lingers on the board a moment
    if len(MATCH["chosen"]) == 2 and game.t - game.since > wait:
        line_up(off, deff, MATCH["chosen"][off], MATCH["chosen"][deff], MATCH["los"], MATCH["ball_y"])
        game.mode = "set"
        game.since = game.t


def next_play(game):
    """After the whistle (and any replay): the try, a kickoff, or the chalkboard."""
    if MATCH.get("try"):
        game.mode, game.since, game.try_cursor = "try", game.t, 0
    elif MATCH.get("kickoff"):
        start_kickoff(game)
    else:
        start_call(game)


# ---------------------------------------------------------------- the try after a touchdown

def try_step(game):
    team = MATCH["try"]
    c = MATCH["humans"].get(team)
    waited = game.t - game.since
    if c is None:
        if waited > 50:
            choose_try(game, cpu_go_for_two(team))
        return
    step = menu_moved(c)
    if step:
        game.try_cursor = (game.try_cursor + step) % len(TRY_CHOICES)
        sound_play("click", volume=0.4)
    if button_pressed(c, 0) and waited > 10:
        choose_try(game, game.try_cursor == 1)


def choose_try(game, two):
    """Go for two: a play from the 3, picked on the chalkboard. Or kick it, from the 15."""
    scorer = MATCH["try"]
    if two:
        announce("two")
        start_call(game)
        return
    MATCH["los"], MATCH["ball_y"] = at_yards(scorer, PAT_YARDS), MID
    line_up(scorer, other(scorer), [p["name"] for p in OFFENSE].index("Field Goal"), 0, MATCH["los"], MID)
    game.mode = "set"
    game.since = game.t


# ---------------------------------------------------------------- the whistle

def blow_whistle(game):
    """The play is over: the rules decide what happened, the referee signals it,
    and the quarter ends if its clock ran out."""
    res = PLAY["result"]
    was_try = bool(MATCH.get("try"))
    scorer = res["team"] or PLAY["off"]
    signal = finish(res)
    REF["pose"], REF["t"] = signal, 120
    if signal == "touchdown":
        celebrate(game, scorer, res)
    game.replay_next = res["how"] == "touchdown" and not was_try and len(REPLAY["frames"]) > 30
    if not was_try:
        run_clock(KICK_SECONDS if res.get("kind") == "kickoff" else HUDDLE_SECONDS)
    if MATCH["clock"] <= 0 and not MATCH.get("try") and not MATCH["over"]:
        MATCH["says"].append(next_quarter())
        sound_play("horn", volume=0.6)
    elif MATCH["over"] and MATCH["quarter"] > 4:
        MATCH["says"].append("It's over in overtime!")
    game.mode = "whistle"
    game.since = game.t


def celebrate(game, scorer, res):
    """Points on the board: the scorers dance, confetti in the end zone, the mascot runs, the crowd roars."""
    game.mascot = 150
    for p in team_of(scorer):
        p.cheer = True
    if res["how"] == "touchdown":
        x = GOAL_R + 5 * YD if fwd(scorer) > 0 else GOAL_L - 5 * YD
        for k in range(3):
            effect("confetti", x, MID - 60 + k * 60, None, 1.2)
        sound_play("roar", volume=0.8)


def whistle_step(game):
    waited = game.t - game.since
    pressed = any(button_pressed(c, 0) for c in MATCH["humans"].values() if c is not None)
    if waited > 150 or (waited > 40 and pressed):
        if MATCH["over"]:
            end_match(game)
        elif game.replay_next:
            start_replay(game)
        else:
            next_play(game)


def end_match(game):
    game.mode = "final"
    game.since = game.t
    sound_stop("crowd")
    music_play("fight", volume=0.45)
    if MATCH.get("season") and not MATCH.get("recorded"):
        MATCH["recorded"] = True
        finish_week(MATCH["score"]["home"], MATCH["score"]["away"])


# ---------------------------------------------------------------- the replay

def record_frame():
    """This step of the play, kept for the replay."""
    ball = BALL[0]
    car = PLAY["carrier"]
    hidden = ball_tucked(car)
    REPLAY["frames"].append(([(p.x, p.y, p.sprite, p.image_index, p.image_xscale) for p in PLAYERS],
                             (ball.x, ball.y, ball.z, PLAY["ball"] in ("air", "kick"), hidden)))
    if len(REPLAY["frames"]) > REPLAY_KEEP:
        REPLAY["frames"].pop(0)


def start_replay(game):
    REPLAY["on"], REPLAY["i"] = True, 0.0
    game.mode, game.since = "replay", game.t
    replay_step(game)


def replay_step(game):
    """Everyone back where they were, a fraction of a step at a time."""
    frames = REPLAY["frames"]
    REPLAY["i"] += REPLAY_SPEED
    pressed = any(button_pressed(c, 0) for c in MATCH["humans"].values() if c is not None)
    if REPLAY["i"] >= len(frames) - 1 or (pressed and game.t - game.since > 20):
        end_replay(game)
        return
    k = int(REPLAY["i"])
    f = REPLAY["i"] - k
    (a, ba), (b, bb) = frames[k], frames[k + 1]
    for p, pa, pb in zip(PLAYERS, a, b):
        p.x, p.y = lerp(pa[0], pb[0], f), lerp(pa[1], pb[1], f)
        p.sprite, p.image_index, p.image_xscale = pa[2], pa[3], pa[4]
        p.depth = -int(p.y)
    ball = BALL[0]
    ball.x, ball.y, ball.z = lerp(ba[0], bb[0], f), lerp(ba[1], bb[1], f), lerp(ba[2], bb[2], f)
    REPLAY["ball"] = ba[3:]


def end_replay(game):
    REPLAY["on"] = False
    REPLAY["frames"] = []
    next_play(game)


# ---------------------------------------------------------------- a season's screens

def open_season(game):
    """The saved season if there is one, or a new one: pick a team first."""
    game.cursor = 0
    game.mode = "season" if load_season() else "pick"
    game.since = game.t


def pick_step(game):
    step = menu_moved(0)
    if step:
        game.cursor = (game.cursor + step) % len(LEAGUE)
        sound_play("click", volume=0.4)
    if button_pressed(0, 0) and game.t - game.since > 10:
        new_season(LEAGUE[game.cursor]["id"])
        game.mode, game.cursor, game.since = "season", 0, game.t
        sound_play("click", volume=0.6)


def season_step(game):
    words = season_words()
    step = menu_moved(0)
    if step:
        game.cursor = (game.cursor + step) % len(words)
        sound_play("click", volume=0.4)
    if not (button_pressed(0, 0) and game.t - game.since > 10):
        return
    picked = words[game.cursor]
    sound_play("click", volume=0.6)
    if picked.startswith("Play"):
        begin_match(game, {"home": 0, "away": None}, SEASON["team"], opponent(), season=True)
    elif picked == "New season":
        game.mode, game.cursor, game.since = "pick", 0, game.t
    else:
        go_title(game)
