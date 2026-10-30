# script: play
# One play, from the snap to the whistle: everyone's job each step, the
# ball in the air, blocks, tackles, and what ended it. The players are
# instances of Player; this moves them, and Player's own events only pick
# the picture to show.
import math
import random

PLAYERS = []        # all fourteen, made once by the Game
PLAY = {}           # the play being run (line_up fills it)
BALL = []           # [the Ball instance]


def team_of(team):
    return [p for p in PLAYERS if p.team == team]


def by_role(team, role):
    return next(p for p in PLAYERS if p.team == team and p.role == role)


def dist(a, b):
    return point_distance(a.x, a.y, b.x, b.y)


def fwd(team):
    return TEAMS[team]["dir"]


# ---------------------------------------------------------------- lining up

def line_up(off, deff, call, dcall, los, ball_y):
    """Everyone to their place for a play, and PLAY made ready for the snap."""
    PLAY.clear()
    PLAY.update(t=0, off=off, deff=deff, call=call, dcall=dcall, los=los, ball_y=ball_y, snapped=False,
                carrier=None, ball="held", thrown=False, handed=False, scramble=False, result=None,
                target=None, flight=None, kick=None, spun=False)
    d = fwd(off)
    play, dplay = OFFENSE[call], DEFENSE[dcall]
    for team, roles, sign in ((off, OFFENSE_ROLES, -1), (deff, DEFENSE_ROLES, 1)):
        for p in team_of(team):
            p.role = roles[p.num]
            p.kind = kind_of(p.role)
            back, across = LINEUP[p.role]
            p.x, p.y = los + sign * d * back, clamp(ball_y + across, TOP + 8, BOT - 8)
            p.home_x, p.home_y = p.x, p.y
            p.vx = p.vy = 0
            p.face = d if team == off else -d
            p.down_t = p.dive_t = p.catch_t = p.throw_t = p.spin_t = p.shed = p.hold_t = p.stumble = 0
            p.held_by = p.blocking = None
            p.cheer = False
            p.pace = random.uniform(0.95, 1.05)      # no two plays quite the same
            p.job = dplay["jobs"].get(p.role, "rush") if team == deff else "block"
            p.route = []
            if team == off:
                for fx, fy in play.get("routes", {}).get(p.role, []):
                    p.route.append((p.home_x + d * fx, clamp(p.home_y + fy, TOP + 6, BOT - 6)))
                if p.route and p.role != "QB":
                    p.job = "route"
            p.human = None
    qb = by_role(off, "QB")
    PLAY["carrier"] = qb
    ball = BALL[0]
    ball.x, ball.y, ball.z = los, ball_y, 0
    pick_humans()


def pick_humans():
    """Who each person playing controls: the quarterback on a pass, the
    runner on a run (once he has the ball), a linebacker on defence."""
    for p in PLAYERS:
        p.human = None
    off, deff = PLAY["off"], PLAY["deff"]
    c = MATCH["humans"].get(off)
    if c is not None:
        car = PLAY["carrier"]
        if car is not None and (car.role != "QB" or OFFENSE[PLAY["call"]]["kind"] == "pass"):
            car.human = c
    c = MATCH["humans"].get(deff)
    if c is not None:
        mine = MATCH.get("picked", {}).get(deff)
        if mine is None or mine.team != deff:
            mine = by_role(deff, "LB1")
        mine.human = c


def switch_defender(team):
    """The defender nearest the ball becomes the one you control."""
    ball = BALL[0]
    free = [p for p in team_of(team) if p.down_t == 0]
    if not free:
        return
    mine = min(free, key=lambda p: point_distance(p.x, p.y, ball.x, ball.y))
    MATCH.setdefault("picked", {})[team] = mine
    c = MATCH["humans"].get(team)
    for p in team_of(team):
        p.human = c if p is mine else None


# ---------------------------------------------------------------- the snap

def snap():
    PLAY["snapped"] = True
    kind = OFFENSE[PLAY["call"]]["kind"]
    sound_play("hike", volume=0.7)
    if kind == "punt":
        kick_ball(PLAY["los"] + fwd(PLAY["off"]) * PUNT_YARDS * YD, PLAY["ball_y"], 70, 70)
    elif kind == "kick":
        yards = round(to_goal(PLAY["off"], PLAY["los"])) + 17     # the posts are 10 back, the holder 7
        PLAY["kick"] = {"yards": yards, "allowed": clamp(0.95 - 0.013 * yards, 0.15, 0.8), "phase": 0,
                        "wait": choose([0.05, 0.3, 0.5, 0.75]), "good": None}


