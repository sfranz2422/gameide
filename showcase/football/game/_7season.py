# script: season
# A season: you pick a team and play each of the other five once, while the
# computer plays out the rest of the league's games from the teams'
# strengths. Then the top two in the standings play for the championship.
# It's kept in the game's save (save_set), so it waits for you next time.
import random

SEASON = {}         # the season being played, exactly as it's saved


def load_season():
    """The saved season, if there is one (True), or none (False)."""
    SEASON.clear()
    SEASON.update(save_get("season", {}) or {})
    return bool(SEASON)


def save_season():
    save_set("season", SEASON)


def round_robin(ids):
    """Weeks of games in which every team plays every other once: the circle
    method (one team stays put, the rest turn round it a place a week)."""
    ids = list(ids)
    weeks = []
    for w in range(len(ids) - 1):
        n = len(ids)
        weeks.append([[ids[i], ids[n - 1 - i]] for i in range(n // 2)])
        ids = [ids[0], ids[-1]] + ids[1:-1]
    return weeks


def new_season(mine):
    """A new season with `mine` as the player's team."""
    SEASON.clear()
    SEASON.update(team=mine, week=0, weeks=round_robin([t["id"] for t in LEAGUE]),
                  table={t["id"]: {"w": 0, "l": 0, "t": 0, "pf": 0, "pa": 0} for t in LEAGUE},
                  games=[], final=None, champion=None)
    save_season()


def opponent():
    """Who the player's team plays next (the championship once the weeks are done), or None."""
    if SEASON["champion"]:
        return None
    if SEASON["week"] < len(SEASON["weeks"]):
        for a, b in SEASON["weeks"][SEASON["week"]]:
            if SEASON["team"] in (a, b):
                return b if a == SEASON["team"] else a
    final = SEASON["final"] or []
    if SEASON["team"] in final:
        return final[1] if final[0] == SEASON["team"] else final[0]
    return None


def in_final():
    return SEASON["week"] >= len(SEASON["weeks"])


def standings():
    """Team ids, best first: two points a win, one a tie, then points scored minus allowed."""
    table = SEASON["table"]
    rank = lambda tid: (-(2 * table[tid]["w"] + table[tid]["t"]), -(table[tid]["pf"] - table[tid]["pa"]),
                        -table[tid]["pf"], tid)
    return sorted(table, key=rank)


def record(a, b, sa, sb):
    """One game's result in the table and the list of games."""
    SEASON["games"].append([SEASON["week"], a, b, sa, sb])
    for me, them, ms, ts in ((a, b, sa, sb), (b, a, sb, sa)):
        row = SEASON["table"][me]
        row["pf"] += ms
        row["pa"] += ts
        row["w" if ms > ts else "l" if ms < ts else "t"] += 1


def sim_game(a, b, no_ties=False):
    """A game the player doesn't play, worked out from the teams' strengths:
    each drive scores more often for a fast team with a good arm, less often
    against hard tacklers."""
    pts = {}
    for me, them in ((a, b), (b, a)):
        t, o = league_team(me), league_team(them)
        edge = (t["speed"] + t["arm"]) / 2 / o["tackle"]
        s = 0
        for _ in range(SIM_DRIVES):
            r = random.random()
            if r < SIM_TOUCHDOWN * edge:
                s += 7
            elif r < (SIM_TOUCHDOWN + SIM_FIELD_GOAL) * edge:
                s += 3
        pts[me] = s
    if no_ties and pts[a] == pts[b]:
        pts[choose([a, b])] += 3                 # an overtime field goal
    return pts[a], pts[b]


def season_points():
    """Everything the player's team scored this season, the championship too."""
    us = SEASON["team"]
    return sum(sa if a == us else sb for _, a, b, sa, sb in SEASON["games"] if us in (a, b))


def finish_week(mine, theirs):
    """The player's game is over (their score, the other team's): it goes in
    the table, the rest of the week is played out, and the season moves on.
    After the last week, the top two meet in the championship."""
    us, them = SEASON["team"], opponent()
    if in_final():
        SEASON["champion"] = us if mine > theirs else them
        SEASON["games"].append(["final", us, them, mine, theirs])
        save_season()
        high_score(season_points())
        return
    for a, b in SEASON["weeks"][SEASON["week"]]:
        if us in (a, b):
            record(us, them, mine, theirs)
        else:
            record(a, b, *sim_game(a, b))
    SEASON["week"] += 1
    if in_final():
        SEASON["final"] = standings()[:2]
        if us not in SEASON["final"]:
            a, b = SEASON["final"]
            sa, sb = sim_game(a, b, no_ties=True)
            SEASON["champion"] = a if sa > sb else b
            SEASON["games"].append(["final", a, b, sa, sb])
            high_score(season_points())
    save_season()


def season_words():
    """What the season screen's menu offers."""
    them = opponent()
    if them is None:
        return ["New season", "Back to the title"]
    head = "Play the championship" if in_final() else f"Play week {SEASON['week'] + 1}"
    return [f"{head} vs {league_team(them)['name']}", "New season", "Back to the title"]
