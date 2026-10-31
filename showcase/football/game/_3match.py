# script: match
# The game around the plays: the coin toss, score, downs, kickoffs, the try
# after a touchdown, the clock, who has the ball, and the computer's coaches.
import random

MATCH = {}


def new_match(humans):
    """humans: which controller plays each team, e.g. {"home": 0, "away": None}.
    The teams are whoever set_teams last put in TEAMS. The match starts at the
    home team's own 25; the Game's flow tosses the coin and kicks off first."""
    MATCH.clear()
    MATCH.update(humans=humans, score={"home": 0, "away": 0}, quarter=1, clock=QUARTER_SECONDS,
                 picked={}, says=[], over=False, kickoff=None, first_kicker="away", no_ties=False)
    start_drive("home", 25)


def start_drive(team, own_yards=25, x=None, y=MID):
    """`team` gets the ball, first and ten: `own_yards` from its own goal
    line, or where a play ended (x, y). The first-down marker is set from
    the spot, so it must come after the ball is put down."""
    MATCH["off"] = team
    MATCH["down"] = 1
    MATCH["kickoff"] = None
    MATCH["try"] = None
    if x is None:
        MATCH["los"], MATCH["ball_y"] = at_yards(team, 100 - own_yards), MID
    else:
        spot_ball(x, y)
    set_first_down()


def set_kickoff(kicker, own_yards=KICKOFF_FROM):
    """`kicker` kicks off from its own 35 (or its 20 after a safety). Until it
    lands, the team with the ball (MATCH["off"]) is the one that will catch it."""
    MATCH["kickoff"] = kicker
    MATCH["try"] = None
    MATCH["off"] = other(kicker)
    MATCH["down"] = 1
    MATCH["los"], MATCH["ball_y"] = at_yards(kicker, 100 - own_yards), MID
    MATCH["first"] = MATCH["los"]


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
    if MATCH.get("kickoff"):
        return "Kickoff"
    if MATCH.get("try"):
        return "The try"
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
    """The plays the chalkboard offers: no field goal from too far out, and
    on a two-point try only runs and passes."""
    if MATCH.get("try"):
        return [i for i, p in enumerate(OFFENSE) if p["kind"] in ("run", "pass")]
    return [i for i, p in enumerate(OFFENSE) if p["kind"] != "kick" or can_kick()]


# ---------------------------------------------------------------- the computer's coaches

def lead(team):
    """How far ahead `team` is (behind is negative)."""
    return MATCH["score"][team] - MATCH["score"][other(team)]


def late():
    """The last minute and a half of the game."""
    return MATCH["quarter"] >= 4 and MATCH["clock"] <= 90


def situation():
    """The words the coaches' "use" tables are written in, for the team with the ball."""
    off = MATCH["off"]
    left, goal = to_go(), to_goal(off, MATCH["los"])
    tags = ["inch" if left <= 1 else "short" if left <= 3 else "long" if left >= 8 else "medium"]
    if MATCH["down"] == 1 and left >= 8:
        tags = ["medium"]               # first and ten is the ordinary down, not a long one
    if left <= 1:
        tags.append("short")            # a yard to go is short yardage too
    if goal <= 10:
        tags.append("goal")
    if late() and lead(off) < 0:
        tags.append("hurry")
    if MATCH["quarter"] >= 4 and lead(off) > 0:
        tags.append("clock")
    return tags


def liking(play, tags):
    """How much a coach likes a play here: its base, times its "use" for each situation."""
    w = play.get("base", 1)
    for tag in tags:
        w *= play.get("use", {}).get(tag, 1)
    return w


def pick_by_liking(book, allowed, tags):
    """A play from `allowed` (places in `book`), each as likely as the coach likes it."""
    weights = [liking(book[i], tags) for i in allowed]
    total = sum(weights)
    if total <= 0:
        return allowed[0]
    r = random.uniform(0, total)
    for i, w in zip(allowed, weights):
        r -= w
        if r <= 0:
            return i
    return allowed[-1]


def fourth_down():
    """On fourth down: "kick" a field goal, "punt", or "go" for it."""
    off = MATCH["off"]
    left, goal = to_go(), to_goal(off, MATCH["los"])
    if late() and lead(off) < 0:
        # Behind at the end: kick only if three points are enough, else a punt can't win it.
        return "kick" if can_kick() and lead(off) >= -3 else "go"
    if can_kick() and not (left <= 1 and goal <= 5):
        return "kick"
    if left <= 2 and goal <= 55:
        return "go"
    return "punt"


def cpu_offense():
    """What the computer coach calls on offence."""
    names = [p["name"] for p in OFFENSE]
    if MATCH.get("try"):
        return pick_by_liking(OFFENSE, plays_for(MATCH["off"]), situation())
    half_over = MATCH["quarter"] in (2, 4) and MATCH["clock"] <= HUDDLE_SECONDS + 2
    if half_over and can_kick() and (MATCH["quarter"] == 2 or -3 <= lead(MATCH["off"]) <= 0):
        return names.index("Field Goal")         # time for one more play: take the points
    if MATCH["down"] == 4:
        choice = fourth_down()
        if choice == "kick":
            return names.index("Field Goal")
        if choice == "punt":
            return names.index("Punt")
    runs_and_passes = [i for i, p in enumerate(OFFENSE) if p["kind"] in ("run", "pass")]
    return pick_by_liking(OFFENSE, runs_and_passes, situation())


def cpu_defense():
    """What the computer coach calls on defence, reading the offence's situation."""
    return pick_by_liking(DEFENSE, list(range(len(DEFENSE))), situation())


