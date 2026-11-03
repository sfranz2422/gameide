# script: rules
# What the objects share: how hard a bump is, what breaks, bangs, and aiming.
import math

BUMP_MIN = 2.2        # things meeting slower than this just touch
MAX_PULL = 110        # how far back the sling stretches, in pixels
MIN_PULL = 14         # less than this and it wasn't a shot
POWER = 0.175         # speed of the shot for each pixel of pull
DOTS = 34             # how many steps ahead the dotted line shows
GRAVITY = 0.3         # physics' own pull, physics_gravity(0, 0.3)
STRAY = 40            # how far past the side of the screen something is gone
QUIET = 0.25          # slower than this counts as stopped
JAR_POINTS, SHOT_POINTS = 500, 1000


def made_of(block, weight, tough, dust, points, crack):
    """A Block's material. weight is per 35-pixel square, so bigger is heavier."""
    w, h = size_of(block.object_name)
    block.weight = weight * w * h / (35 * 35)
    block.tough = tough
    block.dust = dust
    block.points = points
    block.crack = crack


def bump(thing, other):
    """
    How hard two things met: how fast they were coming together the step before
    they touched. A bump shared with something heavy does the light one more
    harm, and the ground is the heaviest thing there is.
    """
    closing = point_distance(thing.was_h, thing.was_v, other.was_h, other.was_v)
    if closing >= BUMP_MIN:
        share = other.weight / (thing.weight + other.weight)
        hurt(thing, (closing - BUMP_MIN) * share / thing.tough, other)


def hurt(thing, amount, by=None):
    """Takes amount off its strength (it starts at 1). At none it breaks."""
    if not thing._alive or amount <= 0:
        return
    thing.hp -= amount
    thing.image_index = 0 if thing.hp > 0.66 else 1 if thing.hp > 0.33 else 2
    thing.flash("white", 3)
    if thing.hp <= 0:
        thing.destroy()
        # Something heavy keeps going through what it broke: planck has
        # already stopped it, so its speed from before the bump goes back on.
        if by is not None and by.pierce > 0:
            by.hspeed, by.vspeed = by.was_h * by.pierce, by.was_v * by.pierce


def blast(x, y, radius, power):
    """A bang: everything near is thrown away from it, and hurt the closer it is."""
    effect("explosion", x, y, None, radius / 60)
    camera_shake(power * 0.6, 18)
    hit_pause(3)
    sound_play("bang", volume=0.8)
    for t in instances("Block"):
        away = point_distance(x, y, t.x, t.y)
        if away < radius:
            near = 1 - away / radius
            d = max(away, 1)
            t.push((t.x - x) / d * power * near * t.weight, (t.y - y) / d * power * near * t.weight - near * t.weight)
            hurt(t, power * near / t.tough)


def clear_strays():
    """
    Past either side of the screen is gone for good, and a jar that gets there has
    escaped. Not an Outside Room event: that fires over the top as well, and a shot
    lobbed high is coming back down.
    """
    for t in instances("Block") + instances("Shot"):
        if t.x < -STRAY or t.x > VIEW_W + STRAY:
            t.destroy()


def pull_of(dx, dy):
    """How far a drag really stretches the sling. Only so far, and only backwards from where you pressed."""
    far = math.hypot(dx, dy)
    if far > MAX_PULL:
        return dx * MAX_PULL / far, dy * MAX_PULL / far
    return dx, dy


def shot_start(pull_x, pull_y):
    """
    Where a pulled shot sits. Never in the ground: it would leave with a bump
    already on it, and a bomb's fuse would start on the sling.
    """
    return SLING_X + pull_x, min(SLING_Y + pull_y, GROUND_Y - 24)


def flight_path(x, y, h, v, steps=DOTS):
    """Where a shot will be each step until it hits something. Physics moves it just like this."""
    out = []
    for _ in range(steps):
        v += GRAVITY
        x += h
        y += v
        out.append((x, y))
    return out


def launch(shot, h, v):
    """Lets go of a shot: from now on physics moves it."""
    shot.physics = True
    shot.hspeed, shot.vspeed = h, v
    shot.flying = True
    sound_play("twang", volume=0.7)


def stars_for(used, par):
    """Three at par or better, one less for each shot over, and always one for winning."""
    return 3 if used <= par else 2 if used == par + 1 else 1


def level_of_room():
    return next(i for i, l in enumerate(LEVELS) if l["name"] == room_name())


def load_shot(director):
    """The next shot onto the sling."""
    name = director.left.pop(0)
    global_vars.shot = instance_create(SLING_X, SLING_Y, name)
    global_vars.mode = "aim"
    director.wait = director.calm = 0
    sound_play("load", volume=0.4)


def shot_fired(director):
    director.used += 1
    global_vars.shot = None
    global_vars.mode = "flying"


def finish_level(director, won):
    """How it ended: a result kept, and buttons to go on with."""
    global_vars.mode = "won" if won else "lost"
    level = LEVELS[director.level]
    buttons = [("Title", False, "Levels")]
    if won:
        global_vars.score += len(director.left) * SHOT_POINTS
        director.stars = stars_for(director.used, level["par"])
        key = f"stars_{director.level}"
        if director.stars > save_get(key, 0):
            save_set(key, director.stars)
        # The school's board shows your best of every level added up, so playing
        # more levels and playing them better both count.
        if global_vars.score > save_get(f"score_{director.level}", 0):
            save_set(f"score_{director.level}", global_vars.score)
        high_score(sum(save_get(f"score_{i}", 0) for i in range(len(LEVELS))))
        effect("confetti", VIEW_W / 2, 200)
        sound_play("win", volume=0.8)
        if director.level + 1 < len(LEVELS):
            buttons.append((LEVELS[director.level + 1]["name"], False, "Next level"))
        else:
            buttons.append(("", True, "Play again"))
    else:
        sound_play("lose", volume=0.8)
        buttons.append(("", True, "Try again"))
    for k, (to, again, words) in enumerate(buttons):
        b = instance_create(VIEW_W / 2 - 150 + k * 170, 320, "GoButton")
        b.to, b.again, b.words = to, again, words
