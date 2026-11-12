# script: match
# The referee: everything that DECIDES something in a match is here, in one
# place — a hit, picking up a flag, sending one home, a capture, the clock and
# who wins. Kids (the player's and the computer's alike) only ask: throw(),
# and they walk where they like. In a room only the game in charge (the room
# script's runs_match()) runs these; the others show what it decided, so a
# changed game in a browser can't claim a capture it didn't make.
import math
import random


def other_team(team):
    return "blue" if team == "red" else "red"


def kids(team=None):
    """
    Every kid on the field (the player and the computer's), or one team's. Not a
    player who is away (answering a question): they're off the field, can't be
    seen or hit, and touch nothing until they're back.
    """
    return [k for k in instances("Kid") if not k.away and k.team is not None and (team is None or k.team == team)]


def flag_of(team):
    return next((f for f in instances("Flag") if f.team == team), None)


def standing(kid):
    """Can this kid act: on their feet, not knocked down, and a match on (not over, not waiting in a room's lobby)?"""
    m = global_vars.m
    return kid.stun == 0 and m["over"] is None and m["ph"] == "play" and kid.team is not None and not kid.away


# ---- throwing

def throw(kid, tx, ty, charge, real=True):
    """
    A kid throws a snowball towards (tx, ty): `charge` 0 (a tap) to 1 (held for
    CHARGE_STEPS) is how far it flies. Nothing happens without a snowball in
    hand, while knocked down, or too soon after the last. Returns the ball, or None.
    Not `real`: a room player's own copy, flying while the host throws the real one.
    """
    if not standing(kid) or kid.stock <= 0 or kid.throw_t > 0:
        return None
    a = math.atan2(ty - kid.y, tx - kid.x)
    if tx == kid.x and ty == kid.y:
        a = 0 if kid.facing > 0 else math.pi
    charge = clamp(charge, 0, 1)
    b = make_ball(kid.team, kid.x + math.cos(a) * 10, kid.y + math.sin(a) * 6, math.cos(a) * BALL_PACE,
                  math.sin(a) * BALL_PACE, THROW_MIN + (THROW_MAX - THROW_MIN) * charge, kid, real)
    kid.stock -= 1
    kid.throw_t = THROW_WAIT
    kid.pose_t = 12
    kid.facing = 1 if math.cos(a) >= 0 else -1
    # The picture: a throw across, or towards you, or away.
    if abs(math.cos(a)) >= 0.6:
        kid.dir = "side"
    else:
        kid.dir = "down" if math.sin(a) > 0 else "up"
    return b


def make_ball(team, x, y, vx, vy, length, thrower=None, real=True):
    """
    A snowball in flight. Only a real one can knock anyone down: in a room, the
    host's. The others' games fly a copy of each (it looks the same), and a
    player's own throw flies at once in their own game, before the host has it.
    """
    b = instance_create(x, y, "Snowball")
    b.team, b.thrower, b.real = team, thrower, real
    b.vx, b.vy, b.length = vx, vy, length
    if real and in_room():
        global_vars.thrown.append([thrower.tag if thrower is not None else "", round(x), round(y),
                                   round(vx, 2), round(vy, 2), round(length), team])
    return b


def ball_hits(ball, kid):
    """A snowball reached a kid: an enemy on their feet (and not just back at the fort) is knocked down."""
    if (not ball.real or kid.team == ball.team or kid.team is None or kid.away or kid.stun > 0 or kid.safe > 0
            or not playing_match()):
        return False
    knock_down(kid)
    if ball.thrower is not None:
        tag = ball.thrower.tag
        global_vars.m["hits"][tag] = global_vars.m["hits"].get(tag, 0) + 1
    return True


def playing_match():
    m = global_vars.m
    return m["over"] is None and m["ph"] == "play"


def knock_down(kid):
    """Down in the snow for STUN_STEPS: a carried flag drops where they fell."""
    if kid.carry is not None:
        drop_flag(kid.carry, kid.x, kid.y)
    kid.downs += 1
    fall(kid)


def fall(kid):
    """How being knocked down looks and sounds (in every game: the host decides it, the others show it)."""
    kid.stun = STUN_STEPS
    kid.mx = kid.my = 0
    particles(kid.x, kid.y - 16, 16, ["#ffffff", "#dceeff"], 3, 4, 26, 0.15)
    if getattr(kid, "is_player", False):
        camera_shake(6, 18)
        sound_play("hit", volume=0.6)
    elif point_distance(kid.x, kid.y, view_x + VIEW_W / 2, view_y + VIEW_H / 2) < VIEW_W:
        sound_play("thud", volume=0.4)


def back_to_fort(kid):
    """
    Up again after a hit: back at their own fort, safe for a moment. In a room it's
    the host's to say: a player's own game waits for the word (a new `life` in the
    match) and only then puts them there, so the two never disagree about where.
    """
    if getattr(kid, "is_player", False) and not runs_match():
        return
    spawn(kid)


def spawn(kid):
    """Put a kid at its place in its fort: at a match's start, and after every hit."""
    kid.x, kid.y = spawn_spot(kid.team, kid.k)
    kid.safe = SAFE_STEPS
    kid.stun = 0
    kid.life += 1
    kid.path = []
    if getattr(kid, "role", None) == "attack":
        pick_lane(kid)


# ---- flags

def drop_flag(flag, x, y):
    flag.state, flag.carrier = "dropped", None
    flag.x, flag.y = x, y
    flag.drop_t = DROP_RETURN
    for k in kids():
        if k.carry is flag:
            k.carry = None


def flag_home(flag):
    for k in kids():
        if k.carry is flag:
            k.carry = None
    flag.state, flag.carrier, flag.drop_t = "home", None, 0
    flag.x, flag.y = stand_of(flag.team)


