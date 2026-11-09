# script: room
# Undertow in a room: the rules of a round, and the words that carry it.
#
# ONE GAME IS IN CHARGE (net_host()): it deals the roles, checks every freeze,
# report and vote, and decides who wins. Everything public about the round (its
# phase, who's frozen, where the bodies are, who has voted) goes out in that
# game's net_send as "g", and every game draws from it. Anything secret goes
# privately: the host tells each player their role (net_tell), and players tell
# the host what they do. A Mimic's freeze is never shouted, so nobody can see who
# froze whom by watching the room's traffic.
#
# If the host leaves, or is answering a question, the next player's game takes
# over from its copy of "g", and everyone tells it their role again.

MIN_PLAYERS = 3          # to start a round (4 or more is better)
FREEZE_REACH = 48        # pixels between a Mimic and who they freeze
FREEZE_WAIT = 25 * 60    # steps between a Mimic's freezes
FIRST_WAIT = 12 * 60     # ...and before their first, after a round or meeting starts
REPORT_REACH = 64        # pixels from a frozen crew member to report them
CALLS_EACH = 1           # beacon meetings each player may call in a round
MEETING_STEPS = 60 * 60  # to talk and vote
RESULT_STEPS = 6 * 60    # showing who was sent up
OVER_STEPS = 10 * 60     # showing who won, then back to waiting
SAY_WAIT = 90            # steps between a player's phrases
GONE_STEPS = 90 * 60     # a player not seen this long has left the round
SLACK = 40               # pixels the host allows for the room's delay
LIGHT = {"crew": 150, "mimic": 210, "ghost": 260}

# What can be said in a meeting: a phrase, and what it needs filled in
# ("n" a player's number, "room" a room).
PHRASES = [
    ("where", "I was in {room}.", ("room",)),
    ("saw", "I saw #{n} in {room}.", ("n", "room")),
    ("with", "I was with #{n}.", ("n",)),
    ("sus", "#{n} is suspicious.", ("n",)),
    ("safe", "#{n} is safe.", ("n",)),
    ("found", "They were in {room}.", ("room",)),
    ("jobs", "I was doing my jobs.", ()),
    ("who", "Who did it?", ()),
    ("agree", "I agree.", ()),
    ("skip", "Let's skip this vote.", ()),
]
PHRASE_KEYS = [p[0] for p in PHRASES]


def mimic_count(players):
    """How many Mimics a round has: one, two from 7 players, three from 13."""
    return 1 if players <= 6 else 2 if players <= 12 else 3


def phrase_text(key, n=None, room=None):
    """A phrase's words, filled in. Anything that doesn't fit is None (and isn't said)."""
    if key not in PHRASE_KEYS:
        return None
    _, text, needs = PHRASES[PHRASE_KEYS.index(key)]
    if "n" in needs and not isinstance(n, int):
        return None
    if "room" in needs and room not in [r[0] for r in ROOMS]:
        return None
    return text.format(n=n, room=room)


def seat(k, count):
    """Where the k-th of `count` players stands in the Meeting Hub: round the table, the beacon in its middle (out of reach)."""
    cx, cy = tile_middle(*BEACON)
    a = 2 * math.pi * k / max(1, count) - math.pi / 2
    return cx + math.cos(a) * 112, cy + math.sin(a) * 84


def new_game():
    """The public state of a room before any round: waiting in the station."""
    return {"v": 0, "ph": "lobby", "r": 0, "t": 0, "in": [], "fz": [], "out": [], "left": [], "b": [],
            "jobs": [0, 0], "call": None, "found": None, "voted": [], "tally": [], "ej": None, "em": None,
            "win": None, "why": "", "mm": []}


def ghosts(g):
    """Everyone out of the round but still watching: frozen, sent up, or gone."""
    return set(g["fz"]) | set(g["out"]) | set(g["left"])


def tally(votes, voters):
    """
    Who is sent up: the most votes, if more than voted to skip and not a tie.
    `votes` is {voter: their pick, 0 to skip}; only `voters` count. Returns the
    number (or None) and the count for each, as [[pick, votes], ...].
    """
    count = {}
    for v in voters:
        pick = votes.get(v, 0)
        count[pick] = count.get(pick, 0) + 1
    ranked = sorted(count.items(), key=lambda kv: -kv[1])
    out = None
    if ranked and ranked[0][0] != 0 and (len(ranked) == 1 or ranked[1][1] < ranked[0][1]):
        out = ranked[0][0]
    return out, sorted([[k, c] for k, c in count.items()])


def winner(g, roles):
    """Who has won, and why, or (None, ""): every Mimic sent up, the jobs all done, or as many Mimics as crew."""
    gone = ghosts(g)
    crew = [n for n in g["in"] if roles.get(n) == "crew" and n not in gone]
    mimics = [n for n in g["in"] if roles.get(n) == "mimic" and n not in gone]
    if not mimics:
        return "crew", "Every Mimic was found."
    done, total = g["jobs"]
    if total and done >= total:
        return "crew", "The crew fixed the whole station."
    if len(mimics) >= len(crew):
        return "mimics", "The Mimics took over the station."
    return None, ""
