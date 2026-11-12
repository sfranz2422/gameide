# script: room
# Snowfort Flags in a room: everyone in the same park, computer kids filling the
# teams (the teacher's choice: even two players get four a side).
#
# ONE GAME IS IN CHARGE (net_host()): it runs the match exactly as a game alone
# does — the referee (the match script), every computer kid, the clock — with a
# Remote kid for each other player, which follows where that player's game says
# they are (never faster than CATCH_UP times walking). Every step it sends the
# whole match as "g" (snapshot()), and every other game shows it (apply_g()):
# their computer kids and the others become puppets, and their own kid is told
# when it's been knocked down (downs) and when it's back at the fort (life).
#
# A player's throw flies at once in their own game, and goes to the host as a
# private word; the host throws the real one from where IT says they are, with
# the snowballs IT says they have. The host shouts every real throw so each game
# can fly a copy. So nobody's changed game can hit, grab or capture anything.
#
# If the host leaves, or answers a question (away), the next player's game takes
# over from its copy of "g" (the newest, by "v"), as Undertow does.
import math

FLAG_STATES = ["home", "carried", "dropped"]


def in_room():
    return net_room() is not None


def runs_match():
    """This game decides: alone, or the room's host once it has settled in."""
    return not in_room() or global_vars.in_charge


def my_tag():
    return f"p{net_me().number}" if in_room() else "you"


def kid_sprite(team, look):
    return f"kid_{team}_{look % len(LOOKS[team])}"


def kid_by_tag(tag):
    return next((k for k in instances("Kid") if k.tag == tag), None)


def report_of(kid):
    """Another player's own word about their kid (where they are, which way they face), or None if they aren't here."""
    if not kid.tag.startswith("p"):
        return None
    n = int(kid.tag[1:])
    return next((p for p in net_players() if p.number == n), None)


def to_host(d):
    """A private word to the game in charge. If that's this game, it goes straight to its inbox."""
    me = net_me()
    if net_host() == me.number:
        global_vars.match.inbox.append((me.number, d))
    else:
        net_tell(net_host(), d)


def ask_throw(kid, tx, ty, charge):
    """
    The player throws. In charge (or alone), it's a real throw. Otherwise a copy flies
    at once here, and the host is asked to throw the real one: it checks what it can.
    """
    if runs_match():
        return throw(kid, tx, ty, charge)
    b = throw(kid, tx, ty, charge, real=False)
    if b is not None:
        to_host({"th": [round(tx), round(ty), round(charge, 3)], "n": global_vars.m["n"]})
    return b


def new_room_g():
    return {"v": 0, "ph": "lobby", "n": 0, "sc": [0, 0], "t": MATCH_STEPS, "ot": False, "w": None, "wt": 0,
            "k": [], "fl": [[0, 0, 0, "", 0], [0, 0, 0, "", 0]], "cap": [], "news": None, "hits": {}}


def room_create(match):
    global_vars.g = new_room_g()
    global_vars.in_charge = False
    global_vars.thrown = []
    match.t = 0
    match.inbox = []                # words players sent the host: [(number, dict)]
    match.host_for = 0              # steps this game has been the host
    match.lost_at = -1000           # when this game stopped being the host
    match.last_host = None


