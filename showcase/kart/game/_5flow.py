# script: flow
# The bits between: the engine's sound and what's saved.

ENGINE_SOUNDS = ["engine_0", "engine_1", "engine_2", "engine_3"]   # idle, then low to high


def engine_sound(game, kart, on):
    """One engine loop at a time: higher the faster the kart goes."""
    if not on:
        want = None
    else:
        want = ENGINE_SOUNDS[min(3, int(abs(kart.v) / STATS["top"] * 3.5))]
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
