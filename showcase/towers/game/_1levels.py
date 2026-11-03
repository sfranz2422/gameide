# script: levels
# The three battlefields, as numbers. The build paints each room's road from
# its path and places its Gate, Fort, trees and rocks; enemies walk the same
# path; so moving a corner here moves all of them. A cell is 64 pixels. The
# field is 16 cells by 8, with the buttons on a ninth row under it.
CELL = 64
COLS, ROWS = 16, 8

# A wave is a list of (enemy object, how many, steps between them). Their order
# plays out one after another. To add an enemy, make a child of Enemy and name it.
LEVELS = [
    {
        "name": "Clover Meadow",
        "ground": 157, "road": 158,          # tiles of Kenney's sheet: grass, dirt
        "gold": 200, "lives": 20, "tough": 0.06,   # each wave's enemies are this much tougher
        "path": [(0, 1), (4, 1), (4, 6), (9, 6), (9, 2), (13, 2), (13, 5), (15, 5)],
        "decor": [("tree", 1, 4), ("bush", 2, 6), ("rock", 7, 2), ("tree", 11, 6), ("bush", 14, 1), ("tree", 6, 0)],
        "waves": [
            [("Scout", 8, 40)],
            [("Scout", 10, 34), ("Soldier", 3, 50)],
            [("Soldier", 8, 42)],
            [("Scout", 12, 22), ("Soldier", 6, 40)],
            [("Plane", 4, 70), ("Soldier", 8, 36)],
            [("Tank", 2, 120), ("Scout", 12, 24)],
            [("Soldier", 12, 30), ("Plane", 5, 60)],
            [("Tank", 4, 90), ("Soldier", 10, 30), ("Boss", 1, 60)],
        ],
    },
    {
        "name": "Dusty Pass",
        "ground": 160, "road": 159,          # sand, stone
        "gold": 260, "lives": 15, "tough": 0.05,
        "path": [(8, 0), (8, 2), (3, 2), (3, 6), (7, 6), (7, 4), (12, 4), (12, 7), (15, 7)],
        "decor": [("rock", 1, 1), ("rock", 11, 1), ("bush", 14, 3), ("rock", 5, 4), ("rock", 1, 6), ("bush", 10, 6)],
        "waves": [
            [("Soldier", 8, 40)],
            [("Scout", 16, 20)],
            [("Soldier", 10, 34), ("Plane", 3, 70)],
            [("Tank", 3, 100), ("Scout", 12, 22)],
            [("Plane", 8, 45)],
            [("Tank", 5, 80), ("Soldier", 10, 28)],
            [("Heavy", 1, 160), ("Scout", 16, 20)],
            [("Plane", 6, 50), ("Tank", 4, 80)],
            [("Heavy", 2, 130), ("Soldier", 12, 26)],
            [("Tank", 5, 70), ("Heavy", 1, 120), ("Boss", 1, 60)],
        ],
    },
    {
        "name": "Stonewall Ridge",
        "ground": 159, "road": 160,          # stone, sand
        "gold": 280, "lives": 10, "tough": 0.11,
        "path": [(15, 1), (11, 1), (11, 3), (14, 3), (14, 6), (8, 6), (8, 1), (5, 1), (5, 6), (1, 6), (1, 2)],
        "decor": [("rock", 13, 5), ("rock", 3, 3), ("rock", 7, 3), ("bush", 10, 4), ("rock", 3, 0), ("bush", 12, 7)],
        "waves": [
            [("Soldier", 10, 34)],
            [("Tank", 3, 90), ("Scout", 14, 20)],
            [("Plane", 8, 44)],
            [("Tank", 5, 70), ("Soldier", 12, 26)],
            [("Heavy", 3, 120)],
            [("Plane", 10, 36), ("Scout", 20, 16)],
            [("Heavy", 4, 100), ("Tank", 6, 60)],
            [("Plane", 12, 30), ("Soldier", 18, 20)],
            [("Heavy", 5, 90), ("Scout", 24, 14)],
            [("Boss", 1, 60), ("Tank", 8, 50)],
            [("Heavy", 6, 80), ("Plane", 10, 30)],
            [("Boss", 2, 180), ("Heavy", 6, 70), ("Soldier", 20, 18)],
        ],
    },
]
ENEMIES = ("Scout", "Soldier", "Tank", "Heavy", "Plane", "Boss")     # what a wave may name
DECOR = ("tree", "bush", "rock")


def road_cells(level):
    """Every cell the road passes through, in order."""
    out = []
    pts = level["path"]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx = (bx > ax) - (bx < ax)
        dy = (by > ay) - (by < ay)
        x, y = ax, ay
        while (x, y) != (bx, by):
            out.append((x, y))
            x, y = x + dx, y + dy
    out.append(pts[-1])
    return out


def cell_middle(c, r):
    return (c + 0.5) * CELL, (r + 0.5) * CELL


def level_problems(level):
    """What's wrong with a level, in words. The build refuses a level with any."""
    problems = []
    pts = level["path"]
    for a, b in zip(pts, pts[1:]):
        if a[0] != b[0] and a[1] != b[1]:
            problems.append(f"the road from {a} to {b} isn't straight along a row or column")
    for c, r in pts:
        if not (0 <= c < COLS and 0 <= r < ROWS):
            problems.append(f"the road's corner {(c, r)} is off the field")
    c, r = pts[0]
    if c not in (0, COLS - 1) and r not in (0, ROWS - 1):
        problems.append(f"the road starts at {(c, r)}, not at the edge of the field")
    road = road_cells(level) if not problems else []
    if len(set(road)) != len(road):
        problems.append("the road crosses itself: enemies would be lost at the crossing")
    for what, c, r in level["decor"]:
        if what not in DECOR:
            problems.append(f"there is no decoration called {what}")
        if (c, r) in road:
            problems.append(f"a {what} stands on the road at {(c, r)}")
        if not (0 <= c < COLS and 0 <= r < ROWS):
            problems.append(f"a {what} at {(c, r)} is off the field")
    for i, wave in enumerate(level["waves"]):
        for name, count, gap in wave:
            if name not in ENEMIES:
                problems.append(f"wave {i + 1} sends {name}, and there is no such enemy")
            if count < 1 or gap < 1:
                problems.append(f"wave {i + 1} has {count} of {name}, {gap} steps apart")
    return problems
