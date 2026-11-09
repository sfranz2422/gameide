# script: play
# What a player does in a round (freeze, report, call a meeting, say, vote), and
# how the host's game runs the round. Each action goes to the host as a private
# word; the host checks it against where everyone really is, and only then does
# it happen, so a changed game in someone's browser can't freeze from afar.

SUIT_NAMES = [s[0] for s in SUITS]


def in_room():
    return net_room() is not None


def am_ghost():
    """Out of the round (frozen or sent up) but still about: you walk through walls and see other ghosts."""
    g = global_vars.g
    me = net_me()
    return me is not None and g["ph"] not in ("lobby", "over") and me.number in ghosts(g)


def playing():
    """In this round and not out of it."""
    me = net_me()
    return me is not None and me.number in global_vars.g["in"] and not am_ghost()


def to_host(d):
    """A private word to the game in charge. If that's this game, it goes straight to its inbox."""
    me = net_me()
    if me is None:
        return
    if net_host() == me.number:
        global_vars.director.inbox.append((me.number, d))
    else:
        net_tell(net_host(), d)


def take_role(d):
    """The host has said who you are this round, and which jobs are yours."""
    if d.get("role") not in ("crew", "mimic"):
        return
    global_vars.role = d["role"]
    global_vars.mates = [n for n in d.get("mates", []) if isinstance(n, int)]
    global_vars.jobs = [i for i in d.get("jobs", []) if isinstance(i, int) and 0 <= i < len(STATIONS)]
    global_vars.done = set()
    global_vars.all_done = 0


def sit_down(g):
    """Round the Meeting Hub's table: where a round and every meeting starts."""
    me = net_me()
    if me is None or me.number not in g["in"]:
        return
    pl = global_vars.player
    pl.x, pl.y = seat(sorted(g["in"]).index(me.number), len(g["in"]))
    pl.vx = pl.vy = 0


def where(n):
    """Where player n is, as the host sees it: (x, y), or None if they aren't here."""
    me = net_me()
    if n == me.number:
        return global_vars.player.x, global_vars.player.y
    for p in net_players():
        if p.number == n and p.get("x") is not None:
            return p.x, p.y
    return None


# ---- the player's actions

def try_freeze(n):
    """A Mimic freezes crew member n (in reach, and when their cold has come back)."""
    if global_vars.role != "mimic" or not playing() or global_vars.cool > 0 or global_vars.g["ph"] != "play":
        return False
    to_host({"freeze": n, "r": global_vars.g["r"]})
    global_vars.cool = FREEZE_WAIT
    sound_play("freeze", volume=0.6)
    return True


def try_report(n):
    """Found someone frozen: everyone to the Meeting Hub."""
    if not playing() or global_vars.g["ph"] != "play":
        return False
    to_host({"report": n, "r": global_vars.g["r"]})
    return True


def try_call():
    """The beacon: a meeting, once a round."""
    if not playing() or global_vars.g["ph"] != "play" or global_vars.calls_left <= 0:
        return False
    global_vars.calls_left -= 1
    to_host({"call": 1, "r": global_vars.g["r"]})
    return True


def say(key, n=None, room=None):
    """A phrase in the meeting, to everyone (at most one every SAY_WAIT steps). Ghosts can't speak."""
    d = global_vars.director
    words = phrase_text(key, n, room)
    if words is None or not playing() or global_vars.g["ph"] != "meeting" or d.t - d.said_at < SAY_WAIT:
        return False
    d.said_at = d.t
    net_shout({"say": [key, n, room]})
    global_vars.chat.append((net_me().number, words))
    return True


def vote(pick):
    """Your vote: a player's number, or 0 to skip. Once a meeting, and only while you're in the round."""
    g = global_vars.g
    if not playing() or g["ph"] != "meeting" or global_vars.my_vote is not None:
        return False
    if pick != 0 and (pick not in g["in"] or pick in ghosts(g)):
        return False
    global_vars.my_vote = pick
    to_host({"vote": pick, "r": g["r"]})
    sound_play("click", volume=0.5)
    return True


# ---- the host's game runs the round

def start_round(d):
    """Deals a round to everyone here: who's a Mimic (told to each alone), and everyone's jobs."""
    g = global_vars.g
    me = net_me().number
    here = sorted([me] + [p.number for p in net_players()])
    mimics = random.sample(here, mimic_count(len(here)))
    d.roles = {n: ("mimic" if n in mimics else "crew") for n in here}
    d.done, d.calls, d.votes = {}, {}, {}
    d.coolness = {n: FIRST_WAIT for n in mimics}
    d.seen = {n: d.t for n in here}
    d.dealt_at = d.t
    crew = len(here) - len(mimics)
    g.update({"ph": "play", "r": g["r"] + 1, "t": 0, "in": here, "fz": [], "out": [], "left": [], "b": [],
              "jobs": [0, crew * JOBS_EACH], "call": None, "found": None, "voted": [], "tally": [],
              "ej": None, "em": None, "win": None, "why": "", "mm": []})
    for n in here:
        word = {"role": d.roles[n], "jobs": deal_jobs(random.randrange(1 << 30)),
                "mates": [m for m in mimics if m != n] if n in mimics else [], "r": g["r"]}
        if n == me:
            take_role(word)
        else:
            net_tell(n, word)


