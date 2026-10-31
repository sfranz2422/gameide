# script: flow
# The bits between: the camera, the engine's sound, ending a run, and the
# title's driver.
import math

ENGINE_SOUNDS = ["engine_0", "engine_1", "engine_2", "engine_3"]   # idle, then low to high


def follow_car(game, car):
    """The camera, a little ahead of the car the faster it goes, catching up smoothly."""
    tx = car.x - 220 + clamp(car.vx * 18, -80, 140)
    ty = car.y - 210 + clamp(car.vy * 6, -40, 60)
    game.cam_x += (tx - game.cam_x) * 0.12
    game.cam_y += (ty - game.cam_y) * 0.12
    camera_set(game.cam_x, game.cam_y)


def engine_sound(game, car, gas):
    """One engine loop at a time: higher the faster the car goes. Racing, it's
    never quiet: it idles when you're off the gas."""
    if not gas and car.fuel <= 0 or RUN["end"]:
        want = None
    elif not gas:
        want = ENGINE_SOUNDS[0]
    else:
        k = abs(car.speed()) / car.stats["top"]
        want = ENGINE_SOUNDS[1 + min(2, int(k * 3))]
    if want != game.engine:
        if game.engine:
            sound_stop(game.engine)
        if want:
            sound_play(want, loop=True, volume=0.35)
        game.engine = want


def finish_run(game):
    """The run is over: the coins go in your wallet, and a best distance is kept with its ghost."""
    engine_sound(game, RUN["car"], False)
    far = RUN["furthest"]
    add_coins(RUN["got"])
    RUN["new_best"] = keep_best(RUN["stage"]["name"], far)
    game.mode, game.since = "over", game.t
    if RUN["new_best"]:
        sound_play("best")


def autopilot(car, road):
    """The title's driver: gas, easing off when the nose is too high, and
    keeping the car level in the air."""
    ahead = math.atan2(ground_y(road, car.x + 30) - ground_y(road, car.x - 30), 60)
    if car.air > 3:
        d = car.a - ahead + car.w * 12
        return d > 0.05, d < -0.05
    lean = car.a - ahead
    return lean > -0.5, lean < -0.8
