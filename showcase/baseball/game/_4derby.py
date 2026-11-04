# script: derby
# The Home Run Derby: batting practice pitches, and every swing that isn't
# a home run is an out. Taking a pitch costs nothing. A round is
# DERBY_OUTS outs; the most home runs and the longest one are kept.
import random

DERBY = {}


def new_derby():
    DERBY.clear()
    DERBY.update(outs=0, homers=0, longest=0, last=None, swings=0, record=False)


def derby_pitch():
    """Batting practice: a mix of pitches, nearly all of them over the plate."""
    kind = random.choice([0, 0, 0, 1, 2, 2, 3])
    return kind, (random.uniform(-0.5, 0.5), random.uniform(1.9, 3.1))


def derby_swing(play):
    """Counts a swing: `play` is the judged hit, or None for a miss. Returns the words to show."""
    DERBY["swings"] += 1
    if play is not None and play["result"] == "homer":
        DERBY["homers"] += 1
        DERBY["last"] = play["feet"]
        DERBY["longest"] = max(DERBY["longest"], play["feet"])
        return play["words"]
    DERBY["outs"] += 1
    if play is None:
        return "Swing and a miss!  Out."
    if play["result"] == "foul":
        return "Foul!  Out."
    DERBY["last"] = play["feet"]
    return f"{play['feet']} ft, in the park.  Out."


def derby_over():
    return DERBY["outs"] >= DERBY_OUTS


def derby_save():
    """At the end of a round: keeps the most home runs and the longest, if they're new bests."""
    best = save_get("derby_homers", 0)
    far = save_get("derby_longest", 0)
    DERBY["record"] = DERBY["homers"] > best or DERBY["longest"] > far
    if DERBY["homers"] > best:
        save_set("derby_homers", DERBY["homers"])
        high_score(DERBY["homers"])
    if DERBY["longest"] > far:
        save_set("derby_longest", DERBY["longest"])
