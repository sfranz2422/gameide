# script: play
# What the Director does: d is the Director.

def place_tubes(d, glide):
    """Puts every tube where it belongs: they spread out again when one is added."""
    for t, (x, y) in zip(d.tubes, spots(len(d.tubes))):
        t.home_x, t.home_y = x, y
        if glide:
            tween(t, "x", x, 20)
            tween(t, "y", y, 20)
        else:
            t.x, t.y = x, y


def put_down(d):
    if d.picked:
        d.picked.picked = False
        tween(d.picked, "y", d.picked.home_y, 8)
        d.picked = None


def tap(tube):
    """A tap on a tube: pick it up, put it down, or pour into it."""
    d = global_vars.director
    if d.won or tube.busy:
        return
    if d.picked is None:
        if tube.sand and not tube_done(tube.sand):
            d.picked = tube
            tube.picked = True
            tween(tube, "y", tube.home_y - LIFT, 8)
            sound_play("pick", volume=0.5)
    elif d.picked is tube:
        put_down(d)
    elif can_pour(d.picked.sand, tube.sand):
        src = d.picked
        d.picked = None
        src.picked = False
        pour_from(d, src, tube)
    else:
        tube.shake = 16
        sound_play("nope", volume=0.5)
        put_down(d)


def pour_from(d, src, dst):
    """The pour itself: the sand moves now; a Pour shows it moving."""
    d.history.append([(list(t.sand), t.hidden) for t in d.tubes])
    colour = src.sand[-1]
    k = pour(src.sand, dst.sand)
    d.pours += 1
    # The top of a tube is never covered: pouring off it shows what's under.
    src.hidden = min(src.hidden, max(0, len(src.sand) - 1))
    tween_stop(src)
    p = instance_create(0, 0, "Pour")
    p.src, p.dst, p.k, p.colour = src, dst, k, colour
    p.from_x, p.from_y = src.x, src.y
    p.to_x, p.to_y, p.tilt = pour_place(src, dst)
    src.busy = dst.busy = True
    src.drain, src.drain_colour = k, colour
    dst.pending = k
    src.depth = -10


def undo(d):
    if not d.history or d.won or instance_exists("Pour"):
        return
    put_down(d)
    for t, (sand, hidden) in zip(d.tubes, d.history.pop()):
        t.sand = sand
        # What's been seen stays seen: a layer uncovered stays uncovered.
        t.hidden = min(t.hidden, hidden, max(0, len(sand) - 1))
    sound_play("click", volume=0.5)


def add_tube(d):
    if d.extra or d.won:
        return
    d.extra = True
    t = instance_create(VIEW_W / 2, VIEW_H + 100, "Tube")
    d.tubes.append(t)
    place_tubes(d, True)
    sound_play("pick", volume=0.6)


def stuck(d):
    return not useful_pours(d.tubes) and not all_done(d.tubes)


def finish(d):
    d.won = True
    d.stars = stars_for(d.pours, d.par, d.extra)
    n = d.level
    if d.stars > save_get(f"stars_{n}", 0):
        save_set(f"stars_{n}", d.stars)
    points = points_for(d.par, d.stars)
    if points > save_get(f"points_{n}", 0):
        save_set(f"points_{n}", points)
    # The school's board is every level's best added up: more levels, and better.
    high_score(sum(save_get(f"points_{i}", 0) for i in range(len(LEVELS))))
    effect("confetti", VIEW_W / 2, 160, None, 1.5)
    sound_play("win", volume=0.8)
    buttons = [("Levels", "levels")]
    if n + 1 < len(LEVELS):
        buttons.append(("Next level", "next"))
    buttons.append(("Play again", "again"))
    for k, (words, does) in enumerate(buttons):
        b = instance_create(VIEW_W / 2 - (len(buttons) * 165 - 15) / 2 + k * 165, 350, "GoButton")
        b.words, b.does = words, does