def room_step(match):
    """Once a step in a room, before the match runs: the newest word, the messages, who's in charge, and what we send."""
    match.t += 1
    me = net_me().number
    host = net_host()
    g = global_vars.g
    # The newest copy of the match anyone sends (the host's; or, as the host
    # changes, the old host's for a moment, which the new one carries on from).
    for p in net_players():
        pg = p.get("g")
        if isinstance(pg, dict) and pg.get("v", -1) > g["v"]:
            g = pg
    global_vars.g = g
    for msg in net_messages():
        d = msg.data
        if not isinstance(d, dict):
            continue
        if msg.private:
            match.inbox.append((msg.sender, d))
        elif isinstance(d.get("b"), list) and not runs_match():
            # The host's real throws: a copy of each flies here (not our own: that one's already flying).
            for b in d["b"]:
                if isinstance(b, list) and len(b) == 7 and b[0] != my_tag() and b[6] in TEAMS:
                    make_ball(b[6], b[1], b[2], b[3], b[4], b[5], kid_by_tag(b[0]), real=False)
    if host != match.last_host:
        if match.last_host == me:
            match.lost_at = match.t
        match.host_for = 0
        match.last_host = host
    if host == me:
        match.host_for += 1
    was = global_vars.in_charge
    global_vars.in_charge = host == me and match.host_for >= HOST_SETTLE
    if global_vars.in_charge:
        if not was:
            apply_g(g, True)         # taking over: every kid real again, as the last host left them
        host_step(match)
    else:
        global_vars.thrown = []
        match.inbox = [w for w in match.inbox if host == me]    # a word to the host waits while it settles in
        apply_g(g, False)

    pl = global_vars.player
    state = {"x": round(pl.x, 1), "y": round(pl.y, 1), "vx": round(pl.vx, 2), "vy": round(pl.vy, 2),
             "f": pl.xs, "p": pl.image_index, "lk": pl.look, "sc": 1 if pl.scooping else 0, "lf": pl.life}
    if global_vars.in_charge:
        global_vars.g = snapshot(g["v"] + 1)
    if global_vars.in_charge or match.t - match.lost_at < OLD_HOST_SENDS:
        state["g"] = global_vars.g
    net_send(state)
    # Every real throw this step, for the others to fly a copy.
    thrown, global_vars.thrown = global_vars.thrown, []
    for i in range(0, len(thrown), BALLS_A_WORD):
        net_shout({"b": thrown[i:i + BALLS_A_WORD]})


# ---- the host's game

def host_step(match):
    """The host's part of a step: the throws players asked for, who's playing, and starting a match."""
    m = global_vars.m
    me = net_me().number
    here = {me} | {p.number for p in net_players()}
    inbox, match.inbox = match.inbox, []
    for sender, d in inbox:
        th = d.get("th")
        if d.get("n") != m["n"] or not isinstance(th, list) or len(th) != 3:
            continue
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in th):
            continue
        kid = kid_by_tag(f"p{sender}")
        if kid is not None and kid is not global_vars.player:
            # From where the host says they are, with the snowballs the host says they have.
            throw(kid, th[0], th[1], th[2])
    roster(here)
    if m["ph"] == "lobby" and keyboard_check_pressed("enter"):
        deal()


def smaller_team():
    """The team a new player joins: fewer players on it (then fewer kids), else Red."""
    def count(team):
        ks = [k for k in instances("Kid") if k.team == team and k.tag]
        return (len([k for k in ks if k.tag.startswith("p")]), len(ks))
    return min(TEAMS, key=count)


def free_k(team):
    taken = {k.k for k in instances("Kid") if k.team == team and k.tag}
    return next(i for i in range(100) if i not in taken)


def roster(here):
    """Everyone here has a kid (on the smaller team, in a computer kid's place in a match); anyone long gone hasn't."""
    m = global_vars.m
    me = net_me().number
    # (A player's own kid has its tag from the start, but no team until the host deals it one.)
    humans = {k.tag: k for k in instances("Kid") if k.tag.startswith("p") and k.team is not None}
    for n in sorted(here):
        tag = f"p{n}"
        if tag in humans:
            continue
        if n == me:
            kid = global_vars.player
        else:
            kid = instance_create(0, 0, "Remote")
            kid.catch_up = CATCH_UP
        kid.tag = tag
        team = smaller_team()
        bots = sorted([k for k in instances("Bot") if k.team == team], key=lambda b: -b.k)
        if m["ph"] == "play" and bots:
            kid.k = bots[0].k
            if bots[0].carry is not None:
                drop_flag(bots[0].carry, bots[0].x, bots[0].y)
            bots[0].destroy()
        else:
            kid.k = free_k(team)
        kid.team = team
        rep = report_of(kid)
        if rep is not None:
            kid.look = rep.get("lk", 0) if isinstance(rep.get("lk"), int) else 0
            kid.life = rep.get("lf", 0) if isinstance(rep.get("lf"), int) else 0
        kid.sprite = kid_sprite(team, kid.look)
        kid.stock = STOCK_START
        spawn(kid)
        humans[tag] = kid
    for tag, kid in humans.items():
        if kid is global_vars.player:
            continue
        if int(tag[1:]) in here:
            kid.gone_t = 0
            continue
        kid.gone_t = getattr(kid, "gone_t", 0) + 1
        if m["ph"] != "play" or kid.gone_t > ROOM_GONE_STEPS:
            if kid.carry is not None:
                drop_flag(kid.carry, kid.x, kid.y)
            kid.destroy()
    if m["ph"] == "play":
        balance()


