# script: room
# Climbing with your class. A published game asks for a room before it starts
# (make one, or type its code); in the editor there's never a room, and every
# net_ function quietly does nothing, so the game works alone too.
#
# Each player's game says where its climber is (net_send) and shouts each
# snowball it throws (net_shout). Every game draws the others as see-through
# Ghosts and flies their snowballs. Only YOUR game decides whether a snowball
# hit YOU: then nobody's computer argues about it.

# A colour for each player's number, so #3 is always the same colour.
NUMBER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#e84393",
                 "#16a085", "#c0392b", "#2980b9", "#27ae60", "#d35400", "#8e44ad", "#f1c40f", "#7f8c8d",
                 "#00b894", "#6c5ce7", "#fd79a8", "#0984e3"]
KNOCK = 4.5        # how hard a snowball shoves you across (running is 2.8)
KNOCK_HOP = -4.2   # and the little hop it gives you off your feet
DIZZY = 45         # steps the stars go round your head
PREDICT_STEPS = 12 # a Ghost carries on as they were going for at most this long between words


def number_color(n):
    return NUMBER_COLORS[(n - 1) % len(NUMBER_COLORS)]


def knock(climber, ball):
    """A snowball got you: a shove the way it was going, a little hop, stars."""
    push = KNOCK if ball.vx >= 0 else -KNOCK
    climber.vx = clamp(climber.vx + push, -2 * KNOCK, 2 * KNOCK)
    if climber.on is not None:
        climber.on = None
        climber.vy = KNOCK_HOP
        climber.top_of_fall = climber.y
    climber.dizzy = DIZZY
    sound_play("bonk", volume=0.5)


def hits(ball, climber):
    """Is the snowball on the climber: anywhere from their boots to the top of their head?"""
    return abs(ball.x - climber.x) < 16 and climber.y - 56 < ball.y < climber.y + 2


def fly(ball):
    """
    One step of a snowball: it moves, and bursts on whatever it meets. True once
    it has burst (and is gone). Another player's snowball can hit you; yours
    burst on them (their own game decides what that does to them, and you see
    the stars), and never on you.
    """
    ball.vy += SNOW_GRAVITY
    ball.x += ball.vx
    ball.y += ball.vy
    hit = ball.x < WALL_L or ball.x > WALL_R
    me = global_vars.player
    if ball.thrower != 0:
        if hits(ball, me) and not game_paused():
            knock(me, ball)
            hit = True
    else:
        for g in instances("Ghost"):
            if hits(ball, g):
                hit = True
                g.dizzy = DIZZY
    for ledge in instances("Ledge"):
        if not ledge.broken and abs(ball.x - ledge.x) < ledge.half and ledge.y - 2 <= ball.y <= ledge.y + 16:
            hit = True
    if hit:
        instance_create(ball.x, ball.y, "Splat")
        sound_play("splat", volume=0.35)
        ball.destroy()
    return hit
