# script: rules
# The field, the league, the teams and the playbook, as plain data. Change a
# route, a speed or a team's name here and the whole game follows: the
# chalkboard draws the plays from these same lists, and the computer's
# coaches read the "use" of each play to decide what to call.

# ---------------------------------------------------------------- the field
# Distances are in pixels. A yard is 12 pixels across the screen.
YD = 12
END_L, GOAL_L = 48, 168        # the back of the left end zone, the left goal line
GOAL_R, END_R = 1368, 1488     # the right goal line, the back of the right end zone
TOP, BOT = 64, 304             # the two sidelines
MID = 184                      # halfway between them
HASH = 40                      # the ball is always put down within this much of MID
VIEW_W, VIEW_H = 384, 216

# ---------------------------------------------------------------- the league
# Six teams. Their strengths change how they play (1 is ordinary):
#   speed  - how fast their players run
#   tackle - how surely they bring a runner down
#   arm    - how true their quarterback throws
# The build paints every team's players from the Comets' pictures in these
# colours (the Badgers have pictures of their own). Names fit 8 letters.
LEAGUE = [
    {"id": "comets", "name": "COMETS", "color": "#2b4aa8", "trim": "#f2c230",
     "speed": 1.0, "tackle": 1.0, "arm": 1.06, "says": "A sharp passing team."},
    {"id": "badgers", "name": "BADGERS", "color": "#c8352e", "trim": "#ffffff",
     "speed": 0.97, "tackle": 1.08, "arm": 0.97, "says": "Tough. They hit hard."},
    {"id": "gators", "name": "GATORS", "color": "#2e8b3e", "trim": "#f08a24",
     "speed": 1.07, "tackle": 0.94, "arm": 0.97, "says": "Quick, but they miss tackles."},
    {"id": "storm", "name": "STORM", "color": "#6a3fb5", "trim": "#d6d6e4",
     "speed": 1.02, "tackle": 1.02, "arm": 1.0, "says": "Good at everything."},
    {"id": "rockets", "name": "ROCKETS", "color": "#e0601c", "trim": "#1d2a5a",
     "speed": 1.09, "tackle": 0.95, "arm": 0.94, "says": "The fastest legs around."},
    {"id": "pirates", "name": "PIRATES", "color": "#4a4a58", "trim": "#d23b2b",
     "speed": 0.94, "tackle": 1.05, "arm": 1.1, "says": "A big arm and slow feet."},
]


def league_team(tid):
    """The LEAGUE entry with this id."""
    return next(t for t in LEAGUE if t["id"] == tid)


# The two teams on the field tonight. "home" always attacks to the right,
# "away" to the left; set_teams fills them in from the LEAGUE.
TEAMS = {"home": {}, "away": {}}


def set_teams(home="comets", away="badgers"):
    for slot, tid, d in (("home", home, 1), ("away", away, -1)):
        TEAMS[slot].clear()
        TEAMS[slot].update(league_team(tid), dir=d)


set_teams()

QUARTER_SECONDS = 120          # each of the four quarters, on the game clock
HUDDLE_SECONDS = 10            # how much a play's huddle takes off the clock
KICK_SECONDS = 5               # and a kickoff's

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

# ---------------------------------------------------------------- the ball carrier's moves
# Each can be used once a play, by whoever has the ball (the computer's
# runners use them too). While a move lasts, a tackle is broken `break` of
# the time — the tackler is left on the grass for `floors` steps — and the
# runner goes at `pace` of his speed. A juke also cuts him sideways.
MOVES = {
    "spin":  {"button": 0, "steps": 24, "break": 0.8, "pace": 0.7, "floors": 30},
    "juke":  {"button": 1, "steps": 16, "break": 0.65, "pace": 1.0, "floors": 40, "cut": 2.6},
    "stiff": {"button": 2, "steps": 20, "break": 0.55, "pace": 0.85, "floors": 70},
}
CPU_MOVE_CHANCE = 0.12         # each step a tackler is close, how likely the computer's runner tries a move

