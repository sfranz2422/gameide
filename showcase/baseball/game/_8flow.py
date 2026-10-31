# script: flow
# The Game's steps from pitch to pitch: the pitcher getting ready, the
# windup, the pitch and the swing, the ball in play, what the umpire says,
# and on to the next. Each takes the Game instance as `game`. Who is a
# person and who is the computer is in MATCH (kept in controls).

AB = {}               # the pitch now: what's thrown, the swing, the hit and the play
HIT_VIEW_STEPS = 12   # steps a hit is followed from behind the plate before the map
TARGET_MOVE = 0.05    # feet the pitcher's target moves a step while a direction is held


def go_title(game):
    game.mode, game.menu, game.idle, game.since = "title", 0, 0, game.t
    MATCH.clear()
    MATCH.update(two=False, kind=None, humans={}, demo=False, aim=2.5)
    AB.clear()
    touch_controls(True, ("z",))


def start(game, kind, humans, two=False, demo=False):
    """A Home Run Derby (kind "derby") or a game ("game"). `humans` says
    which controller plays each team: {"away": 0, "home": None} is one
    player, the Bluebirds, against the computer's Rattlers."""
    MATCH.clear()
    MATCH.update(kind=kind, humans=humans, two=two, demo=demo, aim=2.5)
    touch_controls(not two and not demo, ("z", "x"))
    if kind == "derby":
        new_derby()
    else:
        new_game()
    new_pitch(game)


def derby():
    return MATCH.get("kind") == "derby"


def batting_team():
    return "away" if derby() else batting()


def pitching_team():
    return "home" if derby() else fielding()


def batter_is():
    """The controller of whoever's batting, or None for the computer."""
    return 0 if derby() else MATCH["humans"].get(batting())


def pitcher_is():
    return None if derby() else MATCH["humans"].get(fielding())


def new_pitch(game):
    AB.clear()
    AB.update(kind=0, target=(0.0, 2.5), pitch=None, t=0, swing=None, aim=None, plan=None,
              hit=None, flight=None, play=None, k=0, words="", runners=[], swung_at=None)
    if pitcher_is() is None:
        AB["kind"], AB["target"] = derby_pitch() if derby() else cpu_pitch()
    game.mode, game.since = "ready", game.t


def aim_bat():
    """A person batting moves the swing up and down, until he swings."""
    c = batter_is()
    if c is None or AB.get("swing") is not None:
        return
    up_down = stick(c)[1]
    MATCH["aim"] = clamp(MATCH["aim"] - up_down * BAT_MOVE, BAT_LOW, BAT_HIGH)


def ready_step(game):
    aim_bat()
    c = pitcher_is()
    waited = game.t - game.since
    if c is None:
        if waited > (30 if derby() else 45):
            game.mode, game.since = "windup", game.t
        return
    across, down = stick(c)
    x, z = AB["target"]
    AB["target"] = (clamp(x + across * TARGET_MOVE, -2, 2), clamp(z - down * TARGET_MOVE, 0.6, 4.4))
    if button_pressed(c, 1):
        AB["kind"] = (AB["kind"] + 1) % len(PITCHES)
        sound_play("click", volume=0.5)
    if button_pressed(c, 0) and waited > 10:
        game.mode, game.since = "windup", game.t


def windup_step(game):
    aim_bat()
    if game.t - game.since >= WINDUP_STEPS:
        AB["pitch"] = throw(AB["kind"], AB["target"])
        AB["t"] = 0
        if batter_is() is None:
            AB["plan"] = cpu_batter(AB["pitch"])
        game.mode, game.since = "pitch", game.t
        sound_play("whoosh", volume=0.5)