def kick_step():
    """The field goal meter swings until the kicker presses (or the computer picks its moment)."""
    k = PLAY["kick"]
    if k is None or k["good"] is not None:
        return
    k["phase"] = math.sin(PLAY["t"] * 0.09)
    c = MATCH["humans"].get(PLAY["off"])
    if c is not None:
        go = button_pressed(c, 0) and PLAY["t"] > 10
    else:
        go = PLAY["t"] > 30 and abs(k["phase"]) <= k["wait"]
    if not go:
        return
    k["good"] = abs(k["phase"]) <= k["allowed"]
    posts = END_R if fwd(PLAY["off"]) > 0 else END_L
    miss = 0 if k["good"] else (40 if k["phase"] > 0 else -40)
    kick_ball(posts, MID + miss, 60, 50)


def kick_ball(x, y, steps, height):
    ball = BALL[0]
    PLAY["ball"] = "kick"
    PLAY["carrier"] = None
    PLAY["flight"] = {"x0": ball.x, "y0": ball.y, "x1": x, "y1": y, "t": 0, "steps": steps, "h": height}
    sound_play("kick", volume=0.8)


def holding_to_throw():
    """True while the quarterback still has the ball behind the line on a pass play."""
    car = PLAY["carrier"]
    return (car is not None and car.role == "QB" and car.team == PLAY["off"] and not PLAY["thrown"]
            and not PLAY["scramble"] and OFFENSE[PLAY["call"]]["kind"] == "pass")


def receivers():
    """The players a pass can go to, in the order of their numbers on screen."""
    off = PLAY["off"]
    out = [by_role(off, r) for r in ("WR1", "WR2", "WR3")]
    rb = by_role(off, "RB")
    if rb.route:
        out.append(rb)
    return out


def where_after(r, steps):
    """Where receiver r will be in `steps` steps: along the rest of his route
    (he stops where it ends), or straight on if he's running free."""
    if not r.route:
        return r.x + r.vx * steps, r.y + r.vy * steps
    x, y = r.x, r.y
    left = steps * SPEED[r.kind] * r.pace
    for px, py in r.route:
        d = point_distance(x, y, px, py)
        if d >= left:
            return x + (px - x) * left / d, y + (py - y) * left / d
        left -= d
        x, y = px, py
    return x, y


def throw_to(r):
    qb = PLAY["carrier"]
    t = point_distance(qb.x, qb.y, r.x, r.y) / PASS_SPEED
    tx, ty = r.x, r.y
    for _ in range(3):                       # lead the receiver: where he'll be when it gets there
        tx, ty = where_after(r, t)
        t = point_distance(qb.x, qb.y, tx, ty) / PASS_SPEED
    if not PLAY.get("toss"):
        # Nobody throws perfectly: further, and with a defender in his face, is wilder.
        rushed = any(dist(qb, d) < 24 for d in team_of(PLAY["deff"]) if d.held_by is None)
        miss = point_distance(qb.x, qb.y, tx, ty) * THROW_ERROR + (10 if rushed else 0)
        a = random.uniform(0, 6.283)
        k = random.uniform(0, 1) ** 0.5 * miss
        tx, ty = tx + math.cos(a) * k, ty + math.sin(a) * k
    tx, ty = clamp(tx, 8, END_R + 40), clamp(ty, TOP - 20, BOT + 20)
    ball = BALL[0]
    ball.x, ball.y = qb.x, qb.y
    PLAY.update(ball="air", thrown=True, carrier=None, target=r,
                flight={"x0": qb.x, "y0": qb.y, "x1": tx, "y1": ty, "t": 0, "steps": max(8, int(t)),
                        "h": 6 + point_distance(qb.x, qb.y, tx, ty) * 0.12})
    qb.throw_t = 14
    qb.human = None
    sound_play("throw", volume=0.6)


# ---------------------------------------------------------------- every step

