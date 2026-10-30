# script: course
# The nine holes, as plain data: change a number here and the hole changes,
# in the game and in its picture (build.py paints each hole from this same
# list). Everything is in pixels, on a course 1280 wide and 720 tall.
#
# A hole has a tee and a cup, its par, and its ground:
#   fairway: paths the ball rolls far on: (points along the middle, width)
#   green:   (x, y, radius), round, around the cup; the putter is used here
#   sand:    (x, y, across, down) ovals: the ball stops dead in them
#   water:   (x, y, across, down) ovals: a stroke lost, and play again
#   trees:   (x, y, radius): the ball bounces off them
# Anywhere else is rough, which slows the ball down.

COURSE_W, COURSE_H = 1280, 720
YARDS = 2.0          # pixels to a yard, for the distances shown: par 3s about 200, a driver 190

HOLES = [
    {"name": "Opening Drive", "par": 4, "tee": (180, 380), "cup": (960, 340),
     "fairway": [([(240, 380), (600, 370), (880, 345)], 120)],
     "green": (970, 340, 72), "sand": [(900, 250, 48, 26), (1050, 420, 40, 24)], "water": [],
     "trees": [(420, 250, 30), (470, 520, 26), (700, 240, 28), (760, 500, 24), (1120, 300, 30)]},
    {"name": "Over the Pond", "par": 3, "tee": (300, 560), "cup": (660, 300),
     "fairway": [([(300, 560), (330, 530)], 70)],
     "green": (670, 290, 70), "sand": [(760, 230, 40, 24)], "water": [(480, 440, 150, 90)],
     "trees": [(200, 420, 26), (860, 420, 30), (420, 220, 28)]},
    {"name": "The Long Way", "par": 5, "tee": (120, 620), "cup": (1150, 120),
     "fairway": [([(180, 600), (560, 560), (800, 380), (1060, 180)], 110)],
     "green": (1150, 120, 70), "sand": [(700, 520, 60, 30), (1060, 250, 40, 22)], "water": [(960, 520, 110, 70)],
     "trees": [(360, 470, 30), (420, 680, 26), (620, 420, 28), (900, 260, 30), (1000, 40, 26), (1220, 260, 28)]},
    {"name": "Dogleg Left", "par": 4, "tee": (1080, 600), "cup": (420, 220),
     "fairway": [([(1040, 560), (900, 330), (560, 250)], 110)],
     "green": (420, 220, 70), "sand": [(520, 150, 44, 24)], "water": [],
     "trees": [(700, 450, 40), (770, 530, 36), (630, 520, 34), (1180, 400, 30), (980, 180, 28)]},
    {"name": "Island Green", "par": 3, "tee": (260, 360), "cup": (640, 360),
     "fairway": [([(260, 360), (300, 360)], 70)],
     "green": (640, 360, 80), "sand": [], "water": [(640, 360, 240, 170)],
     "trees": [(200, 220, 28), (200, 500, 28), (980, 240, 30), (980, 480, 30)]},
    {"name": "Bunker Alley", "par": 4, "tee": (160, 200), "cup": (1000, 520),
     "fairway": [([(220, 230), (600, 360), (900, 480)], 120)],
     "green": (1010, 520, 72), "sand": [(480, 240, 50, 24), (700, 470, 50, 24), (820, 330, 44, 22), (940, 610, 40, 22)],
     "water": [], "trees": [(300, 400, 30), (560, 560, 28), (760, 200, 30), (1160, 420, 28)]},
    {"name": "Lakeside", "par": 5, "tee": (100, 360), "cup": (1180, 360),
     "fairway": [([(160, 360), (620, 330)], 110), ([(780, 340), (1100, 360)], 110)],
     "green": (1185, 360, 66), "sand": [(1100, 260, 40, 22)],
     "water": [(640, 640, 560, 100), (700, 360, 34, 190)],
     "trees": [(300, 200, 30), (480, 180, 28), (900, 200, 30), (1040, 520, 28)]},
    {"name": "Tree Gate", "par": 3, "tee": (640, 620), "cup": (640, 220),
     "fairway": [([(640, 620), (640, 580)], 70)],
     "green": (640, 210, 70), "sand": [(560, 150, 40, 24), (730, 150, 40, 24)], "water": [],
     "trees": [(560, 420, 40), (720, 420, 40), (480, 300, 34), (800, 300, 34)]},
    {"name": "Home Hole", "par": 4, "tee": (200, 560), "cup": (1050, 250),
     "fairway": [([(260, 540), (640, 420), (960, 290)], 120)],
     "green": (1060, 250, 74), "sand": [(900, 200, 46, 24), (1130, 320, 40, 24)], "water": [(700, 600, 160, 70)],
     "trees": [(420, 380, 30), (560, 300, 28), (800, 520, 30), (1200, 140, 28)]},
]

# The clubs: how far the ball flies at full power (pixels), how high, and how
# much of its speed it keeps to roll once it lands.
CLUBS = [
    {"name": "Driver", "carry": 380, "steps": 60, "roll": 0.30},
    {"name": "Iron", "carry": 260, "steps": 56, "roll": 0.20},
    {"name": "Wedge", "carry": 140, "steps": 54, "roll": 0.08},
    {"name": "Putter", "carry": 0, "steps": 0, "roll": 1.0},
]
PUTT_SPEED = 7.0       # a full-power putt's speed, in pixels a step

# How each kind of ground slows a rolling ball: the speed kept each step.
GRIP = {"fairway": 0.955, "green": 0.975, "rough": 0.90, "sand": 0.70}
# And how much speed a landing ball keeps to roll, on each.
LANDING = {"fairway": 1.0, "green": 0.7, "rough": 0.5, "sand": 0.0}

PLAYER_COLOURS = ["#3b82f6", "#ef4444", "#22c55e", "#f8fafc"]
PLAYER_NAMES = ["Blue", "Red", "Green", "White"]