def cpu_go_for_two(team):
    """After a touchdown: in the second half, go for two when the score says to (GO_FOR_TWO)."""
    return MATCH["quarter"] >= 3 and lead(team) in GO_FOR_TWO


def cpu_onside(kicker):
    """Kick onside late in the game when behind, but not by too much."""
    return late() and MATCH["clock"] <= ONSIDE_WHEN_SECONDS and -ONSIDE_WHEN_BEHIND <= lead(kicker) < 0


def coin_toss_call():
    """The computer calls the toss."""
    return choose(["HEADS", "TAILS"])


# ---------------------------------------------------------------- what a play did

def score(team, points):
    MATCH["score"][team] += points
    sound_play("cheer", volume=0.7)
    if MATCH["quarter"] > 4 and lead(team) > 0:
        MATCH["over"] = True              # overtime is sudden death


def spot_ball(x, y):
    MATCH["los"] = clamp(x, GOAL_L + YD, GOAL_R - YD)
    MATCH["ball_y"] = clamp(y, MID - HASH, MID + HASH)


def finish(res):
    """A play is over: the score, the downs and who has the ball next.
    Returns what the referee signals."""
    how, x, y = res["how"], res["x"], res["y"]
    kind = res.get("kind")
    off = MATCH["off"]
    deff = other(off)
    d = TEAMS[off]["dir"]
    says = MATCH["says"] = []
    gained = round((x - MATCH["los"]) * d / YD)
    in_own_end = (d > 0 and x < GOAL_L) or (d < 0 and x > GOAL_R)

    if MATCH.get("try"):
        return finish_try(res)
    if how == "touchdown":
        scorer = res.get("team") or off
        score(scorer, TOUCHDOWN)
        says += ["TOUCHDOWN!", f"Six points to the {TEAMS[scorer]['name']}."]
        if not MATCH["over"]:
            # Now the try: kick for one or play for two, from in close.
            MATCH["off"], MATCH["down"], MATCH["try"] = scorer, 1, scorer
            MATCH["los"], MATCH["ball_y"] = at_yards(scorer, TRY_YARDS), MID
            set_first_down()
        return "touchdown"
    if kind == "kickoff":
        return finish_kickoff(res, in_own_end)
    if how in ("tackle", "sack", "out") and in_own_end:
        score(deff, 2)
        says += ["SAFETY!", f"Two points to the {TEAMS[deff]['name']}."]
        set_kickoff(off, SAFETY_KICK_FROM)      # and the team that gave it up kicks to them
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
        if not MATCH["over"]:
            set_kickoff(off)
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


def finish_kickoff(res, in_own_end):
    """A kickoff's end: a touchback, an onside kick recovered, or a return
    stopped (a returner downed in his own end zone is a touchback too)."""
    how, x, y = res["how"], res["x"], res["y"]
    rec = MATCH["off"]
    says = MATCH["says"]
    if how == "recovered":
        team = res["team"]
        says += ["ONSIDE KICK!", f"{TEAMS[team]['name']} come up with it!"]
        start_drive(team, x=x, y=y)
        return "first down" if team != rec else "whistle"
    if how == "touchback" or in_own_end:
        says += ["TOUCHBACK", f"{TEAMS[rec]['name']} ball on the {TOUCHBACK}."]
        start_drive(rec, TOUCHBACK)
        return "incomplete"
    start = res.get("from") if res.get("from") is not None else x
    back = round((x - start) * TEAMS[rec]["dir"] / YD)
    says += [f"Returned {back} yards" if back > 0 else "Stopped where he caught it"]
    start_drive(rec, x=x, y=y)
    return "whistle"


def finish_try(res):
    """The try after a touchdown: one point for the kick, two for a play into
    the end zone, nothing otherwise. Then the scorers kick off."""
    how = res["how"]
    scorer = MATCH["try"]
    says = MATCH["says"]
    if how == "field goal":
        score(scorer, 1)
        says += ["IT'S GOOD!", "The extra point."]
        signal = "touchdown"
    elif how == "touchdown" and res.get("kind") in ("run", "pass"):
        score(scorer, 2)
        says += ["TWO POINTS!", f"The {TEAMS[scorer]['name']} convert."]
        signal = "touchdown"
    else:
        says += ["NO GOOD!", "No points on the try."]
        signal = "incomplete"
    set_kickoff(scorer)
    return signal


def run_clock(seconds):
    """Takes time off the game clock. True when the quarter has just run out."""
    if MATCH["clock"] <= 0:
        return False
    MATCH["clock"] = max(0, MATCH["clock"] - seconds)
    return MATCH["clock"] == 0


def next_quarter():
    """After the clock runs out: the next quarter, the half, overtime, or the end."""
    q = MATCH["quarter"]
    if q >= 4:
        if MATCH["score"]["home"] != MATCH["score"]["away"] or not MATCH["no_ties"]:
            MATCH["over"] = True
            return f"FINAL: {TEAMS['home']['name']} {MATCH['score']['home']}, {TEAMS['away']['name']} {MATCH['score']['away']}"
        # A championship can't end tied: sudden-death overtime, the home team kicking.
        MATCH["quarter"] = q + 1
        MATCH["clock"] = QUARTER_SECONDS
        set_kickoff("home")
        return "OVERTIME! Next score wins."
    MATCH["quarter"] = q + 1
    MATCH["clock"] = QUARTER_SECONDS
    if q == 2:
        set_kickoff(other(MATCH["first_kicker"]))     # who kicked to start the game receives now
        return "HALFTIME"
    return f"End of the {['1st', '2nd', '3rd'][q - 1]} quarter"


def clock_words():
    s = int(-(-MATCH["clock"] // 1))
    return f"{s // 60}:{s % 60:02d}"