# ---------------------------------------------------------------- catching
CATCH_REACH = 18               # how close the ball must come down to a receiver for him to catch it
DIVE_REACH = 32                # ...or to a receiver diving for it
DIVE_STEPS = 14                # how long a dive flies before he hits the grass
DIVE_CATCH = 0.75              # how often a diving receiver holds on to it

# ---------------------------------------------------------------- kicking
FIELD_GOAL_RANGE = 38          # yards from the goal line: any further and the coach won't try
PUNT_YARDS = 40
KICKOFF_FROM = 35              # the kicking team kicks off from its own 35
SAFETY_KICK_FROM = 20          # ...or its own 20, after giving up a safety
KICKOFF_YARDS = (52, 70)       # how far a deep kickoff goes, somewhere between these
KICKOFF_HANG = 85              # steps a deep kickoff is in the air
ONSIDE_YARDS = (10, 14)        # an onside kick only has to go 10
ONSIDE_RECOVER = 0.3           # how often the kicking team comes up with an onside kick
TOUCHBACK = 25                 # a kickoff into the end zone: the ball on the 25
ONSIDE_WHEN_BEHIND = 16        # the computer kicks onside late in the game when this far behind or less...
ONSIDE_WHEN_SECONDS = 90       # ...and there's this little time left

# ---------------------------------------------------------------- after a touchdown
TOUCHDOWN = 6
TRY_CHOICES = ["Kick: 1 point", "Go for 2"]   # the kick is first, so it's what a quick press picks
TRY_YARDS = 3                  # a two-point try is one play from the 3
PAT_YARDS = 15                 # the extra-point kick is from the 15
PAT_ALLOWED = 0.8              # its meter's green is wide: an extra point is nearly always good
# In the second half, the computer goes for two when, after the touchdown,
# it leads (+) or trails (-) by one of these:
GO_FOR_TWO = [-2, -5, -9, -10, 1, 5, 12]

# ---------------------------------------------------------------- what the announcer says
LOOSE_YARDS = 25               # "HE'S LOOSE!" once a runner is this far past the line...
LOOSE_RETURN = 35              # ...or a kick returner this far from where he caught it
CALLS = {
    "spin": "HE SPINS RIGHT OUT OF IT!",
    "juke": "WHAT A JUKE! LEFT HIM IN THE GRASS!",
    "stiff": "STIFF-ARM! GET OFF ME!",
    "dive": "A DIVING CATCH!",
    "loose": "HE'S LOOSE!",
    "gone": "HE COULD GO ALL THE WAY!",
    "pick": "PICKED OFF!",
    "sack": "SACKED! BURIED HIM!",
    "hit": "WHAT A HIT!",
    "return": "HE BRINGS IT OUT...",
    "onside": "AN ONSIDE KICK!",
    "two": "THEY'RE GOING FOR TWO!",
    "pitch": "HE PITCHES IT!",
    "reverse": "IT'S A REVERSE!",
}

