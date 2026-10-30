# script: flow
# The Game's steps between plays: to the chalkboard, the whistle, back to
# the title. Each takes the Game instance as `game`.

REF = {"pose": None, "t": 0}     # what the referee is signalling, and for how long

def go_title(game):
    game.mode, game.menu, game.idle = "title", 0, 0
    touch_controls(False)
    new_match({"home": None, "away": None})
    line_up("home", "away", 0, 0, MATCH["los"], MID)


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


def blow_whistle(game):
    """The play is over: the rules decide what happened, the referee signals it,
    and the quarter ends if its clock ran out."""
    res = PLAY["result"]
    scorer = res["team"] or PLAY["off"]
    signal = finish(res)
    REF["pose"], REF["t"] = signal, 120
    if signal == "touchdown":
        game.mascot = 150
        for p in team_of(scorer):
            p.cheer = True
    run_clock(HUDDLE_SECONDS)
    if MATCH["clock"] <= 0:
        MATCH["says"].append(next_quarter())
    game.mode = "whistle"
    game.since = game.t