def live_step():
    """One step of a play that has been snapped."""
    PLAY["t"] += 1
    if PLAY["ball"] == "kick":
        fly()                    # a punt or a field goal: everyone watches the ball
        return
    if PLAY["kick"] is not None:
        return                   # the kicker is lining up (the Game runs the meter)
    off = PLAY["off"]
    run = OFFENSE[PLAY["call"]]
    car = PLAY["carrier"]
    # A run: the quarterback hands off (or tosses) to the runner.
    if run["kind"] == "run" and not PLAY["handed"] and car is not None and car.role == "QB":
        rb = by_role(off, run["carrier"])
        if run.get("toss") and PLAY["t"] >= 4:
            PLAY["toss"] = True
            throw_to(rb)
        elif not run.get("toss") and (dist(car, rb) < 12 or PLAY["t"] >= 30):
            give(rb)
        PLAY["handed"] = PLAY["handed"] or PLAY.get("toss", False)
    car = PLAY["carrier"]
    # The quarterback past the line can't throw any more: he's a runner now.
    if holding_to_throw() and (car.x - PLAY["los"]) * fwd(off) > 2:
        PLAY["scramble"] = True
    if holding_to_throw() and MATCH["humans"].get(off) is None:
        cpu_throw(car)
    for p in PLAYERS:
        think(p)
    for p in PLAYERS:
        move(p)
    blocks()
    if PLAY["ball"] in ("air", "kick"):
        fly()
    else:
        hold_ball()
    if PLAY["result"] is None:
        check_tackle()
    if PLAY["result"] is None:
        check_lines()


def give(p):
    PLAY["carrier"] = p
    PLAY["handed"] = True
    PLAY["ball"] = "held"
    pick_humans()


def hold_ball():
    car = PLAY["carrier"]
    ball = BALL[0]
    if car is not None:
        ball.x, ball.y, ball.z = car.x + car.face * 5, car.y, 14


def think(p):
    """What p wants to do this step: p.wx, p.wy, a direction at most 1 long."""
    p.wx = p.wy = 0
    if p.down_t > 0:
        p.down_t -= 1
        return
    if p.shed > 0:
        p.shed -= 1
    if p.dive_t > 0:
        p.dive_t -= 1
        p.wx, p.wy = p.dive_x, p.dive_y
        if p.dive_t == 0:
            p.down_t = 36
        return
    if p.catch_t > 0:
        p.catch_t -= 1
    if p.throw_t > 0:
        p.throw_t -= 1
    if p.spin_t > 0:
        p.spin_t -= 1
    if p.human is not None:
        p.wx, p.wy = pad_axis(p.human)
        return
    if p.team == PLAY["off"]:
        think_offense(p)
    else:
        think_defense(p)


def toward(p, x, y):
    """A direction from p to (x, y), slowing in the last few pixels so p stops on it."""
    d = point_distance(p.x, p.y, x, y)
    if d < 0.5:
        return 0, 0
    k = min(1, d / 6)
    return (x - p.x) / d * k, (y - p.y) / d * k


def runner_free():
    """True once the ball is a runner's: handed off, caught, or a quarterback scrambling.
    (Not the quarterback about to hand off: then the runner still has his
    route to run, and the defence its jobs.)"""
    car = PLAY["carrier"]
    if car is None or holding_to_throw():
        return False
    return not (car.role == "QB" and not PLAY["handed"] and not PLAY["scramble"])


def think_offense(p):
    car = PLAY["carrier"]
    if p is car:
        if p.role == "QB" and OFFENSE[PLAY["call"]]["kind"] == "pass" and not PLAY["scramble"]:
            follow_route(p)
        elif p.role == "QB" and not PLAY["handed"]:
            follow_route(p)
        else:
            cpu_run(p)
        return
    if p.route and (p.job == "route" or p.role == "QB") and not (runner_free() and p.role != "QB"):
        follow_route(p)
        return
    if p.role == "QB":
        return
    block(p)


def follow_route(p):
    while p.route and point_distance(p.x, p.y, *p.route[0]) < 3:
        p.route.pop(0)
        if not p.route and p.job == "route":
            p.job = "settle"
    if p.route:
        p.wx, p.wy = toward(p, *p.route[0])