# ---------------------------------------------------------------- the playbook
# Each route is a list of points (forward, across) in pixels from where the
# player lined up: forward is toward the goal the team attacks, across is
# down the screen. A player with no route blocks.
#   carrier  - who runs with it on a run (the quarterback hands it to him)
#   toss     - pitched to the carrier instead of handed
#   pitch    - an option: the carrier keeps it until he's about to be hit,
#              then pitches it to this player (or you press the first button)
#   reverse  - the carrier hands it on to this player, running the other way
#   fake     - a play-action pass: the quarterback fakes the handoff to him first
#   targets  - who receivers 1, 2 and 3 are on a pass (WR1 WR2 WR3 if not given)
#   look     - the computer's quarterback looks to him first
#   base     - how often the computer's coach thinks of it at all (1 if not given)
#   use      - how much more or less he likes it, by the situation: inch (a
#              yard to go), short, medium, long (8 or more), goal (inside the
#              10), hurry (behind late), clock (ahead late). Anything not
#              named counts 1; 0 means never.
OFFENSE = [
    {"name": "Dive", "kind": "run", "carrier": "RB",
     "says": "Hand it to the running back, straight up the middle.",
     "routes": {"RB": [(40, 0), (400, 0)], "QB": [(-6, -6), (-14, -30)]},
     "use": {"inch": 2, "short": 2.5, "long": 0.3, "hurry": 0.2, "clock": 4}},
    {"name": "Sweep", "kind": "run", "carrier": "RB", "toss": True,
     "says": "Toss it to the running back and get round the edge.",
     "routes": {"RB": [(14, 34), (56, 64), (400, 64)], "QB": [(-8, 10)]},
     "use": {"short": 1.5, "long": 0.5, "hurry": 0.3, "clock": 3, "goal": 1.2}},
    {"name": "QB Sneak", "kind": "run", "carrier": "QB", "base": 0.1,
     "says": "The quarterback keeps it and pushes ahead behind the line.",
     "routes": {"QB": [(30, 0), (400, 0)]},
     "use": {"inch": 40, "short": 3, "medium": 0.1, "long": 0, "hurry": 0.1}},
    {"name": "Option", "kind": "run", "carrier": "QB", "pitch": "RB", "base": 0.6,
     "says": "The QB runs wide. Pitch it to the back before he's hit.",
     "routes": {"QB": [(0, 30), (30, 70), (400, 70)], "RB": [(14, 50), (40, 100), (400, 100)]},
     "use": {"short": 1.5, "long": 0.4, "clock": 2, "hurry": 0.3}},
    {"name": "Screen", "kind": "pass", "targets": ["RB", "WR1", "WR2"], "look": "RB", "base": 0.7,
     "says": "Let them rush, then flip it to the back behind a wall.",
     "routes": {"QB": [(-34, 0)], "RB": [(-6, 40), (-10, 64)], "L1": [(-4, 0), (-10, 60)],
                "L2": [(-4, 0), (-6, 44)], "WR1": [(30, 0), (30, -10)], "WR2": [(30, 0), (30, 10)]},
     "use": {"long": 2, "short": 0.4, "goal": 0.3}},
    {"name": "Slants", "kind": "pass",
     "says": "Quick throws: the outside receivers cut in across the middle.",
     "routes": {"QB": [(-26, 0)], "WR1": [(24, 0), (110, 70)], "WR2": [(24, 0), (110, -70)],
                "WR3": [(60, 0), (60, -50)]},
     "use": {"medium": 1.5, "hurry": 2}},
    {"name": "Play-Action", "kind": "pass", "fake": "RB", "base": 0.7,
     "says": "Fake the handoff, the linebackers bite, then throw deep.",
     "routes": {"QB": [(-4, 0), (-8, -6), (-40, 0)], "RB": [(40, 0), (50, -30)], "WR1": [(200, 0)],
                "WR2": [(40, 0), (180, -60)], "WR3": [(100, 0), (100, 60)]},
     "use": {"short": 1.5, "goal": 1.5, "clock": 0.4}},
    {"name": "Deep", "kind": "pass", "base": 0.8,
     "says": "Everyone goes long. Wait for someone to get past the defense.",
     "routes": {"QB": [(-36, 0)], "WR1": [(220, 0)], "WR2": [(30, 0), (240, -40)],
                "WR3": [(80, 0), (80, 70)], "RB": [(-10, -40), (50, -80)]},
     "use": {"long": 3, "hurry": 3, "short": 0.3, "inch": 0, "goal": 0, "clock": 0.2}},
    {"name": "Reverse", "kind": "run", "carrier": "RB", "reverse": "WR1", "base": 0.15,
     "says": "A trick: the back runs up and hands it to a receiver going down.",
     "routes": {"RB": [(30, 0), (24, -40)], "QB": [(-8, 10)],
                "WR1": [(-24, 40), (-36, 116), (30, 170), (400, 170)]},
     "use": {"long": 1.5, "inch": 0, "goal": 0}},
    {"name": "Punt", "kind": "punt", "says": "Kick it away: they start a long way back."},
    {"name": "Field Goal", "kind": "kick", "says": "Three points if it goes between the posts."},
]

