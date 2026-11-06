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
KNOCK = 3.2        # how hard a snowball shoves you across (running is 2.8)
KNOCK_HOP = -3.4   # and the little hop it gives you off your feet
DIZZY = 45         # steps the stars go round your head


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
    """Is the snowball on the climber's body (not just near their feet or over their head)?"""
    return abs(ball.x - climber.x) < 12 and climber.y - 50 < ball.y < climber.y - 2
