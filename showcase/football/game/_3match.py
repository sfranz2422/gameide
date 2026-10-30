# script: match
# The game around the plays: score, downs, the clock, who has the ball,
# and the computer's play calling.

MATCH = {}


def new_match(humans):
    """humans: which controller plays each team, e.g. {"home": 0, "away": None}."""
    MATCH.clear()
    MATCH.update(humans=humans, score={"home": 0, "away": 0}, quarter=1, clock=QUARTER_SECONDS,
                 picked={}, says=[], over=False)
    start_drive("home", 25)


def start_drive(team, own_yards=25, x=None, y=MID):
    """`team` gets the ball, first and ten: `own_yards` from its own goal
    line, or where a play ended (x, y). The first-down marker is set from
    the spot, so it must come after the ball is put down."""
    MATCH["off"] = team
    MATCH["down"] = 1
    if x is None:
        MATCH["los"], MATCH["ball_y"] = at_yards(team, 100 - own_yards), MID
    else:
        spot_ball(x, y)
    set_first_down()


def set_first_down():
    team = MATCH["off"]
    MATCH["first"] = MATCH["los"] + TEAMS[team]["dir"] * 10 * YD
    if to_goal(team, MATCH["first"]) <= 0:
        MATCH["first"] = GOAL_R if TEAMS[team]["dir"] > 0 else GOAL_L


def to_go():
    """Yards still needed for a first down, rounded up as a referee would."""
    return max(1, int(-(-abs(MATCH["first"] - MATCH["los"]) // YD)))


def goal_to_go():
    return MATCH["first"] in (GOAL_L, GOAL_R)


def down_words():
    nth = ["1st", "2nd", "3rd", "4th"][MATCH["down"] - 1]
    return f"{nth} & {'Goal' if goal_to_go() else to_go()}"


def spot_words():
    yards = round(to_goal(MATCH["off"], MATCH["los"]))
    if yards == 50:
        return "on the 50"
    return f"on the opp {yards}" if yards < 50 else f"on own {100 - yards}"


def can_kick():
    return to_goal(MATCH["off"], MATCH["los"]) <= FIELD_GOAL_RANGE


def plays_for(team):
    """The plays the chalkboard offers: no field goal from too far out."""
    return [i for i, p in enumerate(OFFENSE) if p["kind"] != "kick" or can_kick()]


def cpu_offense():
    """What the computer coach calls on offence."""
    left, goal = to_go(), to_goal(MATCH["off"], MATCH["los"])
    names = [p["name"] for p in OFFENSE]
    if MATCH["down"] == 4:
        if can_kick() and not (left <= 1 and goal <= 5):
            return names.index("Field Goal")
        if left > 2 or goal > 55:
            return names.index("Punt")
    if left <= 3:
        return names.index(choose(["Dive", "Sweep", "Dive", "Slants"]))
    if left >= 8:
        return names.index(choose(["Slants", "Deep", "Deep", "Sweep"]))
    return names.index(choose(["Dive", "Sweep", "Slants", "Deep"]))


def cpu_defense():
    left = to_go()
    names = [p["name"] for p in DEFENSE]
    if left <= 3:
        return names.index(choose(["Run Stop", "Run Stop", "Blitz"]))
    if left >= 8:
        return names.index(choose(["Cover", "Cover", "Blitz"]))
    return names.index(choose(["Run Stop", "Blitz", "Cover"]))


def score(team, points):
    MATCH["score"][team] += points
    sound_play("cheer", volume=0.7)


def spot_ball(x, y):
    MATCH["los"] = clamp(x, GOAL_L + YD, GOAL_R - YD)
    MATCH["ball_y"] = clamp(y, MID - HASH, MID + HASH)


def finish(res):
    """A play is over: the score, the downs and who has the ball next.
    Returns what the referee signals."""
    how, x, y = res["how"], res["x"], res["y"]
    off = MATCH["off"]
    deff = other(off)
    d = TEAMS[off]["dir"]
    says = MATCH["says"] = []
    gained = round((x - MATCH["los"]) * d / YD)
    in_own_end = (d > 0 and x < GOAL_L) or (d < 0 and x > GOAL_R)

    if how == "touchdown":
        score(off, 7)
        says += ["TOUCHDOWN!", f"{TEAMS[off]['name']} score. The extra point is good."]
        start_drive(deff, 25)
        return "touchdown"
    if how in ("tackle", "sack", "out") and in_own_end:
        score(deff, 2)
        says += ["SAFETY!", f"Two points to the {TEAMS[deff]['name']}."]
        start_drive(deff, 30)      # they'd kick it to the scorers; we skip the kick
        return "whistle"
    if how == "interception":
        says += ["INTERCEPTED!", f"{TEAMS[deff]['name']} ball."]
        own = 100 - to_goal(deff, x)
        if own <= 0:
            start_drive(deff, 25)   # caught in their own end zone: a touchback
        else:
            start_drive(deff, x=x, y=y)
        return "incomplete"
    if how == "punt":
        own = 100 - to_goal(deff, x)
        says += ["PUNT", f"{TEAMS[deff]['name']} ball" + (", touchback." if own <= 0 else ".")]
        if own <= 0:
            start_drive(deff, 20)
        else:
            start_drive(deff, x=x, y=y)
        return "whistle"
    if how == "field goal":
        score(off, 3)
        says += ["IT'S GOOD!", f"Three points to the {TEAMS[off]['name']}."]
        start_drive(deff, 25)
        return "touchdown"
    if how == "missed kick":
        says += ["NO GOOD!", f"{TEAMS[deff]['name']} take over."]
        start_drive(deff, x=MATCH["los"])
        return "incomplete"

    if how in ("incomplete", "broken up"):
        says.append("INCOMPLETE" if how == "incomplete" else "BROKEN UP!")
        signal = "incomplete"
    else:
        spot_ball(x, y)
        says.append(("SACKED! " if how == "sack" else "") + (f"Gain of {gained}" if gained > 0 else
                    f"Loss of {-gained}" if gained < 0 else "No gain"))
        signal = "whistle"
    if (MATCH["los"] - MATCH["first"]) * d >= 0:
        MATCH["down"] = 1
        set_first_down()
        says.append("FIRST DOWN!")
        return "first down"
    MATCH["down"] += 1
    if MATCH["down"] > 4:
        says.append(f"Turnover on downs. {TEAMS[deff]['name']} ball.")
        start_drive(deff, x=MATCH["los"], y=MATCH["ball_y"])
        return "incomplete"
    return signal


def run_clock(seconds):
    """Takes time off the game clock. True when the quarter has just run out."""
    if MATCH["clock"] <= 0:
        return False
    MATCH["clock"] = max(0, MATCH["clock"] - seconds)
    return MATCH["clock"] == 0


def next_quarter():
    """After the clock runs out: the next quarter, the half, or the end."""
    q = MATCH["quarter"]
    if q >= 4:
        MATCH["over"] = True
        return f"FINAL: {TEAMS['home']['name']} {MATCH['score']['home']}, {TEAMS['away']['name']} {MATCH['score']['away']}"
    MATCH["quarter"] = q + 1
    MATCH["clock"] = QUARTER_SECONDS
    if q == 2:
        start_drive("away", 25)    # the Badgers get the ball to start the second half
        return "HALFTIME"
    return f"End of the {['1st', '2nd', '3rd'][q - 1]} quarter"


def clock_words():
    s = int(-(-MATCH["clock"] // 1))
    return f"{s // 60}:{s % 60:02d}"