# The kickoff: not on the chalkboard; the first button kicks it deep and the
# second kicks it onside. The receiving team lines up `back` pixels from the
# ball, its running back the returner; the kicking team stands at the ball
# (its safety kicks) and runs down the field.
KICKOFF = {"name": "Kickoff", "kind": "kickoff", "says": "Kick it deep, or onside."}
KICKOFF_LINEUP = {
    "RB": (720, 0), "WR3": (660, 40), "QB": (420, 0), "L1": (150, -30), "L2": (150, 30),
    "WR1": (230, -80), "WR2": (230, 80),
    "S": (16, 0), "DL1": (4, -24), "DL2": (4, 24), "LB1": (4, -56), "LB2": (4, 56),
    "CB1": (4, -100), "CB2": (4, 100),
}

# Defence: a job for each position. "rush" goes for the ball; "man WR1 20"
# sticks to WR1, 20 pixels deeper; "zone 50 0" guards that point (forward,
# across) from the line; "spy RB" shadows the running back and pounces.
# "base" and "use" are as the offence's: the computer's coach reads the
# offence's situation.
DEFENSE = [
    {"name": "Run Stop", "says": "Everyone close: stop them on the ground.",
     "jobs": {"DL1": "rush", "DL2": "rush", "LB1": "spy RB", "LB2": "spy RB",
              "CB1": "man WR1 10", "CB2": "man WR2 10", "S": "zone 50 0"},
     "use": {"short": 3, "inch": 2, "long": 0.3, "clock": 2}},
    {"name": "Blitz", "says": "Send the linebackers after the quarterback.",
     "jobs": {"DL1": "rush", "DL2": "rush", "LB1": "rush", "LB2": "rush",
              "CB1": "man WR1 8", "CB2": "man WR2 8", "S": "man WR3 10"},
     "use": {"medium": 1.5, "hurry": 0.5}},
    {"name": "Cover", "says": "Drop back and guard the long pass.",
     "jobs": {"DL1": "rush", "DL2": "rush", "LB1": "man WR3 14", "LB2": "zone 60 0",
              "CB1": "man WR1 30", "CB2": "man WR2 30", "S": "zone 140 0"},
     "use": {"long": 3, "hurry": 2, "short": 0.4}},
    {"name": "Zone", "says": "Everyone guards a spot, and whoever comes into it.",
     "jobs": {"DL1": "rush", "DL2": "rush", "LB1": "zone 50 -50", "LB2": "zone 50 50",
              "CB1": "zone 110 -90", "CB2": "zone 110 90", "S": "zone 170 0"},
     "use": {"medium": 2, "long": 2, "short": 0.6}},
    {"name": "Prevent", "says": "All deep: give them the short ones, never the long.", "base": 0.2,
     "jobs": {"DL1": "rush", "DL2": "rush", "LB1": "zone 90 -40", "LB2": "zone 90 40",
              "CB1": "man WR1 60", "CB2": "man WR2 60", "S": "zone 240 0"},
     "use": {"hurry": 60, "long": 2, "short": 0, "inch": 0, "goal": 0}},
    {"name": "Goal Line", "says": "Everyone up on the line: not one more inch.", "base": 0.2,
     "jobs": {"DL1": "rush", "DL2": "rush", "LB1": "rush", "LB2": "spy QB",
              "CB1": "man WR1 4", "CB2": "man WR2 4", "S": "spy RB"},
     "use": {"inch": 15, "goal": 4, "short": 2, "medium": 0.3, "long": 0}},
]

# ---------------------------------------------------------------- a season
SIM_DRIVES = 7                 # drives each team gets in a game the computer plays out without you
SIM_TOUCHDOWN = 0.26           # how often an ordinary drive ends in a touchdown...
SIM_FIELD_GOAL = 0.14          # ...or a field goal


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