def block(p):
    """Stand between the nearest defender and the ball."""
    if p.blocking is not None:
        p.wx, p.wy = toward(p, p.blocking.x, p.blocking.y)
        return
    if p.job == "settle" and not runner_free():
        return
    car = PLAY["carrier"] or by_role(PLAY["off"], "QB")
    foes = [d for d in team_of(PLAY["deff"]) if d.down_t == 0 and d.held_by is None and d.shed == 0
            and point_distance(p.x, p.y, d.x, d.y) < 90]
    if not foes:
        if p.kind in ("L",):
            p.wx, p.wy = toward(p, car.x + fwd(PLAY["off"]) * 14, car.y + (p.home_y - PLAY["ball_y"]) * 0.6)
        return
    d = min(foes, key=lambda d: point_distance(d.x, d.y, car.x, car.y) + point_distance(p.x, p.y, d.x, d.y))
    k = 8 / max(1, point_distance(d.x, d.y, car.x, car.y))
    p.wx, p.wy = toward(p, d.x + (car.x - d.x) * k, d.y + (car.y - d.y) * k)


def think_defense(p):
    car = PLAY["carrier"]
    off = PLAY["off"]
    if PLAY["ball"] == "air" and not PLAY.get("toss"):
        # Defenders read the throw a moment late, and play the receiver it's
        # going to, not the spot: only the player himself knows where he'll be.
        r, f = PLAY["target"], PLAY["flight"]
        if p.kind != "DL" and f["t"] > 10 and point_distance(p.x, p.y, r.x, r.y) < 60:
            p.wx, p.wy = toward(p, r.x, r.y)
            return
    if car is not None and runner_free() and car.team == off:
        pursue(p, car)
        return
    words = p.job.split()
    if words[0] in ("rush", "spy") and car is None:
        r = PLAY["target"]       # the ball's in the air: chase whoever it's going to
        p.wx, p.wy = toward(p, r.x, r.y)
    elif words[0] == "rush":
        pursue(p, car)
    elif words[0] == "spy":
        who = by_role(off, words[1])
        p.wx, p.wy = toward(p, who.x - fwd(off) * 34, who.y)
    elif words[0] == "man":
        who = by_role(off, words[1])
        cushion = int(words[2]) if len(words) > 2 else 10
        p.wx, p.wy = toward(p, who.x + fwd(off) * cushion, who.y)
    elif words[0] == "zone":
        zx = PLAY["los"] + fwd(off) * int(words[1])
        zy = PLAY["ball_y"] + int(words[2])
        near = [r for r in receivers() if point_distance(r.x, r.y, zx, zy) < 50]
        if near:
            r = min(near, key=lambda r: point_distance(r.x, r.y, zx, zy))
            p.wx, p.wy = toward(p, r.x + fwd(off) * 8, r.y)
        else:
            p.wx, p.wy = toward(p, zx, zy)


def pursue(p, car):
    """Run at where the ball carrier is going to be, not where he is."""
    s = SPEED[p.kind]
    lead = min(30, point_distance(p.x, p.y, car.x, car.y) / max(0.5, s))
    p.wx, p.wy = toward(p, car.x + car.vx * lead * 0.6, car.y + car.vy * lead * 0.6)


def cpu_run(p):
    """The computer's ball carrier: through the hole the play was drawn for,
    then for the goal, swerving from tacklers in front of him and the sidelines."""
    ahead = (p.x - PLAY["los"]) * fwd(p.team)
    if p.route and ahead < 16 and p.catch_t == 0:
        follow_route(p)
        return
    gx, gy = fwd(p.team), 0
    for d in team_of(other(p.team)):
        if d.down_t or d.held_by is not None:
            continue
        r = point_distance(p.x, p.y, d.x, d.y)
        in_front = (d.x - p.x) * fwd(p.team) > -8      # one behind him can only chase
        if 0 < r < 50 and in_front:
            push = (50 - r) / 50
            gx += (p.x - d.x) / r * push * 0.6
            gy += (p.y - d.y) / r * push * 1.4
    if p.y < TOP + 24:
        gy += (TOP + 24 - p.y) / 24
    if p.y > BOT - 24:
        gy -= (p.y - (BOT - 24)) / 24
    gx = gx if gx * fwd(p.team) > 0.5 else fwd(p.team) * 0.5
    n = max(0.01, (gx * gx + gy * gy) ** 0.5)
    p.wx, p.wy = gx / n, gy / n


