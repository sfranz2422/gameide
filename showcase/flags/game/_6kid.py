# script: kid
# What every Kid shares that isn't a decision: its pictures, its footprints, how it's
# drawn, and how a puppet (a kid another game runs) follows the word it's given.
import math


FRAME = {name: i for i, name in enumerate(KID_FRAMES)}


def pick_pose(kid, moving):
    """
    Which picture, and which way round: knocked down (then dizzy), cheering, a throw
    the way it threw, scooping, walking, or standing, each the way the kid looks.
    """
    m = global_vars.m
    side = kid.dir == "side"
    xs = kid.facing if side else 1
    if kid.stun > 0:
        name, xs = ("fallen" if kid.stun > STUN_STEPS * DIZZY_PART else "dizzy"), 1
    elif m["over"] is not None and m["over"] == kid.team:
        name, xs = "cheer", 1
    elif kid.cheer_t > 0:
        name, xs = "cheer", 1
    elif kid.pose_t > 0:
        name = "throw_" + kid.dir
    elif kid.scooping and not moving:
        name, xs = "scoop", kid.facing
    elif moving:
        kid.walk_t += WALK_RATE
        s = int(kid.walk_t) % 4
        if side:
            name = ["side_walk1", "side", "side_walk2", "side"][s]
        else:
            # One walking picture each way: the second step is the first, mirrored.
            name = [kid.dir + "_walk", kid.dir, kid.dir + "_walk", kid.dir][s]
            xs = -1 if s == 2 else 1
    else:
        name = kid.dir
    kid.image_index = FRAME[name]
    kid.xs = xs


def leave_prints(kid, moving):
    """Footprints in fresh snow (not on paths, not in the woods), every PRINT_EVERY steps of walking."""
    if moving:
        kid.print_t += 1
        if kid.print_t >= PRINT_EVERY and letter_at(kid.x, kid.y) == ".":
            kid.print_t = 0
            add_print(kid.x, kid.y, point_direction(0, 0, kid.vx, kid.vy))


def draw_kid(kid, x, y):
    """A kid at (x, y): flickering while just back at the fort, stars while dizzy, a room player's name over them."""
    if kid.away:
        return
    alpha = 0.5 if kid.safe > 0 and (kid.safe // 6) % 2 == 0 else 1
    draw_sprite_ext(kid.sprite, kid.image_index, x, y, kid.xs, 1, 0, "white", alpha)
    if kid.stun > 0:
        # Dizzy: little stars going round.
        t = kid.stun / 8
        draw_set_color("#ffe27a")
        for i in range(3):
            a = t + i * 2.1
            draw_circle(x + math.cos(a) * 12, y - 34 + math.sin(a) * 4, 2)
    name = kid_name(kid)
    if name:
        words(x, y - 58, name, 12, "#ffffff" if getattr(kid, "is_player", False) else TEAM_COLOURS.get(kid.team, "#ffffff"), "center")


def kid_name(kid):
    """What's written over a kid: "You", or another player's number and name. Computer kids have none."""
    if getattr(kid, "is_player", False):
        return "You"
    if kid.tag.startswith("p") and in_room():
        n = int(kid.tag[1:])
        p = next((p for p in net_players() if p.number == n), None)
        return f"#{n} {p.name}" if p is not None else f"#{n}"
    return ""


def puppet_step(kid):
    """
    A kid this game doesn't run, shown where it's said to be: another player at the
    engine's smoothed draw_x/draw_y (their own game's word, the freshest there is);
    a computer kid where the host said, carried on the way it was going between
    words and gliding onto each new one, as the engine does for players.
    """
    x0, y0 = kid.x, kid.y
    p = None
    if kid.tag.startswith("p"):
        n = int(kid.tag[1:])
        p = next((q for q in net_players() if q.number == n), None)
    if p is not None and p.draw_x is not None and kid.stun == 0:
        kid.x, kid.y = p.draw_x, p.draw_y
    elif kid.word is not None:
        x, y, vx, vy = kid.word
        t = min(kid.since, PUPPET_PREDICT)
        gx, gy = x + vx * t, y + vy * t
        if point_distance(kid.x, kid.y, gx, gy) > 300:
            kid.x, kid.y = gx, gy        # a long way (back at the fort after a hit): no gliding there
        else:
            kid.x += (gx - kid.x) * PUPPET_GLIDE
            kid.y += (gy - kid.y) * PUPPET_GLIDE
        kid.since += 1
    if kid.stun > 0:
        kid.stun -= 1
    if kid.safe > 0:
        kid.safe -= 1
    kid.vx, kid.vy = kid.x - x0, kid.y - y0
    leave_prints(kid, abs(kid.vx) + abs(kid.vy) > 0.3 and kid.stun == 0)
