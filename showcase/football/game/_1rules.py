# script: rules
# The field, the teams and the playbook, as plain data. Change a route, a
# speed or a team's name here and the whole game follows: the chalkboard
# draws the plays from these same lists.

# ---------------------------------------------------------------- the field
# Distances are in pixels. A yard is 12 pixels across the screen.
YD = 12
END_L, GOAL_L = 48, 168        # the back of the left end zone, the left goal line
GOAL_R, END_R = 1368, 1488     # the right goal line, the back of the right end zone
TOP, BOT = 64, 304             # the two sidelines
MID = 184                      # halfway between them
HASH = 40                      # the ball is always put down within this much of MID
VIEW_W, VIEW_H = 384, 216

# ---------------------------------------------------------------- the teams
# The Comets always attack to the right, the Badgers to the left.
TEAMS = {
    "home": {"name": "COMETS", "color": "#2b4aa8", "trim": "#f2c230", "dir": 1},
    "away": {"name": "BADGERS", "color": "#c8352e", "trim": "#ffffff", "dir": -1},
}
QUARTER_SECONDS = 120          # each of the four quarters, on the game clock
HUDDLE_SECONDS = 10            # how much a play's huddle takes off the clock

# Every team has seven players. On offence they play these positions, on
# defence those, in the same order (the first player is QB on offence and
# a lineman on defence).
OFFENSE_ROLES = ["QB", "RB", "L1", "L2", "WR1", "WR2", "WR3"]
DEFENSE_ROLES = ["DL1", "DL2", "LB1", "LB2", "CB1", "CB2", "S"]

# Where each lines up: (back, across) — pixels behind (offence) or in front
# of (defence) the line of scrimmage, and across from the ball, down is +.
LINEUP = {
    "QB": (22, 0), "RB": (54, 0), "L1": (6, -14), "L2": (6, 14),
    "WR1": (8, -92), "WR2": (8, 92), "WR3": (10, 44),
    "DL1": (10, -14), "DL2": (10, 14), "LB1": (46, -30), "LB2": (46, 30),
    "CB1": (24, -92), "CB2": (24, 92), "S": (110, 0),
}

# How fast each kind of player runs, in pixels a step (60 steps a second).
SPEED = {"QB": 1.55, "RB": 1.95, "L": 1.25, "WR": 1.9, "DL": 1.4, "LB": 1.6, "CB": 1.8, "S": 1.7}
TACKLE_REACH = 10              # how close a defender must get to bring the ball carrier down
# How often a tackle brings him down, by who's tackling: the safety is the
# last man and the surest. A dive rarely misses, and a quarterback holding
# the ball has his mind on the throw.
TACKLE_CHANCE = {"DL": 0.6, "LB": 0.65, "CB": 0.7, "S": 0.85, "QB": 0.85, "dive": 0.85}
CARRY_PACE = 0.88              # carrying the ball slows anyone down: pursuit can catch him
BLOCK_STEPS = 70               # how long a block holds a defender
PASS_SPEED = 4.2               # how fast a thrown ball flies, in pixels a step
THROW_ERROR = 0.07             # how far off a throw can land, for each pixel it travels

# ---------------------------------------------------------------- the playbook
# Each route is a list of points (forward, across) in pixels from where the
# player lined up: forward is toward the goal the team attacks, across is
# down the screen. A player with no route blocks.
OFFENSE = [
    {"name": "Dive", "kind": "run", "carrier": "RB",
     "says": "Hand it to the running back, straight up the middle.",
     "routes": {"RB": [(40, 0), (400, 0)], "QB": [(-6, -6), (-14, -30)]}},
    {"name": "Sweep", "kind": "run", "carrier": "RB", "toss": True,
     "says": "Toss it to the running back and get round the edge.",
     "routes": {"RB": [(14, 34), (56, 64), (400, 64)], "QB": [(-8, 10)]}},
    {"name": "Slants", "kind": "pass",
     "says": "Quick throws: the outside receivers cut in across the middle.",
     "routes": {"QB": [(-26, 0)], "WR1": [(24, 0), (110, 70)], "WR2": [(24, 0), (110, -70)],
                "WR3": [(60, 0), (60, -50)]}},
    {"name": "Deep", "kind": "pass",
     "says": "Everyone goes long. Wait for someone to get past the defense.",
     "routes": {"QB": [(-36, 0)], "WR1": [(220, 0)], "WR2": [(30, 0), (240, -40)],
                "WR3": [(80, 0), (80, 70)], "RB": [(-10, -40), (50, -80)]}},
    {"name": "Punt", "kind": "punt", "says": "Kick it away: they start a long way back."},
    {"name": "Field Goal", "kind": "kick", "says": "Three points if it goes between the posts."},
]
FIELD_GOAL_RANGE = 38          # yards from the goal line: any further and the coach won't try
PUNT_YARDS = 40

# Defence: a job for each position. "rush" goes for the ball; "man WR1 20"
# sticks to WR1, 20 pixels deeper; "zone 50 0" guards that point (forward,
# across) from the line; "spy RB" shadows the running back and pounces.
DEFENSE = [
    {"name": "Run Stop", "says": "Everyone close: stop them on the ground.",
     "jobs": {"DL1": "rush", "DL2": "rush", "LB1": "spy RB", "LB2": "spy RB",
              "CB1": "man WR1 10", "CB2": "man WR2 10", "S": "zone 50 0"}},
    {"name": "Blitz", "says": "Send the linebackers after the quarterback.",
     "jobs": {"DL1": "rush", "DL2": "rush", "LB1": "rush", "LB2": "rush",
              "CB1": "man WR1 8", "CB2": "man WR2 8", "S": "man WR3 10"}},
    {"name": "Cover", "says": "Drop back and guard the long pass.",
     "jobs": {"DL1": "rush", "DL2": "rush", "LB1": "man WR3 14", "LB2": "zone 60 0",
              "CB1": "man WR1 30", "CB2": "man WR2 30", "S": "zone 140 0"}},
]


def kind_of(role):
    """"WR2" → "WR", "L1" → "L": the speed table's name for a position."""
    return role.rstrip("0123456789")


def to_goal(team, x):
    """Yards from x to the goal line `team` is attacking."""
    if TEAMS[team]["dir"] > 0:
        return (GOAL_R - x) / YD
    return (x - GOAL_L) / YD


def at_yards(team, yards):
    """The x that is `yards` from the goal `team` is attacking."""
    if TEAMS[team]["dir"] > 0:
        return GOAL_R - yards * YD
    return GOAL_L + yards * YD


def other(team):
    return "away" if team == "home" else "home"