def pitch_step(game):
    """The ball on its way. The bat meets it SWING_STEPS after Swing is
    pressed: contact() says if that's a hit. Once it's past the batter,
    it's a ball or a strike."""
    p = AB["pitch"]
    AB["t"] += 1
    t = AB["t"]
    c = batter_is()
    aim_bat()
    if AB["swing"] is None:
        if c is not None and button_pressed(c, 0):
            AB["swing"], AB["aim"] = t, MATCH["aim"]
        elif c is None and AB["plan"]["swing"] and t >= AB["plan"]["press"]:
            AB["swing"], AB["aim"] = t, AB["plan"]["aim"]
        if AB["swing"] is not None:
            AB["swung_at"] = game.t
            sound_play("swish", volume=0.5)
    if AB["swing"] is not None and t == AB["swing"] + SWING_STEPS:
        hit = contact(p["x"], p["z"], AB["aim"], t - p["steps"])
        if hit is not None:
            AB["hit"] = hit
            AB["flight"] = fly(hit)
            AB["play"] = judge(hit, AB["flight"])
            AB["runners"] = runners_for(AB["play"])
            AB["k"] = 0
            sound_play("crack", volume=0.9)
            if hit["mph"] > 100:
                hit_pause(4)
            game.mode, game.since = "hit", game.t
            return
    if t > p["steps"] + TIMING_WINDOW:
        sound_play("mitt", volume=0.6)
        settle(game)


def runners_for(play):
    """Who runs where while the ball's in play, for the map: (from base, to
    base) for the batter (from 0, home) and each runner on. Base 4 is home."""
    on = [] if derby() else [b + 1 for b in range(3) if GAME["bases"][b]]
    if play["result"] == "foul":
        return []
    if play["result"] in ("homer", "hit"):
        n = play["bases"]
        return [(0, n)] + [(b, min(4, b + n)) for b in on]
    if play["words"].startswith("Ground") and GAME["outs"] < 2:
        return [(0, 1)] + [(b, min(4, b + 1)) for b in on]
    return [(0, 1)] + [(b, b) for b in on]


def hit_step(game):
    """The ball leaving the bat, seen from behind the plate; then the map."""
    AB["k"] += 1
    if AB["k"] >= HIT_VIEW_STEPS or AB["k"] >= len(AB["flight"]["path"]) - 1:
        if AB["play"]["result"] == "foul":
            settle(game)
        else:
            game.mode, game.since = "field", game.t


def field_step(game):
    """The play on the map, until the ball is caught, fielded or gone, and a moment more."""
    AB["k"] += 1
    play = AB["play"]
    if AB["k"] == play["step"] and play["result"] == "homer":
        homer_fireworks()
    if AB["k"] >= min(len(AB["flight"]["path"]) - 1, play["step"]) + 40:
        settle(game)


def homer_fireworks():
    x, y, z = AB["flight"]["path"][-1]
    mx, my = to_map(x, y)
    effect("confetti", clamp(mx, 40, VIEW_W - 40), clamp(my, 40, 200), scale=2)
    screen_flash("white", 6)
    camera_shake(4, 20)
    sound_play("cheer", volume=0.8)


def settle(game):
    """The pitch is over: count it, by the Derby's rules or a game's."""
    swung = AB["swing"] is not None
    if derby():
        AB["words"] = derby_swing(AB["play"]) if swung else "Taken.  No out."
    else:
        AB["words"] = call_pitch(AB["pitch"], swung, AB["play"])
    if AB["play"] and AB["play"]["result"] == "homer" and game.mode == "hit":
        homer_fireworks()
    game.mode, game.since = "result", game.t


def result_step(game):
    waited = game.t - game.since
    people = [c for c in (batter_is(), pitcher_is()) if c is not None]
    if waited > 80 or (waited > 20 and any(button_pressed(c, 0) for c in people)):
        if derby():
            if derby_over():
                derby_save()
                game.mode, game.since = "final", game.t
                sound_play("cheer", volume=0.6)
            else:
                new_pitch(game)
            return
        if GAME["half_over"] and not GAME["over"]:
            end_half()
            if not GAME["over"]:
                game.mode, game.since = "half", game.t
                return
        if GAME["over"]:
            game.mode, game.since = "final", game.t
            sound_play("cheer", volume=0.6)
            return
        new_pitch(game)


def half_step(game):
    waited = game.t - game.since
    people = [c for c in MATCH["humans"].values() if c is not None]
    if waited > 150 or (waited > 30 and any(button_pressed(c, 0) for c in people)):
        new_pitch(game)