def openness(r):
    return min(point_distance(r.x, r.y, d.x, d.y) for d in team_of(PLAY["deff"]) if d.kind != "DL")


def cpu_throw(qb):
    """The computer's quarterback: the open man furthest downfield, before the rush arrives."""
    t = PLAY["t"]
    if t < 24:
        return
    worth = lambda r: min(openness(r), 40) + 0.2 * (r.x - PLAY["los"]) * fwd(PLAY["off"])
    best = max(receivers(), key=worth)
    pressure = any(dist(qb, d) < 20 for d in team_of(PLAY["deff"]) if d.held_by is None)
    if (t >= 40 and openness(best) >= 22) or t >= 95 or pressure:
        throw_to(best)


def move(p):
    s = SPEED[p.kind] * p.pace
    if p.human is not None:
        s += 0.06
    if p is PLAY["carrier"]:
        s *= CARRY_PACE
    if p.held_by is not None:
        s *= 0.15
    if p.spin_t > 0:
        s *= 0.7
    if p.stumble > 0:
        p.stumble -= 1
        s *= 0.6
    if p.dive_t > 0:
        s = 3.0
    acc = 0.6 if p.human is not None else 0.3
    p.vx = approach(p.vx, p.wx * s, acc)
    p.vy = approach(p.vy, p.wy * s, acc)
    p.x = clamp(p.x + p.vx, 8, END_R + 40)
    p.y = clamp(p.y + p.vy, TOP - 30, BOT + 26)
    if abs(p.vx) > 0.2:
        p.face = 1 if p.vx > 0 else -1


def blocks():
    """A blocker that reaches a free defender holds him for a while."""
    car = PLAY["carrier"]
    for b in team_of(PLAY["off"]):
        if b.blocking is not None or b is car or b.down_t or (b.job != "block" and b.job != "settle"):
            continue
        for d in team_of(PLAY["deff"]):
            if d.held_by is None and d.shed == 0 and d.down_t == 0 and d.dive_t == 0 and dist(b, d) < 12:
                # Only a defender still in front of the runner can be blocked:
                # one chasing from behind him can't be, or nobody ever caught a runner.
                if car is not None and runner_free() and (d.x - car.x) * fwd(PLAY["off"]) < -4:
                    continue
                d.held_by, d.hold_t, b.blocking = b, BLOCK_STEPS if b.kind == "L" else BLOCK_STEPS // 2, d
                break
    for d in team_of(PLAY["deff"]):
        if d.held_by is None:
            continue
        d.hold_t -= 1
        if d.hold_t <= 0 or d.held_by.down_t:
            d.held_by.blocking = None
            d.held_by, d.shed = None, 40


def fly():
    ball = BALL[0]
    f = PLAY["flight"]
    f["t"] += 1
    s = min(1, f["t"] / f["steps"])
    ball.x, ball.y = lerp(f["x0"], f["x1"], s), lerp(f["y0"], f["y1"], s)
    ball.z = lerp(14, 10, s) + 4 * f["h"] * s * (1 - s)
    if s < 1:
        return
    if PLAY["ball"] == "kick":
        kick_landed()
    elif PLAY.get("toss"):
        PLAY["toss"] = False
        give(PLAY["target"])
    else:
        pass_arrives()


def pass_arrives():
    """The ball comes down: caught, intercepted, knocked away, or on the grass."""
    ball = BALL[0]
    near = lambda team, kinds: [p for p in team_of(team) if p.kind in kinds and p.down_t == 0]
    catchers = sorted(near(PLAY["off"], ("WR", "RB")), key=lambda p: point_distance(p.x, p.y, ball.x, ball.y))
    hawks = sorted(near(PLAY["deff"], ("LB", "CB", "S")), key=lambda p: point_distance(p.x, p.y, ball.x, ball.y))
    rd = point_distance(catchers[0].x, catchers[0].y, ball.x, ball.y) if catchers else 999
    dd = point_distance(hawks[0].x, hawks[0].y, ball.x, ball.y) if hawks else 999
    if dd < 14 and dd < rd - 2:
        if dd < 6:
            p = hawks[0]
            p.catch_t = 10
            end_play("interception", p.x, p.y, p)
        else:
            end_play("broken up", ball.x, ball.y)
    elif rd < 18 and dd < 18 and random.random() < 0.4:
        end_play("broken up", ball.x, ball.y)       # a defender right there gets a hand to it
    elif rd < 18:
        p = catchers[0]
        p.catch_t = 10
        give(p)
        sound_play("catch", volume=0.6)
    else:
        end_play("incomplete", ball.x, ball.y)