def touch_flags(kid):
    """A kid on their feet near a flag: their own, dropped, goes home; the other team's, home or dropped, is theirs to carry."""
    if not standing(kid) or kid.safe > SAFE_STEPS - 20 or kid.puppet:
        return
    for f in instances("Flag"):
        if f.state == "carried" or point_distance(kid.x, kid.y, f.x, f.y) > TOUCH_REACH:
            continue
        if f.team == kid.team:
            if f.state == "dropped":
                flag_home(f)
                sound_play("return", volume=0.5)
        elif kid.carry is None:
            f.state, f.carrier = "carried", kid
            kid.carry = f
            sound_play("grab", volume=0.6)
    # Home with their flag, and your own on its stand: a capture.
    mine = flag_of(kid.team)
    if kid.carry is not None and mine is not None and mine.state == "home":
        sx, sy = stand_of(kid.team)
        if point_distance(kid.x, kid.y, sx, sy) <= CAPTURE_REACH:
            capture(kid)


def capture(kid):
    m = global_vars.m
    flag = kid.carry
    m["score"][kid.team] += 1
    flag_home(flag)
    effect("confetti", kid.x, kid.y - 20, TEAM_COLOURS[kid.team], 1.4)
    sound_play("capture", volume=0.7)
    kid.cheer_t = CHEER_STEPS
    # Who captured, in order: each game counts its own player's (count_mine), so a
    # capture the host saw a room player make reaches that player's own board.
    m["caps"].append(kid.tag)
    m["news"] = (f"{TEAM_NAMES[kid.team]} captured the flag!", 150)
    if m["score"][kid.team] >= CAPTURES_TO_WIN or m["overtime"]:
        end_match(kid.team)


# ---- the clock

def new_match(ph="play"):
    """A fresh match: nothing scored, the full time on the clock. In a room it starts in the lobby."""
    global_vars.m = {"score": {t: 0 for t in TEAMS}, "t": MATCH_STEPS, "over": None, "over_t": 0, "ph": ph,
                     "overtime": False, "news": None, "mine": 0, "hits": {}, "caps": [], "counted": 0, "n": 0}


def count_mine():
    """Captures by this game's own player, put on the school's board (high_score counts them all told)."""
    m = global_vars.m
    while m["counted"] < len(m["caps"]):
        if m["caps"][m["counted"]] == global_vars.player.tag:
            m["mine"] += 1
            total = save_get("captures", 0) + 1
            save_set("captures", total)
            high_score(total)
        m["counted"] += 1


def end_match(team):
    """`team` wins ("draw" never happens: a tie plays on into overtime)."""
    m = global_vars.m
    m["over"], m["over_t"] = team, OVER_STEPS
    for k in kids():
        k.mx = k.my = 0
    match_over_sound(team)


def match_over_sound(team):
    sound_play("win" if team == global_vars.player.team else "lose", volume=0.7)


def run_clock():
    """Once a step: the time, dropped flags going home by themselves, and the end."""
    m = global_vars.m
    if m["over"] is not None:
        m["over_t"] -= 1
        if m["over_t"] <= 0:
            if in_room():
                to_lobby()       # in a room: back to walking about, for the next match
            else:
                room_goto("Title")
        return
    if m["ph"] != "play":
        return
    for f in instances("Flag"):
        if f.state == "dropped":
            f.drop_t -= 1
            if f.drop_t <= 0:
                flag_home(f)
    if m["news"] is not None:
        text, t = m["news"]
        m["news"] = (text, t - 1) if t > 1 else None
    if m["t"] > 0:
        m["t"] -= 1
        if m["t"] == 0:
            a, b = (m["score"][t] for t in TEAMS)
            if a != b:
                end_match(TEAMS[0] if a > b else TEAMS[1])
            else:
                m["overtime"] = True
                m["news"] = ("Overtime! The next capture wins.", 240)


# ---- seeing

def clear_line(a, b):
    """Nothing solid (a pine, a bank, a hedge, a fort's wall) between two kids. The creek doesn't block it."""
    return collision_line(a.x, a.y - 14, b.x, b.y - 14, "Walls") is None


def work_out_sight():
    """
    Who can see whom, every SIGHT_EVERY steps: each pair of enemies near enough,
    one line each (the engine's collision_line, not Python stepping along it).
    Kept as global_vars.sees: a kid → the enemies they can see. The minimap shows
    an enemy only while someone on your team sees them, and computer kids only
    throw at someone they can see.
    """
    sees = {k: [] for k in kids()}
    if not playing_match():
        global_vars.sees = sees
        return
    reds, blues = kids(TEAMS[0]), kids(TEAMS[1])
    for a in reds:
        for b in blues:
            # In the woods you're seen only from close by: that's where you sneak.
            reach = WOODS_SIGHT if in_woods(a.x, a.y) or in_woods(b.x, b.y) else SIGHT
            if point_distance(a.x, a.y, b.x, b.y) <= reach and clear_line(a, b):
                if a.stun == 0:
                    sees[a].append(b)
                if b.stun == 0:
                    sees[b].append(a)
    global_vars.sees = sees


def seen_by_team(team):
    """Enemies someone on `team` can see."""
    out = []
    for k, them in global_vars.sees.items():
        if k.team == team:
            for e in them:
                if e not in out:
                    out.append(e)
    return out


def splat(ball):
    """A snowball bursts into powder, where it is (up in the air as it's drawn)."""
    instance_create(ball.x, ball.y - ball.z - 14, "Splat")
    particles(ball.x, ball.y - ball.z - 14, 6, ["#ffffff", "#e6f2ff"], 2, 3, 16, 0.1)
    ball.destroy()
