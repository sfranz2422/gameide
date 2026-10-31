# script: rules
# Moonshot's rules and numbers, as plain data: change one here and the game
# changes. Distances are in feet, speeds in miles an hour (mph) or feet a
# second, times in seconds unless they say steps (a step is 1/60 s).
#
# Where things are: home plate is (0, 0). On the field, x is across (first
# base is +x) and y runs out to centre field. For a pitch, y is the distance
# from the plate towards the pitcher and z is the height off the ground.

VIEW_W, VIEW_H = 640, 360

# ---------------------------------------------------------------- the teams

TEAMS = {
    "away": {"name": "Bluebirds", "short": "BLU", "colour": "#60a5fa", "dark": "#1e3a8a"},
    "home": {"name": "Rattlers", "short": "RAT", "colour": "#f87171", "dark": "#7f1d1d"},
}
INNINGS = 3           # a short game: three innings, more if it's tied
MOST_INNINGS = 9      # ...but never more than this: then it's a tie
DERBY_OUTS = 10       # a Home Run Derby round lasts this many outs

# ---------------------------------------------------------------- pitching

PLATE_HALF = 0.83     # the plate is 17 inches wide; a ball touching its edge counts
ZONE_LOW, ZONE_HIGH = 1.5, 3.5    # the strike zone: knees to the letters
RELEASE = (0.6, 54.0, 6.0)        # where the ball leaves the pitcher's hand (x, y, z)
SLOW_MOTION = 0.42    # pitches fly at this fraction of real speed, so they can be hit

# Each pitch: its speed, how far it bends ("move": feet across and up, over its
# flight; a curveball starts high and drops), how wild it can be ("control":
# feet off the target), and how well it fools a batter ("fool").
PITCHES = [
    {"name": "Fastball", "mph": 93, "move": (0.25, 0.35), "control": 0.18, "fool": 0.20, "colour": "#fca5a5"},
    {"name": "Curveball", "mph": 76, "move": (-0.7, -1.8), "control": 0.30, "fool": 0.45, "colour": "#93c5fd"},
    {"name": "Changeup", "mph": 81, "move": (0.6, -0.7), "control": 0.24, "fool": 0.40, "colour": "#86efac"},
    {"name": "Slider", "mph": 85, "move": (-1.2, -0.5), "control": 0.26, "fool": 0.35, "colour": "#fde68a"},
]
WINDUP_STEPS = 40     # from pressing Throw to the ball leaving his hand

# ---------------------------------------------------------------- batting

SWING_STEPS = 8       # from pressing Swing to the bat crossing the plate
TIMING_WINDOW = 7     # steps early or late the bat can still touch the ball
BAT_REACH = 0.55      # feet above or below the bat that it can still touch the ball
BAT_SIDE = 1.25       # feet each side of the plate's middle the bat reaches
BAT_LOW, BAT_HIGH = 1.1, 4.0      # how low and high a batter can aim the swing
BAT_MOVE = 0.06       # feet the aim moves a step while up or down is held

# How contact makes a hit: a perfect swing comes off the bat at BEST_MPH.
# Hitting under the ball's middle lifts it (LIFT degrees a foot); early
# swings pull it to left field and late ones push it right (SPRAY degrees a
# step), and an inside pitch is pulled too (INSIDE degrees a foot).
WORST_MPH, BEST_MPH = 50, 114
LAUNCH = 16           # degrees up off a bat that meets the ball dead centre
LIFT = 55
SPRAY = 6.5
INSIDE = 9
FOUL_ANGLE = 45       # a ball more than this far from centre field is foul

# ---------------------------------------------------------------- the ball in the air

GRAVITY = 32.2        # feet a second, every second
DRAG = 0.0012         # air: what makes 105 mph at 28 degrees carry about 420 feet, not 650
FLIGHT_SPEED = 1.6    # the flight is shown this many times faster than real
BOUNCE = 0.35         # a landing ball keeps this much of its fall, as a bounce
ROLL = 0.7            # ...and this much of its speed along the ground
GROUND_FRICTION = 22  # feet a second lost every second, rolling

# The fence: FENCE_LINE feet down the foul lines, FENCE_CENTRE to centre field.
FENCE_LINE, FENCE_CENTRE, FENCE_HIGH = 330, 400, 10

# ---------------------------------------------------------------- fielding and running

BASES = [(0, 0), (63.6, 63.6), (0, 127.3), (-63.6, 63.6)]     # home, first, second, third
FIELDERS = [   # name, where he stands, how fast he runs (feet a second)
    ("P", (0, 58), 18), ("C", (0, -5), 16), ("1B", (68, 82), 19), ("2B", (34, 138), 20),
    ("SS", (-34, 138), 21), ("3B", (-70, 82), 19), ("LF", (-165, 265), 27), ("CF", (0, 315), 28),
    ("RF", (165, 265), 27),
]
REACT = 0.5           # seconds before a fielder starts to run
REACH = 5             # feet a fielder can reach or dive
CATCH_HIGH = 9        # a ball lower than this can be caught (or fielded)
PICK_UP = 0.8         # seconds to pick up a ball on the ground before throwing
THROW = 90            # a throw's speed, feet a second
RUN_START = 0.6       # seconds for the batter to drop the bat and get going
RUN = 26              # a runner's speed, feet a second
INFIELD = 150         # a ball fielded nearer home than this is thrown to first

# ---------------------------------------------------------------- the two views

# Batting is seen from behind home plate, as on television: a camera CAM_BACK
# feet behind the plate and CAM_HIGH feet up. Something `d` feet in front of
# the camera is drawn CAM_FOCAL / d pixels a foot (project() in screen).
# build.py paints the field from these same numbers, so they always agree.
CAM_BACK, CAM_HIGH, CAM_FOCAL = 40, 8, 1360
CAM_HORIZON, CAM_MIDDLE = 68, 320      # where the far distance and the middle of the plate are on the screen
BATTER_AT = -2.9                        # the batter stands this far left of the plate's middle

# A ball in play is followed on a map of the field from above: home plate at
# (MAP_X, MAP_Y) on the screen, MAP_K pixels to a foot.
MAP_X, MAP_Y, MAP_K = 320, 344, 0.78
