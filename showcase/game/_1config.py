# script: config
# How the game feels, in one place. Change a number, press Play, feel it.

# The hero (pixels and steps; the game runs 60 steps a second)
RUN_SPEED = 2.2        # top running speed
ACCEL = 0.4            # speeding up each step
DECEL = 0.5            # slowing down when no key is held
GRAVITY = 0.3          # pulls a little harder every step
MAX_FALL = 6.5         # but never faster than this
JUMP_SPEED = 6.3       # 66 px high: four tiles
AIR_JUMP_SPEED = 5.6   # the relic's second jump: three more
JUMP_CUT = -2.0        # let go of jump early and the rise is cut to this
COYOTE = 6             # steps after leaving a ledge that a jump still works
JUMP_BUFFER = 7        # steps before landing that a jump press is remembered
HURT_TIME = 75         # steps of flashing after being hit, when nothing can hurt you
KNOCKBACK = 2.6

# The sword
SWING_STEPS = 14       # one swing, start to finish
SLASH_FROM, SLASH_TO = 3, 9   # the steps of a swing that can hit
SLASH_REACH = 22       # how far in front of the hero the blade reaches

# Tiles of the plank layer that can be stood on (one-way platforms)
PLANK_TILES = (155, 156, 157)

# Animation lengths, for holding the last frame of a jump or a fall
FRAMES = {"hero_jump": 5, "hero_fall": 5, "hero_dead": 8}

# The levels, in order: (room, the name shown as it starts, its music)
LEVELS = [("Thornwood", "The Thornwood", "music_forest")]
