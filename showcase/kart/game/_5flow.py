# script: flow
# The bits between: starting a race, the camera, sounds, and what's saved.
import math

ENGINE_SOUNDS = ["engine_0", "engine_1", "engine_2", "engine_3"]   # idle, then low to high


MODES = ["Cup", "Time trial"]
PATH_EVERY = 4         # a time trial notes where you are this often, for your ghost


def menu_rows(game):
    """The menu's rows: a cup asks which cup, a time trial which track."""
    return ["mode", "racer", "track", "go"] if MODES[game.mode_i] == "Time trial" else ["mode", "cup", "racer", "go"]


def cup_key(c):
    """Where a cup's best place is saved. The first cup's name is from before there were three,
    so a player who won it then still has it won."""
    return "cup_best" if c == 0 else f"cup_best_{c}"


def cup_won(c):
    return save_get(cup_key(c)) == 1


def cup_open(c):
    """A cup with "after" opens once each of those cups has been won."""
    return all(cup_won(w) for w in CUPS[c].get("after", []))


def open_tracks():
    """The tracks a time trial offers: every track of every open cup."""
    return [t for c in range(len(CUPS)) if cup_open(c) for t in CUPS[c]["tracks"]]


def next_track(track_i, side):
    """The open track before or after this one, for the menu's arrows."""
    tracks = open_tracks()
    at = tracks.index(track_i) if track_i in tracks else 0
    return tracks[(at + side) % len(tracks)]


def new_race(track_i, player=None, rivals=True):
    camera = RACE.get("camera")
    start_race(track_i, player, rivals)
    RACE["camera"] = camera
    move_camera(RACE["karts"][0], snap=True)
    if player is not None and not rivals:
        # A time trial: three turbos, and the ghost of your best run if there is one.
        RACE["karts"][0].turbos = 3
        path = save_get("ghost_" + RACE["track"]["name"])
        if path:
            instance_create(path[0][0], path[0][1], "Ghost").path = path


def cup_table(game):
    """The racers, most points first."""
    return sorted(range(len(RACERS)), key=lambda w: -game.cup_points[w])


def finish_race(game):
    """The player crossed the line: fix the order, pay the points, and keep a best time and its ghost."""
    you = RACE["karts"][0]
    order = sorted(RACE["karts"], key=lambda c: c.place)
    RACE["final"] = order
    name = RACE["track"]["name"]
    if RACE["rivals"]:
        for p, kart in enumerate(order):
            game.cup_points[kart.who] += POINTS[p]
        game.cup_race += 1
        game.new_best = keep_best(name, you.done)
    else:
        game.new_best = keep_best(name, you.done)
        if game.new_best:
            save_set("ghost_" + name, RACE["path"])
    game.best = save_get("best_" + name)


def cup_tracks(game):
    return CUPS[game.cup_i]["tracks"]


def end_cup(game):
    """A cup's end: its best place kept between visits. Winning one can open another."""
    place = cup_table(game).index(game.racer) + 1
    best = save_get(cup_key(game.cup_i))
    if best is None or place < best:
        save_set(cup_key(game.cup_i), place)


def move_camera(kart, snap=False):
    cam = RACE["camera"]
    d = angle_diff(kart.a, cam["a"])
    cam["a"] = (kart.a if snap else cam["a"] + d * 0.11) % 360
    r = math.radians(cam["a"])
    cam["x"], cam["y"] = kart.x - math.cos(r) * CAM_BACK, kart.y + math.sin(r) * CAM_BACK


def kart_sound(kart, what):
    """Only the player's kart is heard: seven more drifting at once is a noise."""
    if kart.player:
        sound_play(what, volume=0.7)


def engine_sound(game, kart, on):
    """One engine loop at a time: higher the faster the kart goes."""
    want = ENGINE_SOUNDS[min(3, int(abs(kart.v) / STATS["top"] * 3.5))] if on else None
    if want != game.engine:
        if game.engine:
            sound_stop(game.engine)
        if want:
            sound_play(want, loop=True, volume=0.3)
        game.engine = want


def keep_best(track, steps):
    """The best time on a track, kept between visits. Answers whether this one beat it."""
    best = save_get("best_" + track)
    if best is None or steps < best:
        save_set("best_" + track, steps)
        # The school's board: the first cup's four best times added up, once there are four.
        # Only the first cup's, so the board means what it meant before there were three.
        times = [save_get("best_" + TRACKS[t]["name"]) for t in CUPS[0]["tracks"]]
        if None not in times:
            high_score(sum(times) / 60)
        return True
    return False
