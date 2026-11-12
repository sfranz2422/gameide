# script: map
# The park, as letters: one a tile (TILE pixels). This is the LEFT half, Red's;
# the right half is the same, mirrored, so neither team has the better side.
# build.py paints it, the game places its drifts and stands from it, and the
# tests walk it, so a change here is a change everywhere.
#
#   .  fresh snow (footprints show)     ,  a trodden path
#   w  the woods: dark in there          T  a pine (solid, blocks sight)
#   B  a snowbank (solid)                H  a hedge (solid)
#   F  the fort's wall (solid)           ~  the frozen creek: snowballs fly over it,
#   =  a bridge over it                     nobody walks on it
#   D  a snow drift to scoop             S  your flag's stand (and where you start)

LEFT = [
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    "T.....................................................~~",
    "T................TwwwwTwwwTTwwwwTwwwwTwww.............~~",
    "T................TTwwwwTwwwwTwwwwTwwwwTTw.............~~",
    "T................wwTwwwwTwwwwTTwwwTwwwwTw.............~~",
    "T.........D......wwwTTwwwTwwwwTwTwwTwwwwT.............~~",
    "T................wwwwTwTwwTwwwwTwwTwTwwww.............~~",
    "T................TwwwwTwwTwTwwwwTwwwTTwww.............~~",
    "T................wTwwwwTwwwTDwwwwTwwwwTww.............~~",
    "T.HHHHHHHHH......wTTwwwwTwwwwTwwwwTwwwwTT.,,,,,,,,,,,,==",
    "T................wwwTwwwwTwwwwTTwwwTwwwwT.,,,,,,,,,,,,==",
    "T................wwwwTTwwwTwwwwTwTwwTwwww.,,..........~~",
    "T................TwwwwTwTwwTwwwwTwwTwTwww.,,..........~~",
    "T................wTwwwwTwwTwTwwwwTwwDTTww.,,..BBBB....~~",
    "T................HHHHHHwTwwwTTwwwwTwwwwTw.,,..........~~",
    "T..FFFFF,,FFFFF...........................,,..........~~",
    "T..F,,,,,,,,,,F...........................,,..........~~",
    "T..F,D,,,,,,,,F.....B............BBBB.....,,TwwwwTw...~~",
    "T..F,,,,,,,,,,F.....B.....................,,wTwwwwT...~~",
    "T..F,,,,,,,,,,F.....B.....................,,wTTwwww...~~",
    "T..F,,,,,,,,,,,,,,,.....D.................,,wwwTwww...~~",
    "T..F,,,S,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,wwwwDTw...~~",
    "T..F,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,TwwwwTw...~~",
    "T..F,,,,,,,,,,,,,,,.......................,,wTwwwwT...~~",
    "T..F,,,,,,,,,,F...........BBBB............,,TwTwwww...~~",
    "T..F,,,,,,,,,,F.......................B...,,wwTTwww...~~",
    "T..F,D,,,,,,,,F.......................B...,,wwwwTww...~~",
    "T..F,,,,,,,,,,F...............B.......B...,,..........~~",
    "T..FFFFF,,FFFFF...............B...........,,..........~~",
    "T..............TwHHHHHHwTTwwwwTwwwwTwww...,,..........~~",
    "T..............TTwwwwTwwwwTwwwwTwwwwDTw...,,..BBBB....~~",
    "T..............wwTwwwwTwwwwTTwwwTwwwwTw...,,..........~~",
    "T..............wwwTTwwwTwwwwTwTwwTwwwwT...,,..........~~",
    "T..............wwwwTwTwwTwwwwTwwTwTwwww...,,,,,,,,,,,,==",
    "T.HHHHHHHHH....TwwwwTwwTwTwwwwTwwwTTwww...,,,,,,,,,,,,==",
    "T..............wTwwwwTwwwTDwwwwTwwwwTww...............~~",
    "T..............wTTwwwwTwwwwTwwwwTwwwwTT...............~~",
    "T..............wwwTwwwwTwwwwTTwwwTwwwwT...............~~",
    "T..............wwwwTTwwwTwwwwTwTwwTwwww...............~~",
    "T.........D....TwwwwTwTwwTwwwwTwwTwTwww...............~~",
    "T..............wTwwwwTwwTwTwwwwTwwwTTww...............~~",
    "T..............TwTwwwwTwwwTTwwwwTwwwwTw...............~~",
    "T.....................................................~~",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
]
COLS, ROWS = 2 * len(LEFT[0]), len(LEFT)
SOLID = "TBHF"          # stops kids, and blocks sight
TALL = "TF"             # stops a snowball at any height (banks and hedges stop only a low one)
WATER = "~"             # stops kids only


def field_grid():
    """The whole park, a row of letters a row: Red's half, then Blue's (the same, mirrored)."""
    return [row + row[::-1] for row in LEFT]


GRID = field_grid()


def letter_at(x, y):
    """The letter under (x, y) in the room; the edge of the park counts as pines."""
    c, r = int(x // TILE), int(y // TILE)
    if 0 <= c < COLS and 0 <= r < ROWS:
        return GRID[r][c]
    return "T"


def tile_middle(c, r):
    return c * TILE + TILE / 2, r * TILE + TILE / 2


def places(letter):
    """Every tile with that letter, as (column, row), across then down."""
    return [(c, r) for r in range(ROWS) for c in range(COLS) if GRID[r][c] == letter]


def in_woods(x, y):
    return letter_at(x, y) in "wT"


def stand_of(team):
    """Where a team's flag stands: Red's on the left, Blue's on the right."""
    spots = sorted(places("S"))
    return tile_middle(*spots[0 if team == "red" else -1])


def spawn_spot(team, k):
    """Where the k-th kid of a team starts, and comes back after a hit: round their stand, inside the fort."""
    sx, sy = stand_of(team)
    side = 1 if team == "red" else -1
    spots = [(1, -1), (1, 1), (2, -2), (2, 2), (3, 0), (1, -3), (1, 3), (3, -2)]
    dx, dy = spots[k % len(spots)]
    return sx + side * dx * TILE, sy + dy * TILE


# ---- the park's things (with the teacher's pictures: build.py places them)
# A snowman, a sled, a bench… on open snow, never by a path or a wood, and not in the
# middle band where the forts' gates face each other. They're solid at their feet, so
# each stands on a tile with open snow all round it (nothing to block a way through).
PROP_KINDS = ["snowman", "sled", "bench", "lamp", "oak", "berries"]


def prop_spots():
    """(column, row, kind) for every prop: picked on Red's half, mirrored on Blue's."""
    out = []
    half = COLS // 2
    k = 0
    for r in range(3, ROWS - 3, 4):
        if 17 <= r <= 26:
            continue
        for c in range(4, half - 4, 6):
            if all(GRID[r + dr][c + dc] == "." for dr in (-2, -1, 0, 1, 2) for dc in (-2, -1, 0, 1, 2)):
                kind = PROP_KINDS[k % len(PROP_KINDS)]
                out += [(c, r, kind), (COLS - 1 - c, r, kind)]
                k += 1
    return out


def prop_at(x, y):
    """The kind of prop standing on the tile at (x, y), or None."""
    c, r = int(x // TILE), int(y // TILE)
    return next((kind for pc, pr, kind in prop_spots() if pc == c and pr == r), None)