def balance():
    """Both teams the same size, TEAM_SIZE at least: computer kids fill the places nobody plays."""
    teams = {t: [k for k in instances("Kid") if k.team == t and k.tag] for t in TEAMS}
    size = max([TEAM_SIZE] + [len([k for k in ks if k.tag.startswith("p")]) for ks in teams.values()])
    for team, ks in teams.items():
        while len(ks) < size:
            k = free_k(team)
            x, y = spawn_spot(team, k)
            b = instance_create(x, y, "Bot")
            b.tag, b.team, b.k = f"b{team[0]}{k}", team, k
            b.role = BOT_ROLES[k % len(BOT_ROLES)]
            b.look = k % len(LOOKS[team])
            b.sprite = kid_sprite(team, b.look)
            b.facing = 1 if team == TEAMS[0] else -1
            spawn(b)
            ks.append(b)
        bots = sorted([k for k in ks if object_name_of(k) == "Bot"], key=lambda b: -b.k)
        while len(ks) > size and bots:
            b = bots.pop(0)
            if b.carry is not None:
                drop_flag(b.carry, b.x, b.y)
            ks.remove(b)
            b.destroy()


def object_name_of(kid):
    return type(kid).__name__


def deal():
    """A new match: the players dealt to the teams in turn, computer kids fill them, everyone at their fort."""
    n = global_vars.m["n"] + 1
    new_match("play")
    global_vars.m["n"] = n
    for f in instances("Flag"):
        flag_home(f)
    for b in instances("Bot"):
        b.destroy()
    people = sorted([k for k in instances("Kid") if k.tag.startswith("p")], key=lambda k: int(k.tag[1:]))
    for i, kid in enumerate(people):
        kid.team, kid.k = TEAMS[i % 2], i // 2
        kid.sprite = kid_sprite(kid.team, kid.look)
        kid.stock, kid.carry, kid.away = STOCK_START, None, False
        kid.facing = 1 if kid.team == TEAMS[0] else -1
        spawn(kid)
    balance()
    global_vars.prints = []
    sound_play("grab", volume=0.5)


def to_lobby():
    """A match is over: back to walking about in the park until the host starts the next."""
    m = global_vars.m
    n, caps, counted, mine = m["n"], m["caps"], m["counted"], m["mine"]
    new_match("lobby")
    m = global_vars.m
    m["n"], m["caps"], m["counted"], m["mine"] = n, caps, counted, mine
    for b in instances("Bot"):
        b.destroy()
    for f in instances("Flag"):
        flag_home(f)
    for k in instances("Kid"):
        k.carry, k.stun = None, 0


def snapshot(v):
    """The match in a few hundred characters: what every other game shows."""
    m = global_vars.m
    ks = []
    for k in instances("Kid"):
        if not k.tag or k.team is None:
            continue
        ks.append([k.tag, TEAMS.index(k.team), k.k, k.look, round(k.x), round(k.y), round(k.vx, 1), round(k.vy, 1),
                   k.xs, k.image_index, k.stun, k.safe, k.stock, k.life, k.downs, 1 if k.away else 0])
    fl = []
    for team in TEAMS:
        f = flag_of(team)
        fl.append([FLAG_STATES.index(f.state), round(f.x), round(f.y), f.carrier.tag if f.carrier is not None else "",
                   f.drop_t])
    return {"v": v, "ph": m["ph"], "n": m["n"], "sc": [m["score"][t] for t in TEAMS], "t": m["t"],
            "ot": m["overtime"], "w": m["over"], "wt": m["over_t"], "k": ks, "fl": fl, "cap": list(m["caps"]),
            "news": m["news"], "hits": {t: n for t, n in m["hits"].items() if t.startswith("p")}}


# ---- every other game