def run_round(d):
    g = global_vars.g
    me = net_me().number
    here = {me} | {p.number for p in net_players()}
    for n in here:
        d.seen[n] = d.t
    inbox, d.inbox = d.inbox, []

    if g["ph"] == "lobby":
        if keyboard_check_pressed("enter") and len(here) >= MIN_PLAYERS:
            start_round(d)
        return

    out = ghosts(g)
    alive = lambda n: n in g["in"] and n not in out
    for sender, w in inbox:
        if w.get("r") != g["r"]:
            continue
        if "me" in w:
            # A new host learns the roles from the players; the dealer never lets a claim change one.
            if sender in g["in"] and w["me"] in ("crew", "mimic") and sender not in d.roles:
                d.roles[sender] = w["me"]
            if d.roles.get(sender) == "crew" and isinstance(w.get("done"), int):
                d.done[sender] = max(0, min(JOBS_EACH, w["done"]))
            # Reloaded mid-round, and doesn't know who they are: tell them again (not just
            # after dealing, when their word from before the deal may cross the deal on the way).
            if (w["me"] is None and sender in d.roles and sender != me and g["ph"] != "over"
                    and d.t - getattr(d, "dealt_at", 0) > 180):
                net_tell(sender, {"role": d.roles[sender], "jobs": deal_jobs(random.randrange(1 << 30)),
                                  "mates": [m for m, r in d.roles.items() if r == "mimic" and m != sender]
                                  if d.roles[sender] == "mimic" else [], "r": g["r"]})
        elif "freeze" in w and g["ph"] == "play":
            n = w["freeze"]
            a, b = where(sender), where(n) if isinstance(n, int) else None
            if (d.roles.get(sender) == "mimic" and alive(sender) and alive(n) and d.roles.get(n) == "crew"
                    and d.coolness.get(sender, 0) <= 0 and a and b
                    and point_distance(a[0], a[1], b[0], b[1]) <= FREEZE_REACH + SLACK):
                g["fz"].append(n)
                suit = next((p.get("s") for p in net_players() if p.number == n), global_vars.player.suit if n == me else "coral")
                g["b"].append([n, round(b[0]), round(b[1]), suit])
                d.coolness[sender] = FREEZE_WAIT
        elif "report" in w and g["ph"] == "play":
            n = w["report"]
            body = next((b for b in g["b"] if b[0] == n), None)
            a = where(sender)
            if alive(sender) and body and a and point_distance(a[0], a[1], body[1], body[2]) <= REPORT_REACH + SLACK:
                start_meeting(d, sender, n)
        elif "call" in w and g["ph"] == "play":
            a = where(sender)
            bx, by = tile_middle(*BEACON)
            if alive(sender) and d.calls.get(sender, 0) < CALLS_EACH and a and point_distance(a[0], a[1], bx, by) <= REACH + SLACK:
                d.calls[sender] = d.calls.get(sender, 0) + 1
                start_meeting(d, sender, None)
        elif "vote" in w and g["ph"] == "meeting":
            pick = w["vote"]
            if alive(sender) and sender not in d.votes and (pick == 0 or alive(pick)):
                d.votes[sender] = pick

    # Players long gone have left the round. (A new host counts from when it took
    # over: it never saw a host who left before it.)
    for n in g["in"]:
        d.seen.setdefault(n, d.t)
        if n not in here and d.t - d.seen.get(n, d.t) > GONE_STEPS and n not in g["left"]:
            g["left"].append(n)

    if g["ph"] == "play":
        for n in d.coolness:
            d.coolness[n] -= 1
        crew = [n for n in g["in"] if d.roles.get(n) == "crew" and n not in g["left"]]
        g["jobs"] = [sum(d.done.get(n, 0) for n in crew), len(crew) * JOBS_EACH]
        end_if_won(d)
    elif g["ph"] == "meeting":
        g["t"] -= 1
        g["voted"] = sorted(d.votes)
        voters = [n for n in g["in"] if alive(n)]
        if g["t"] <= 0 or all(n in d.votes for n in voters if n in here):
            ej, g["tally"] = tally(d.votes, voters)
            g["ej"], g["em"] = ej, (d.roles.get(ej) == "mimic") if ej else None
            if ej:
                g["out"].append(ej)
            g["ph"], g["t"] = "result", RESULT_STEPS
    elif g["ph"] == "result":
        g["t"] -= 1
        if g["t"] <= 0:
            g["ph"] = "play"
            d.coolness = {n: FIRST_WAIT for n, r in d.roles.items() if r == "mimic"}
            end_if_won(d)
    elif g["ph"] == "over":
        g["t"] -= 1
        if g["t"] <= 0:
            g.update({"ph": "lobby", "in": [], "fz": [], "out": [], "left": [], "b": [], "mm": [], "win": None})


def start_meeting(d, caller, found):
    g = global_vars.g
    d.votes = {}
    g.update({"ph": "meeting", "t": MEETING_STEPS, "call": caller, "found": found, "b": [], "voted": [],
              "tally": [], "ej": None, "em": None})


def end_if_won(d):
    g = global_vars.g
    win, why = winner(g, d.roles)
    if win:
        g.update({"ph": "over", "t": OVER_STEPS, "win": win, "why": why,
                  "mm": sorted(n for n, r in d.roles.items() if r == "mimic")})


# ---- for drawing

def tile_xy(k, count):
    """
    Where the k-th of `count` players' pictures goes on the meeting screen, and how
    tall it is: five across, four rows of 48 pixels, squeezed to fit a fifth (21 to 25).
    """
    rows = max(4, (count + 4) // 5)
    h = 192 // rows
    return 12 + (k % 5) * 78, 34 + (k // 5) * h, h - 4


def who(n):
    """A player's (name, suit), you included."""
    me = net_me()
    if me is not None and n == me.number:
        return me.name, global_vars.player.suit
    for p in net_players():
        if p.number == n:
            return p.name, p.get("s") if p.get("s") in SUIT_NAMES else "coral"
    return "", "coral"
