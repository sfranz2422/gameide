# script: ball
# What the ground is at any point, and a ball's flight and roll: one step at
# a time, called by each Ball's Step event while it moves.
import math

GRAVITY = 0.25
CUP_RADIUS = 6         # a ball this close to the cup, slowly enough, drops in
CUP_SPEED = 4.0        # any faster and it lips out


def in_oval(x, y, oval):
    cx, cy, rx, ry = oval
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def near_path(x, y, points, width):
    """True if (x, y) is within half the width of the line through the points."""
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy or 1)))
        if point_distance(x, y, ax + dx * t, ay + dy * t) <= width / 2:
            return True
    return False


def ground(hole, x, y):
    """What's under (x, y): "green", "sand", "water", "fairway", "rough", or "out" off the course."""
    if x < 0 or y < 0 or x > COURSE_W or y > COURSE_H:
        return "out"
    gx, gy, gr = hole["green"]
    if point_distance(x, y, gx, gy) <= gr:
        return "green"
    if any(in_oval(x, y, s) for s in hole["sand"]):
        return "sand"
    if any(in_oval(x, y, w) for w in hole["water"]):
        return "water"
    if any(near_path(x, y, pts, w) for pts, w in hole["fairway"]) or point_distance(x, y, *hole["tee"]) < 30:
        return "fairway"
    return "rough"


def hit(ball, club, power, aim, wind):
    """Sends the ball off: `aim` in degrees (0 right, 90 up), `power` 0 to 1."""
    c = CLUBS[club]
    a = math.radians(aim)
    ball.last = (ball.x, ball.y)
    if c["name"] == "Putter":
        speed = PUTT_SPEED * power
        ball.vx, ball.vy, ball.vz, ball.z = math.cos(a) * speed, -math.sin(a) * speed, 0, 0
        ball.flying = False
    else:
        steps = max(12, c["steps"] * (0.5 + power / 2))
        speed = c["carry"] * power / steps
        ball.vx, ball.vy = math.cos(a) * speed, -math.sin(a) * speed
        ball.vz, ball.z = GRAVITY * steps / 2, 0.01
        ball.flying = True
    ball.club = club
    ball.wind = wind
    ball.moving = True


def roll(ball, hole):
    """One step of a moving ball. Returns what happened: None while it's still
    going, or "stopped", "holed", "water"."""
    if ball.flying:
        ball.vx += ball.wind[0] * 0.003     # the wind only pushes it while it's in the air
        ball.vy += ball.wind[1] * 0.003
        ball.x += ball.vx
        ball.y += ball.vy
        ball.z += ball.vz
        ball.vz -= GRAVITY
        if tree_hit(ball, hole):
            return None
        if ball.z > 0:
            return None
        ball.z = 0
        ball.flying = False
        under = ground(hole, ball.x, ball.y)
        if under in ("water", "out"):
            return "water"
        keep = CLUBS[ball.club]["roll"] * LANDING[under]
        ball.vx *= keep
        ball.vy *= keep
    ball.x += ball.vx
    ball.y += ball.vy
    tree_hit(ball, hole)
    under = ground(hole, ball.x, ball.y)
    if under in ("water", "out"):
        return "water"
    cx, cy = hole["cup"]
    speed = point_distance(0, 0, ball.vx, ball.vy)
    if point_distance(ball.x, ball.y, cx, cy) < CUP_RADIUS:
        if speed < CUP_SPEED:
            ball.x, ball.y = cx, cy
            ball.vx = ball.vy = 0
            return "holed"
        # Too fast: it catches the lip and kicks off to one side, slower, and
        # clear of the cup. (Left over it, it dropped in on the next step at
        # the slower speed, and no putt was ever too hard.)
        ball.vx, ball.vy = ball.vx * 0.6 - ball.vy * 0.25, ball.vy * 0.6 + ball.vx * 0.25
        s = point_distance(0, 0, ball.vx, ball.vy) or 1
        ball.x, ball.y = cx + ball.vx / s * (CUP_RADIUS + 1), cy + ball.vy / s * (CUP_RADIUS + 1)
    ball.vx *= GRIP[under]
    ball.vy *= GRIP[under]
    if speed < 0.05:
        ball.vx = ball.vy = 0
        return "stopped"
    return None


def tree_hit(ball, hole):
    """A ball low enough to reach a tree's leaves bounces back off it. True if it did."""
    for tx, ty, r in hole["trees"]:
        d = point_distance(ball.x, ball.y, tx, ty)
        if d < r * 0.8 and ball.z < 40:
            nx, ny = (ball.x - tx) / (d or 1), (ball.y - ty) / (d or 1)
            dot = ball.vx * nx + ball.vy * ny
            if dot < 0:                      # heading into the tree, not already leaving it
                ball.vx = (ball.vx - 2 * dot * nx) * 0.4
                ball.vy = (ball.vy - 2 * dot * ny) * 0.4
                ball.vz = min(ball.vz, 0)
                return True
    return False


def best_club(hole, x, y):
    """The club a caddie would hand you: the putter on the green, otherwise
    the shortest club that reaches the cup."""
    if ground(hole, x, y) == "green":
        return len(CLUBS) - 1
    d = point_distance(x, y, *hole["cup"])
    for i in range(len(CLUBS) - 2, -1, -1):
        if CLUBS[i]["carry"] * 1.1 >= d:
            return i
    return 0