def kick_landed():
    kind = OFFENSE[PLAY["call"]]["kind"]
    ball = BALL[0]
    if kind == "punt":
        end_play("punt", ball.x, ball.y)
    else:
        end_play("field goal" if PLAY["kick"]["good"] else "missed kick", ball.x, ball.y)


def check_tackle():
    car = PLAY["carrier"]
    if car is None or car.spin_t > 0:
        return
    for d in team_of(other(car.team)):
        if d.down_t or d.held_by is not None:
            continue
        reach = 14 if d.dive_t > 0 else TACKLE_REACH
        if dist(d, car) >= reach:
            continue
        sure = TACKLE_CHANCE["dive"] if d.dive_t > 0 else TACKLE_CHANCE[d.kind]
        if holding_to_throw():
            sure = TACKLE_CHANCE["QB"]
        if random.random() > sure:
            d.down_t, d.dive_t = 30, 0           # he missed, and stumbles to the grass
            car.stumble = 10
            sound_play("dive", volume=0.4)
            continue
        car.down_t = 999
        d.down_t = 999 if d.dive_t else 0        # a diving tackle ends on the grass too
        d.dive_t = 0
        sound_play("tackle", volume=0.8)
        camera_shake(2, 8)
        end_play("sack" if holding_to_throw() else "tackle", car.x, car.y, d)
        return


def check_lines():
    """Over the goal line, out of bounds, or out the back of his own end zone."""
    car = PLAY["carrier"]
    if car is None:
        return
    d = fwd(car.team)
    if (d > 0 and car.x >= GOAL_R) or (d < 0 and car.x <= GOAL_L):
        end_play("touchdown", car.x, car.y)
    elif car.y < TOP or car.y > BOT or car.x < END_L or car.x > END_R:
        end_play("out", car.x, clamp(car.y, TOP, BOT))


def end_play(how, x, y, who=None):
    PLAY["result"] = {"how": how, "x": x, "y": y, "who": who, "team": PLAY["carrier"].team if PLAY["carrier"] else None}
    for p in PLAYERS:
        p.vx = p.vy = 0
        p.wx = p.wy = 0
        p.dive_t = 0
    sound_play("whistle", volume=0.6)


# ---------------------------------------------------------------- what the people playing press

def human_buttons():
    """Throws, spins, dives and switching player, for whoever is playing."""
    off, deff = PLAY["off"], PLAY["deff"]
    c = MATCH["humans"].get(off)
    car = PLAY["carrier"]
    if c is not None and PLAY["kick"] is None:
        if holding_to_throw():
            rs = receivers()
            for i, r in enumerate(rs[:3]):
                if button_pressed(c, i):
                    throw_to(r)
                    break
        elif car is not None and car.human == c and button_pressed(c, 0) and not PLAY["spun"] and car.catch_t == 0:
            car.spin_t, PLAY["spun"] = 24, True
            sound_play("spin", volume=0.5)
    c = MATCH["humans"].get(deff)
    if c is not None and PLAY["kick"] is None:
        mine = next((p for p in team_of(deff) if p.human == c), None)
        if button_pressed(c, 1):
            switch_defender(deff)
        elif mine is not None and button_pressed(c, 0):
            if mine.held_by is not None:
                mine.hold_t -= 8                 # fighting off the block
            elif mine.dive_t == 0 and mine.down_t == 0:
                ax, ay = pad_axis(c)
                if ax == 0 and ay == 0 and car is not None:
                    ax, ay = toward(mine, car.x, car.y)
                n = max(0.01, (ax * ax + ay * ay) ** 0.5)
                mine.dive_x, mine.dive_y, mine.dive_t = ax / n, ay / n, 14
                sound_play("dive", volume=0.5)
