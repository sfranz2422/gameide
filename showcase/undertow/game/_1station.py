# script: station
# Undertow's station: its rooms, the corridors between them, and where the jobs
# are. Everything is in tiles (32 pixels). build.py paints the map from this,
# and the tests walk it, so a change here is a change everywhere.

import math

VIEW_W, VIEW_H = 640, 360
TILE = 32
COLS, ROWS = 60, 40

# The rooms: name, then (column, row, width, height), and their floor.
ROOMS = [
    ("Meeting Hub", (24, 14, 12, 10), "rug"),
    ("Control", (24, 2, 12, 8), "metal"),
    ("Reef Lab", (4, 3, 13, 9), "lab"),
    ("Pump Room", (43, 3, 13, 9), "grating"),
    ("Observation", (4, 15, 10, 7), "glass"),
    ("Med Bay", (46, 15, 10, 7), "lab"),
    ("Sub Dock", (4, 27, 14, 10), "concrete"),
    ("Storage", (43, 27, 13, 10), "plates"),
]
# The corridors, each three tiles wide: (column, row, width, height).
CORRIDORS = [
    (29, 10, 3, 4),      # Hub up to Control
    (14, 17, 10, 3),     # Hub left to Observation
    (36, 17, 10, 3),     # Hub right to Med Bay
    (29, 24, 3, 7),      # Hub down to the lower corridor
    (18, 30, 25, 3),     # the lower corridor: Sub Dock to Storage
    (17, 5, 7, 3),       # Reef Lab to Control
    (36, 5, 7, 3),       # Control to Pump Room
    (8, 12, 3, 3),       # Reef Lab down to Observation
    (49, 12, 3, 3),      # Pump Room down to Med Bay
    (8, 22, 3, 5),       # Observation down to Sub Dock
    (49, 22, 3, 5),      # Med Bay down to Storage
]
FLOORS = ["metal", "grating", "glass", "lab", "concrete", "rug", "plates"]

# The jobs: their kind, the words for them, and where (column, row) their panel is.
JOB_KINDS = {
    "wires": "Fix the wires",
    "crystals": "Sort the crystals",
    "valve": "Set the pressure",
    "scan": "Take a body scan",
}
STATIONS = [
    ("wires", 26, 3), ("wires", 45, 4), ("wires", 54, 35),
    ("crystals", 6, 4), ("crystals", 45, 35),
    ("valve", 53, 10), ("valve", 6, 35),
    ("scan", 50, 18),
]
JOBS_EACH = 5          # how many jobs a player is given
REACH = 44             # how close (pixels) to a panel to use it
START = (30, 19)       # where everyone starts: the middle of the Meeting Hub (tile)
BEACON = (30, 16)      # the sonar beacon that calls a meeting (tile)
SPEED = 2.4            # pixels a step


def station_grid():
    """
    The map, row by row: a floor's name where you can walk, "wall" round every
    floor, None for the open sea outside (nothing drawn: the ocean behind shows).
    """
    grid = [[None] * COLS for _ in range(ROWS)]
    for _, (c, r, w, h), floor in ROOMS:
        for y in range(r, r + h):
            for x in range(c, c + w):
                grid[y][x] = floor
    for c, r, w, h in CORRIDORS:
        for y in range(r, r + h):
            for x in range(c, c + w):
                if grid[y][x] is None:
                    grid[y][x] = "metal"
    walls = []
    for y in range(ROWS):
        for x in range(COLS):
            if grid[y][x] is None and any(0 <= y + dy < ROWS and 0 <= x + dx < COLS and grid[y + dy][x + dx] not in (None, "wall")
                                          for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                walls.append((x, y))
    for x, y in walls:
        grid[y][x] = "wall"
    return grid


def room_at(x, y):
    """The name of the room at (x, y) in pixels, or "a corridor"."""
    c, r = int(x // TILE), int(y // TILE)
    for name, (rc, rr, w, h), _ in ROOMS:
        if rc <= c < rc + w and rr <= r < rr + h:
            return name
    return "a corridor"


def tile_middle(c, r):
    return c * TILE + TILE / 2, r * TILE + TILE / 2