def apply_g(g, real):
    """
    Shows the host's match here: the score and clock, every kid, both flags. With
    `real` (this game taking charge), every kid becomes one this game runs, just as
    the last host left it; otherwise they're puppets of the host's.
    """
    m = global_vars.m
    me = global_vars.player
    if g["n"] != m["n"]:
        m["n"], m["caps"], m["counted"], m["mine"] = g["n"], [], 0, 0
        global_vars.prints = []
    if m["over"] is None and g["w"] is not None and not real:
        match_over_sound(g["w"])
    if len(g["cap"]) > len(m["caps"]) and not real:
        sound_play("capture", volume=0.7)
    m.update(ph=g["ph"], t=g["t"], overtime=bool(g["ot"]), news=g["news"], over=g["w"], over_t=g["wt"],
             score={t: g["sc"][i] for i, t in enumerate(TEAMS)}, caps=list(g["cap"]), hits=dict(g["hits"]))
    have = {k.tag: k for k in instances("Kid") if k.tag}
    keep = set()
    for e in g["k"]:
        tag, ti, kk, look, x, y, vx, vy, f, pose, stun, safe, stock, lf, downs, aw = e
        team = TEAMS[ti]
        keep.add(tag)
        if tag == me.tag:
            take_word(me, team, kk, stock, stun, safe, lf, downs, real)
            continue
        kind = "Bot" if tag.startswith("b") else "Remote"
        kid = have.get(tag)
        if kid is not None and (object_name_of(kid) != kind or kid.puppet == real):
            kid.destroy()
            kid = None
        new = kid is None
        if new:
            kid = instance_create(x, y, kind)
            kid.tag, kid.puppet = tag, not real
            kid.downs = downs
            if kind == "Remote":
                kid.catch_up = CATCH_UP
        kid.team, kid.k, kid.look = team, kk, look
        kid.sprite = kid_sprite(team, look)
        if kid.puppet:
            if downs > kid.downs:
                fall(kid)
            if kid.word != (x, y, vx, vy):
                kid.word, kid.since = (x, y, vx, vy), 0
            kid.xs, kid.image_index = f, pose
            kid.stun, kid.safe, kid.stock, kid.life, kid.downs, kid.away = stun, safe, stock, lf, downs, bool(aw)
        elif new:
            kid.x, kid.y, kid.xs, kid.image_index = x, y, f, pose
            kid.facing = 1 if team == TEAMS[0] else -1
            kid.stun, kid.safe, kid.stock, kid.life, kid.downs, kid.away = stun, safe, stock, lf, downs, bool(aw)
            if kind == "Bot":
                kid.role = BOT_ROLES[kk % len(BOT_ROLES)]
                if kid.role == "attack":
                    pick_lane(kid)
    for tag, kid in have.items():
        if tag not in keep and kid is not me:
            kid.destroy()
    byt = {k.tag: k for k in instances("Kid") if k.tag}
    for k in instances("Kid"):
        k.carry = None
    for f in instances("Flag"):
        st, x, y, carrier, drop_t = g["fl"][TEAMS.index(f.team)]
        f.state, f.drop_t = FLAG_STATES[st], drop_t
        f.carrier = byt.get(carrier) if f.state == "carried" else None
        if f.carrier is not None:
            f.carrier.carry = f
        else:
            if f.state == "carried":
                f.state = "dropped"     # its carrier isn't on this field (yet): show it where it is
            f.x, f.y = x, y


def take_word(me, team, k, stock, stun, safe, lf, downs, real):
    """What the host says about this game's own kid: its team and place, its snowballs, a fall, back at the fort."""
    if me.team != team or me.k != k:
        me.team, me.k = team, k
        me.sprite = kid_sprite(team, me.look)
    if lf > me.life:
        # The host put us at the fort (a new match, or up again after a hit).
        me.life = lf
        me.x, me.y = spawn_spot(team, k)
        me.stun, me.safe, me.downs = 0, SAFE_STEPS, downs
        me.mx = me.my = 0
    elif downs > me.downs:
        me.downs = downs
        fall(me)
    if me.throw_t == 0 or real:
        # (Just after a throw, our own count is newer than the host's word.)
        me.stock = stock
    if real:
        me.stun, me.safe = stun, safe
