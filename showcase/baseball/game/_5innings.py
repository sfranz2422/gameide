# script: innings
# A game's rules: balls and strikes, outs, runners on base, runs, and the
# innings. The visitors (away) bat in the top of each inning, the home team
# in the bottom. Every rule is a few lines here, so it can be changed.

GAME = {}


def new_game():
    GAME.clear()
    GAME.update(inning=1, half="top", outs=0, balls=0, strikes=0, bases=[False, False, False],
                score={"away": 0, "home": 0}, line={"away": [0], "home": []},
                hits={"away": 0, "home": 0}, over=False, half_over=False)


def batting():
    return "away" if GAME["half"] == "top" else "home"


def fielding():
    return "home" if GAME["half"] == "top" else "away"


def score_runs(n):
    team = batting()
    GAME["score"][team] += n
    GAME["line"][team][-1] += n
    walk_off()


def walk_off():
    """The home team ahead in the bottom of the last inning (or later): the game is over at once."""
    last = GAME["inning"] >= INNINGS
    if last and GAME["half"] == "bottom" and GAME["score"]["home"] > GAME["score"]["away"]:
        GAME["over"] = True


def new_batter():
    GAME["balls"] = GAME["strikes"] = 0


def out(words):
    """One out. The third ends the half inning."""
    GAME["outs"] += 1
    new_batter()
    if GAME["outs"] >= 3:
        GAME["half_over"] = True
        return words + "  That's three outs."
    return words


def advance(n, batter=True):
    """Every runner moves up n bases (4 brings everyone home), and the
    batter goes to base n. Returns the runs that scored."""
    bases, runs = [False, False, False], 0
    for b in (2, 1, 0):
        if GAME["bases"][b]:
            if b + n >= 3:
                runs += 1
            else:
                bases[b + n] = True
    if batter:
        if n >= 4:
            runs += 1
        else:
            bases[n - 1] = True
    GAME["bases"] = bases
    score_runs(runs)
    return runs


def walk():
    """Ball four: the batter takes first, and only runners pushed along by him move up."""
    b, runs = GAME["bases"], 0
    if b[0]:
        if b[1]:
            if b[2]:
                runs = 1
            b[2] = True
        b[1] = True
    b[0] = True
    new_batter()
    score_runs(runs)
    return runs


def runs_words(runs):
    return "" if runs == 0 else "  A run scores!" if runs == 1 else f"  {runs} runs score!"


def call_pitch(pitch, swung, play):
    """What one pitch did to the count, the bases and the score. `swung`:
    did the batter swing; `play`: the judged hit if he hit it (fair or foul),
    else None. Returns what the umpire (or the announcer) says."""
    if play is None:
        if swung or is_strike(pitch["x"], pitch["z"]):
            GAME["strikes"] += 1
            if GAME["strikes"] >= 3:
                return out("Strike three!" if not swung else "Struck him out!")
            return "Swing and a miss!" if swung else "Strike!"
        GAME["balls"] += 1
        if GAME["balls"] >= 4:
            return "Ball four!  Take your base." + runs_words(walk())
        return "Ball."
    if play["result"] == "foul":
        if GAME["strikes"] < 2:            # a foul is a strike, but never the third
            GAME["strikes"] += 1
        return "Foul ball."
    new_batter()
    team = batting()
    if play["result"] == "out":
        words = out(play["words"] + ".")
        if not GAME["half_over"] and play["words"].startswith("Ground"):
            words += runs_words(advance(1, batter=False))      # runners move up on a ground out
        return words
    GAME["hits"][team] += 1
    return play["words"] + runs_words(advance(play["bases"]))


def end_half():
    """Three outs: the other team bats, or the game is over."""
    GAME.update(outs=0, bases=[False, False, False], half_over=False)
    new_batter()
    s = GAME["score"]
    if GAME["half"] == "top":
        if GAME["inning"] >= INNINGS and s["home"] > s["away"]:
            GAME["over"] = True            # the home team is ahead: no need for their last turn
            return
        GAME["half"] = "bottom"
        GAME["line"]["home"].append(0)
        return
    if GAME["inning"] >= INNINGS and s["home"] != s["away"]:
        GAME["over"] = True
        return
    if GAME["inning"] >= MOST_INNINGS:
        GAME["over"] = True                # still tied after all that: a tie
        return
    GAME["inning"] += 1
    GAME["half"] = "top"
    GAME["line"]["away"].append(0)


def winner():
    s = GAME["score"]
    return None if s["home"] == s["away"] else "home" if s["home"] > s["away"] else "away"


def inning_words():
    n = GAME["inning"]
    th = "st" if n == 1 else "nd" if n == 2 else "rd" if n == 3 else "th"
    return f"{'Top' if GAME['half'] == 'top' else 'Bottom'} of the {n}{th}"
