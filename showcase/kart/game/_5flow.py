# script: flow
# The bits between: starting a race, the camera, sounds, and what's saved.
import math

ENGINE_SOUNDS = ["engine_0", "engine_1", "engine_2", "engine_3"]   # idle, then low to high


MODES = ["Cup", "Time trial"]
PATH_EVERY = 4         # a time trial notes where you are this often, for your ghost


def menu_rows(game):
    """The menu's rows: only a time trial asks which track."""
    return ["mode", "racer", "track", "go"] if MODES[game.mode_i] == "Time trial" else ["mode", "racer", "go"]


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


def end_cup(game):
    """A cup's end: the best place kept between visits."""
    place = cup_table(game).index(game.racer) + 1
    best = save_get("cup_best")
    if best is None or place < best:
        save_set("cup_best", place)


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
        return True
    return False
