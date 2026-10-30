# script: play
# A round: whose turn it is, strokes, what each hole scored. One to four
# players take turns on one computer, the way golf does it: whoever is
# furthest from the cup plays next.
import math
import random

ROUND = {}
BALLS = []             # one Ball instance for each player
MAX_OVER_PAR = 5       # at par + 5 you pick your ball up: no hole goes on for ever


def new_round(players):
    ROUND.clear()
    ROUND.update(players=players, hole=0, cards=[[None] * len(HOLES) for _ in range(players)])
    for i, b in enumerate(BALLS):
        b.visible = i < players


def hole_now():
    return HOLES[ROUND["hole"]]


def start_hole():
    """Everyone on the tee, nobody's taken a shot, and a wind for this hole."""
    h = hole_now()
    tx, ty = h["tee"]
    ROUND["strokes"] = [0] * ROUND["players"]
    ROUND["holed"] = [False] * ROUND["players"]
    for i in range(ROUND["players"]):
        b = BALLS[i]
        # Side by side on the tee, so they don't sit on top of each other.
        b.x, b.y, b.z = tx + (i % 2) * 8 - 4, ty + (i // 2) * 8 - 4, 0
        b.vx = b.vy = b.vz = 0
        b.moving = b.flying = False
        b.last = (b.x, b.y)
    a = random.uniform(0, 6.283)
    speed = random.choice([0, 2, 4, 6, 8]) if ROUND["hole"] else 2
    ROUND["wind"] = (math.cos(a) * speed, math.sin(a) * speed)
    ROUND["turn"] = next_player()


def next_player():
    """The player still playing who is furthest from the cup, or None when everyone's holed."""
    cx, cy = hole_now()["cup"]
    left = [i for i in range(ROUND["players"]) if not ROUND["holed"][i]]
    if not left:
        return None
    return max(left, key=lambda i: point_distance(BALLS[i].x, BALLS[i].y, cx, cy))


def shot_over(result):
    """The ball has stopped. Counts the stroke, and says what happened, in words."""
    i = ROUND["turn"]
    b = BALLS[i]
    ROUND["strokes"][i] += 1
    words = ""
    if result == "water":
        ROUND["strokes"][i] += 1                     # a penalty stroke, and play again from where you were
        b.x, b.y = b.last
        b.z = 0
        words = "In the water! One stroke penalty."
    if result == "holed":
        ROUND["holed"][i] = True
        words = score_words(ROUND["strokes"][i], hole_now()["par"])
    elif ROUND["strokes"][i] >= hole_now()["par"] + MAX_OVER_PAR:
        ROUND["holed"][i] = True                     # picked up
        words = "Picked up."
    if ROUND["holed"][i]:
        ROUND["cards"][i][ROUND["hole"]] = ROUND["strokes"][i]
    ROUND["turn"] = next_player()
    return words


def score_words(strokes, par):
    if strokes == 1:
        return "HOLE IN ONE!"
    names = {-3: "Albatross!", -2: "Eagle!", -1: "Birdie!", 0: "Par.", 1: "Bogey.", 2: "Double bogey."}
    return names.get(strokes - par, f"{strokes - par} over par.")


def total(player):
    return sum(s for s in ROUND["cards"][player] if s is not None)


def total_par(upto):
    return sum(h["par"] for h in HOLES[:upto])


def against_par(player):
    """"-2", "E" or "+3": the score against the par of the holes played."""
    played = [k for k, s in enumerate(ROUND["cards"][player]) if s is not None]
    d = total(player) - sum(HOLES[k]["par"] for k in played)
    return "E" if d == 0 else f"{d:+d}"


def yards(px):
    return round(px / YARDS)


def aim_at_pin(game):
    """A new shot: the camera on the ball, aimed at the pin, with the club a caddie would pick."""
    ball = BALLS[ROUND["turn"]]
    cx, cy = hole_now()["cup"]
    game.aim = point_direction(ball.x, ball.y, cx, cy)
    game.club = best_club(hole_now(), ball.x, ball.y)
    camera_follow(ball, 0.15)
