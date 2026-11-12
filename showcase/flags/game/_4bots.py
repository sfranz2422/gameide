# script: bots
# The computer's kids. A bot decides where to go every THINK_EVERY steps (each on
# its own beat, so eight of them never all think in the same step), finds a way
# there with the engine's path_find (round every pine, bank and the creek), and
# walks it. It acts only through the same things a player can: walking, throw(),
# scooping at a drift. Its role (BOT_ROLES) is what it does when nothing urgent is
# happening: attack (go for their flag), defend (stay near home), roam (between).
import math
import random


def nearest(kid, things):
    best, out = None, None
    for t in things:
        d = point_distance(kid.x, kid.y, t.x, t.y)
        if best is None or d < best:
            best, out = d, t
    return out


def bot_goal(bot):
    """Where a bot wants to be now, as (x, y, why): the most urgent thing first."""
    mine, theirs = flag_of(bot.team), flag_of(other_team(bot.team))
    home = stand_of(bot.team)
    # Carrying their flag: home. (If ours is gone, home anyway: our team will bring it back.)
    # But both flags taken and nobody's brought ours back for a while: waiting at home,
    # behind the fort's walls, the other carrier is hard to reach, so the carrier goes
    # after them too. Whoever is knocked down first drops theirs, and it's over.
    if bot.carry is not None:
        if mine.state == "carried" and bot.wait_t > STANDOFF_WAIT:
            c = mine.carrier
            return c.x, c.y, "chase"
        return home[0], home[1], "home"
    # Our flag's been taken: the defenders and roamers near enough go after the carrier.
    # Both flags taken (each carrier waiting at home for its own to come back): nobody
    # scores until one is fetched, so then the attackers and roamers go, however far.
    if mine.state == "carried":
        c = mine.carrier
        standoff = theirs.state == "carried"
        if (standoff and bot.role != "defend") or (bot.role != "attack" and point_distance(bot.x, bot.y, c.x, c.y) < CHASE_REACH):
            return c.x, c.y, "chase"
    # Our flag dropped: whoever's nearest of the defenders and roamers sends it home.
    if mine.state == "dropped" and bot.role != "attack":
        return mine.x, mine.y, "return"
    # No snowballs: the nearest drift (and a top-up if one's handy on the way).
    # (An attacker near their flag goes for it, snowballs or not.)
    close = bot.role == "attack" and point_distance(bot.x, bot.y, theirs.x, theirs.y) < 700
    drift = nearest(bot, instances("Drift"))
    if drift is not None and not close:
        far = point_distance(bot.x, bot.y, drift.x, drift.y)
        if bot.stock == 0 or (bot.stock < 2 and far < 220):
            return drift.x, drift.y + 20, "scoop"
    # Their flag dropped near enough: grab it.
    if theirs.state == "dropped" and (bot.role != "defend" or point_distance(bot.x, bot.y, theirs.x, theirs.y) < 300):
        return theirs.x, theirs.y, "grab"
    if bot.role == "defend":
        # Anyone seen near home: after them. Otherwise a spot near the stand.
        for e in seen_by_team(bot.team):
            if point_distance(e.x, e.y, home[0], home[1]) < GUARD_RADIUS and e.stun == 0:
                return e.x, e.y, "chase"
        if bot.post is None or random.random() < 0.15:
            side = 1 if bot.team == TEAMS[0] else -1
            bot.post = (home[0] + side * random.uniform(60, GUARD_RADIUS * 0.8), home[1] + random.uniform(-160, 160))
        return bot.post[0], bot.post[1], "guard"
    if theirs.state == "carried":
        # A teammate has their flag: walk with them, between them and trouble.
        c = theirs.carrier
        return c.x, c.y, "escort"
    if bot.role == "attack":
        # Sneak over by a lane (through the woods), unless their flag is already near.
        if bot.lane and point_distance(bot.x, bot.y, theirs.x, theirs.y) > 500:
            x, y = bot.lane[0]
            if point_distance(bot.x, bot.y, x, y) < TILE * 2:
                bot.lane.pop(0)
            if bot.lane:
                return bot.lane[0][0], bot.lane[0][1], "sneak"
        return theirs.x, theirs.y, "attack"
    if bot.role == "roam" and random.random() < 0.4:
        # Halfway out: the middle of the park, on a bridge's side.
        side = 1 if bot.team == TEAMS[0] else -1
        mx = COLS * TILE / 2 - side * 260
        return mx, random.choice([10, 34]) * TILE, "roam"
    return theirs.x, theirs.y, "attack"


