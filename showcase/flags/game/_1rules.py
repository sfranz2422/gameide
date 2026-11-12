# script: rules
# Snowfort Flags: every number the game plays by. Change one here and it changes
# everywhere: the build reads this file too, and so do the tests.
#
# A NOTE ON NAMES: an instance variable named like one of the engine's own
# properties (speed, direction, gravity, friction, glow, spin, solid, visible…)
# IS the engine's: `self.speed` would make the engine move a kid by itself every
# step. So a kid's own numbers here are pace, aim, stun, and so on.

VIEW_W, VIEW_H = 640, 360
TILE = 32

# ---- the two teams
TEAMS = ["red", "blue"]
TEAM_NAMES = {"red": "Red", "blue": "Blue"}
TEAM_COLOURS = {"red": "#e8463c", "blue": "#3b82f6"}
TEAM_SIZE = 4                # kids a side: computer kids fill every place no player has
# Four looks a side, so kids can be told apart (each one a coat and a hat colour).
LOOKS = {
    "red": [("puffer", "#e8463c", "#f4f4f4"), ("parka", "#c8322c", "#8a5a3a"),
            ("scarf", "#ef5a4a", "#ffd23f"), ("snowsuit", "#b8282a", "#3ecf8e")],
    "blue": [("puffer", "#3b82f6", "#ffd23f"), ("parka", "#2f6ad8", "#8a5a3a"),
             ("scarf", "#4f95ff", "#f4f4f4"), ("snowsuit", "#2557c0", "#ff7ac6")],
}

# ---- the match
CAPTURES_TO_WIN = 3
MATCH_STEPS = 8 * 60 * 60    # eight minutes; most captures then wins, and a tie plays on
                             # until the next capture (overtime: sudden death)
OVER_STEPS = 6 * 60          # showing who won, before the title

# ---- a kid
PACE = 3.2                   # pixels a step, walking
CARRY_PACE = 2.9             # carrying a flag: a little slower, so the carrier can be caught
STOCK_MAX = 5                # snowballs a kid can carry
STOCK_START = 3
SCOOP_STEPS = 30             # steps of scooping at a drift for one more snowball
SCOOP_REACH = 40             # pixels from a drift to scoop it
STUN_STEPS = 3 * 60          # knocked down this long by a hit…
SAFE_STEPS = 90              # …then back at the fort, and can't be hit for this long
THROW_WAIT = 24              # steps between throws

# ---- a snowball
THROW_MIN = 110              # pixels it flies, tapped…
THROW_MAX = 400              # …and held for CHARGE_STEPS
CHARGE_STEPS = 45
BALL_PACE = 7                # pixels a step
ARC = 0.18                   # how high it arcs, for its length
LOW = 22                     # a snowball hits a kid, or a bank or hedge, only this low (pixels up): a long
                             # throw sails over everything in the middle of its flight and comes down at the
                             # end, so how long you hold the throw matters. Pines and fort walls are tall:
                             # they stop it at any height.
HIT_REACH = 11               # pixels round a snowball's shadow that count as reaching a kid's feet

# ---- flags
TOUCH_REACH = 26             # pixels between a kid and a flag to grab or return it
CAPTURE_REACH = 34           # pixels from your own stand to score with their flag
DROP_RETURN = 20 * 60        # a dropped flag nobody touches goes home after this

# ---- seeing
SIGHT = 330                  # how far a kid can see someone (if nothing's in the way)…
WOODS_SIGHT = 120            # …but someone in the woods, only this far
WOODS_DARK = 0.96            # how dark it gets in the woods (the teacher asked for darker: 0.82 was)…
WOODS_LIGHT = 150            # …all but this far round you
WOODS_NOTE_STEPS = 4 * 60    # how long "In the pine woods…" stays up, each time you walk in
WOODS_NOTE = ("In the pine woods: you're harder to see.", "So is everyone else. Only those close by can spot you.")
SIGHT_EVERY = 15             # steps between working out who can see whom

# ---- the computer kids
THINK_EVERY = 20             # steps between a bot's decisions (each bot on its own beat)
PATH_EVERY = 90              # steps before a bot looks for a fresh way to the same goal
GUARD_RADIUS = 260           # how far from home a defender wanders
BOT_AIM_ERROR = 30           # pixels a bot's throw can be off by, at 200 pixels away (more, further off)
BOT_LEAD = 0.8               # how much of someone's walk a bot allows for, aiming ahead of them
BOT_ROLES = ["attack", "defend", "attack", "roam"]   # the roles, in the order kids are made
BOT_THROW_WAIT = 50          # steps a computer kid waits between throws (a person, THROW_WAIT)
CHASE_REACH = 900            # a defender or a roamer goes after someone carrying its flag only this close
SELF_DEFENCE = 170           # an attacker sneaking for the flag throws only at someone this close
# The ways an attacker sneaks over: through a wood on its own side, over a bridge,
# through the wood on theirs (tiles, on Red's side; Blue's are the same, mirrored).
LANES = [[(29, 8), (54, 10), (82, 8)], [(27, 35), (54, 33), (84, 35)]]

# ---- footprints
PRINT_EVERY = 14             # steps between footprints, walking on fresh snow
PRINT_LIFE = 10 * 60         # how long one lasts (it fades)
PRINTS_MAX = 260             # the oldest go first

# ---- the minimap
MAP_K = 0.05                 # the minimap's size: the park, this many times

# ---- in a room (the room script)
# One game is in charge (net_host()): it runs the match, every computer kid, and
# every decision, and sends the match to the others as "g". Everyone walks their
# own kid in their own game; the host's copy of a player follows where they say
# they are, but never faster than this many times a kid's pace, so a changed game
# claiming to be across the park (on the other team's flag) gets nowhere quicker
# than walking. More than 1, so the host's copy catches up after the room's delay.
CATCH_UP = 1.7
ROOM_GONE_STEPS = 120 * 60   # a player not here this long (not just answering a question) has left the match:
                             # a computer kid takes their place
HOST_SETTLE = 30             # steps a new host listens before running the match (the old host's last word)
OLD_HOST_SENDS = 120         # steps a game that stops being the host keeps sending its copy, for the next one
PUPPET_GLIDE = 0.35          # how far a computer kid in someone else's game glides to where the host says, a step
PUPPET_PREDICT = 12          # …carried on the way it was going for at most this many steps between words
BALLS_A_WORD = 10            # thrown snowballs the host shouts in one message (a message is 500 characters at most)

# ---- pictures
# A kid's frames, in order (build.py makes every kid's sprite with these, from the
# teacher's pictures, or stand-ins). Walking toward you is "down", away "up";
# "side" faces right and is flipped to face left.
KID_FRAMES = ["down", "down_walk", "up", "up_walk", "side", "side_walk1", "side_walk2",
              "throw_down", "throw_side", "throw_up", "scoop", "fallen", "dizzy", "cheer"]
WALK_RATE = 0.14             # walking frames a step
CHEER_STEPS = 60             # a kid who captured cheers this long
DIZZY_PART = 0.4             # the last part of being knocked down: up, but dizzy
SPLAT_STEPS = 4              # steps each picture of a snowball's splat shows
PINES = ["pine_big", "pine", "pine", "pine_small", "pine"]   # the woods' pines, by how often
STANDOFF_WAIT = 20 * 60      # a computer kid carrying their flag, ours gone too, waits at home this long, then goes for ours
