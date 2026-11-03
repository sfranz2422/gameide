# script: rules
# What the objects share: prices, money, who gets shot, and being hit.
import math

# What each tower costs, by object. Its other numbers are in its own Create event.
PRICES = {"Gunner": 60, "Cannon": 130, "Rocket": 160, "Freezer": 90}
SELL_BACK = 0.7        # selling pays back this much of what went into it
WAVE_BONUS = 50        # gold for clearing a wave
EARLY_BONUS = 15       # more for calling the next one before this one is cleared
MAX_LEVEL = 3
FIELD_H = 8 * 64
BUILD_RANGE = {"Gunner": 140, "Cannon": 170, "Rocket": 230, "Freezer": 130}   # for the circle shown while placing


def upgrade_price(tower):
    return tower.cost * tower.level


def sell_price(tower):
    return int(tower.spent * SELL_BACK)


def can_hit(shot_or_tower, enemy):
    """Only some weapons reach something in the air."""
    return shot_or_tower.air or not enemy.flying


def best_target(tower):
    """The enemy in range that has got furthest: the one about to do harm."""
    best = None
    for e in instances("Enemy"):
        if can_hit(tower, e) and point_distance(tower.x, tower.y, e.x, e.y) <= tower.range:
            if best is None or e.travelled > best.travelled:
                best = e
    return best


def hurt(enemy, amount):
    """Takes off its hit points. At none it's gone, and pays its bounty."""
    enemy.hp -= amount
    enemy.flash("white", 3)
    if enemy.hp <= 0 and enemy._alive:
        global_vars.gold += enemy.bounty
        effect("explosion", enemy.x, enemy.y, scale=0.5 if enemy.bounty < 25 else 1.1)
        sound_play("boom", volume=0.35 if enemy.bounty < 25 else 0.8)
        enemy.destroy()


def blast(x, y, radius, amount, air):
    """Everything within reach of an explosion, a little less at the edge."""
    effect("explosion", x, y, scale=radius / 60)
    for e in instances("Enemy"):
        d = point_distance(x, y, e.x, e.y)
        if d <= radius and (air or not e.flying):
            hurt(e, amount * (1 - 0.4 * d / radius))


def aim_shot(shot, target, damage):
    """Sets a new shot off at its target."""
    shot.target = target
    shot.damage = damage
    shot.direction = point_direction(shot.x, shot.y, target.x, target.y)
    shot.speed = shot.fly
    shot.to_x, shot.to_y = target.x, target.y


def land(shot, enemy):
    """A shot has hit: a burst, or just what it touched, and maybe a freeze."""
    if shot.reach:
        blast(shot.x, shot.y, shot.reach, shot.damage, shot.air)
    else:
        hurt(enemy, shot.damage)
    if shot.freeze:
        enemy.slow = shot.freeze
    shot.destroy()


def wave_busy():
    """Is there anything still coming?"""
    return bool(instances("Gate")[0].queue) or instance_number("Enemy") > 0


def send_wave(director):
    """The next wave sets off. Sent before the last one is cleared, it pays extra."""
    level = LEVELS[director.level]
    if global_vars.wave >= len(level["waves"]):
        return
    if wave_busy():
        global_vars.gold += EARLY_BONUS
    groups = level["waves"][global_vars.wave]
    global_vars.wave += 1
    gate = instances("Gate")[0]
    gate.queue.extend([list(g) for g in groups])
    sound_play("wave", volume=0.7)


def finish_level(director, won):
    """How it ended: a result kept, and buttons to go on with."""
    level = LEVELS[director.level]
    global_vars.mode = "won" if won else "lost"
    global_vars.buying = global_vars.selected = None
    if won:
        director.stars = stars_for(global_vars.lives, level["lives"])
        key = f"stars_{director.level}"
        if director.stars > save_get(key, 0):
            save_set(key, director.stars)
        sound_play("win", volume=0.8)
        effect("confetti", 512, 200)
    else:
        for e in instances("Enemy"):
            e.speed = 0
            e.destroy()
        instances("Gate")[0].queue.clear()
        sound_play("lose", volume=0.8)
    buttons = [("Title", False, "Levels", "")]
    if won and director.level + 1 < len(LEVELS):
        buttons.append((LEVELS[director.level + 1]["name"], False, "Next level", ""))
    else:
        buttons.append(("", True, "Try again", ""))
    for k, (to, again, words, small) in enumerate(buttons):
        b = instance_create(286 + k * 260, 320, "GoButton")
        b.to, b.again, b.words, b.small = to, again, words, small


def can_build(x, y):
    """A tower goes on an empty cell of the field, off the road."""
    c, r = int(x // CELL), int(y // CELL)
    if not (0 <= c < COLS and 0 <= r < ROWS):
        return False
    mx, my = cell_middle(c, r)
    if tile_at(mx, my, "Road") is not None:
        return False
    return not (collision_point(mx, my, "Tower") or collision_point(mx, my, "Decor") or
                collision_point(mx, my, "Gate") or collision_point(mx, my, "Fort"))


def build(name, x, y):
    """Buys a tower for that cell. Answers it, or None if it can't be done."""
    price = PRICES[name]
    if global_vars.gold < price or not can_build(x, y):
        return None
    global_vars.gold -= price
    mx, my = cell_middle(int(x // CELL), int(y // CELL))
    tower = instance_create(mx, my, name)
    tower.spent = price
    global_vars.selected = None
    sound_play("build", volume=0.6)
    return tower


def stars_for(lives, start):
    """How well a level went: every life kept or nearly, three."""
    return 3 if lives >= start * 0.9 else 2 if lives >= start * 0.5 else 1