def bot_think(bot):
    standoff = bot.carry is not None and flag_of(bot.team).state == "carried"
    # Counted from the match clock, not by adding THINK_EVERY a think: a carrier waiting
    # at home has nowhere to walk, and a bot with no path thinks every step, so the
    # 20 seconds it should wait were over in one.
    if standoff:
        if bot.wait_from is None:
            bot.wait_from = global_vars.m_t
        bot.wait_t = global_vars.m_t - bot.wait_from
    else:
        bot.wait_from, bot.wait_t = None, 0
    gx, gy, why = bot_goal(bot)
    bot.why = why
    moved_far = bot.goal is None or point_distance(gx, gy, bot.goal[0], bot.goal[1]) > TILE * 2
    stale = bot.path_t <= 0
    if moved_far or stale or not bot.path:
        bot.goal = (gx, gy)
        bot.path = list(path_find(bot.x, bot.y, gx, gy, TILE))
        bot.path_t = PATH_EVERY
        if bot.path:
            bot.path.pop(0)          # the first point is where it stands


def bot_walk(bot):
    """One step along the path: which way to walk (mx, my), and whether to scoop."""
    bot.mx = bot.my = 0
    bot.scooping = False
    bot.path_t -= 1
    if bot.why == "scoop":
        drift = nearest(bot, instances("Drift"))
        if drift is not None and point_distance(bot.x, bot.y, drift.x, drift.y) < SCOOP_REACH:
            bot.scooping = bot.stock < STOCK_MAX
            if bot.stock >= STOCK_MAX:
                bot.path, bot.path_t = [], 0
            return
    while bot.path:
        px, py = bot.path[0]
        d = point_distance(bot.x, bot.y, px, py)
        if d < 4:
            bot.path.pop(0)
            continue
        bot.mx, bot.my = (px - bot.x) / d, (py - bot.y) / d
        break
    # Stuck on a corner (the path is in tiles, a kid is wider than a point): ask again soon.
    if (bot.mx or bot.my) and abs(bot.x - bot.last_x) + abs(bot.y - bot.last_y) < 0.2:
        bot.stuck += 1
        if bot.stuck > 20:
            bot.path, bot.path_t, bot.stuck = [], 0, 0
            bot.mx, bot.my = random.uniform(-1, 1), random.uniform(-1, 1)
    else:
        bot.stuck = 0
    bot.last_x, bot.last_y = bot.x, bot.y


def pick_lane(bot):
    """A fresh way over for an attacker, as room points: one of LANES, mirrored for Blue."""
    lane = random.choice(LANES)
    out = []
    for c, r in lane:
        if bot.team != TEAMS[0]:
            c = COLS - 1 - c
        out.append(tile_middle(c, r))
    bot.lane = out


def bot_throw(bot):
    """At someone it can see and could reach: where they'll be, a little off."""
    if bot.stock <= 0 or bot.throw_t > 0:
        return
    # Sneaking over for their flag (or carrying it home), a bot throws only to save
    # itself. Near their flag, or chasing, it's a fight: anyone in reach.
    theirs = flag_of(other_team(bot.team))
    sneaking = bot.carry is not None or bot.why == "sneak" or (
        bot.why == "attack" and point_distance(bot.x, bot.y, theirs.x, theirs.y) > 500)
    most = SELF_DEFENCE if sneaking else THROW_MAX * 0.95
    best = None
    for e in global_vars.sees.get(bot, []):
        if e.stun > 0 or e.safe > 0:
            continue
        d = point_distance(bot.x, bot.y, e.x, e.y)
        if d <= most and (best is None or d < best[0]):
            best = (d, e)
    if best is None:
        return
    d, e = best
    t = d / BALL_PACE * BOT_LEAD          # steps the ball takes to get there, and how much of that a bot allows for
    err = BOT_AIM_ERROR * max(0.5, d / 200)
    tx = e.x + e.vx * t + random.uniform(-err, err)
    ty = e.y + e.vy * t + random.uniform(-err, err)
    reach = point_distance(bot.x, bot.y, tx, ty) + 30
    if throw(bot, tx, ty, (reach - THROW_MIN) / (THROW_MAX - THROW_MIN)) is not None:
        bot.throw_t = BOT_THROW_WAIT
