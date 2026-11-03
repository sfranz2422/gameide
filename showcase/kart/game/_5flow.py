# script: flow
# The bits between: starting a race, the camera, sounds, and what's saved.
import math

ENGINE_SOUNDS = ["engine_0", "engine_1", "engine_2", "engine_3"]   # idle, then low to high


def new_race(game, player):
    camera = RACE.get("camera")
    start_race(0, player)
    RACE["camera"] = camera
    move_camera(RACE["karts"][0], snap=True)


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
