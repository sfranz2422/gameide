# script: helpers
# Small functions every object uses. Objects can't share methods in
# GameIDE, but they can all call the functions in a script.

import math
import random


def approach(value, target, step):
    """Moves value towards target by at most step: smooth speeding up and slowing down."""
    if value < target:
        return min(value + step, target)
    return max(value - step, target)


def sign(v):
    return (v > 0) - (v < 0)


def set_anim(inst, sprite, speed=1):
    """Changes an instance's animation, from its first frame — but only if it is a new one."""
    if inst.sprite != sprite:
        inst.sprite = sprite
        inst.image_index = 0
    inst.image_speed = speed


def hold_last_frame(inst):
    """For animations that should stop at the end (a jump, a fall, dying), not loop."""
    n = FRAMES.get(inst.sprite)
    if n and inst.image_index >= n - 1:
        inst.image_index = n - 1
        inst.image_speed = 0


# ---------------------------------------------------------------- input
# Keyboard (two ways round) or a gamepad, so whoever plays can use what they like.

def input_x():
    right = keyboard_check("right") or keyboard_check("d") or gamepad_check("right") or gamepad_axis("left_x") > 0.4
    left = keyboard_check("left") or keyboard_check("a") or gamepad_check("left") or gamepad_axis("left_x") < -0.4
    return right - left


def input_down():
    return keyboard_check("down") or keyboard_check("s") or gamepad_check("down") or gamepad_axis("left_y") > 0.5


def jump_pressed():
    return (keyboard_check_pressed("space") or keyboard_check_pressed("z") or keyboard_check_pressed("up")
            or keyboard_check_pressed("w") or gamepad_check_pressed("a"))


def jump_held():
    return (keyboard_check("space") or keyboard_check("z") or keyboard_check("up")
            or keyboard_check("w") or gamepad_check("a"))


def attack_pressed():
    return (keyboard_check_pressed("x") or keyboard_check_pressed("j") or keyboard_check_pressed("k")
            or gamepad_check_pressed("x") or gamepad_check_pressed("b") or mouse_check_pressed("left"))


def confirm_pressed():
    return (keyboard_check_pressed("enter") or keyboard_check_pressed("space") or keyboard_check_pressed("x")
            or gamepad_check_pressed("a") or gamepad_check_pressed("start"))


# ---------------------------------------------------------------- planks
# Planks are a tile layer that is NOT solid, so they are platforms you can
# jump up through. Things land on them by asking, as they fall, whether
# their feet are about to pass the top of a plank.

def plank_below(inst, dy, half_width=5):
    """The y of a plank top that inst's feet would reach falling by dy, or None."""
    if dy <= 0:
        return None
    top = int((inst.y + dy) // 16) * 16
    if not (inst.y <= top <= inst.y + dy):
        return None
    for x in (inst.x - half_width, inst.x + half_width):
        if tile_at(x, top + 1, "Planks") in PLANK_TILES:
            return top
    return None


def fall(inst, half_width=5, through_planks=False):
    """
    Gravity and the vertical move for anything that walks: lands on solid
    ground and on planks. Returns True when it landed this step.
    """
    inst.vy = min(inst.vy + GRAVITY, MAX_FALL)
    if not through_planks:
        top = plank_below(inst, inst.vy, half_width)
        if top is not None:
            inst.y = top
            inst.vy = 0
            return True
    if inst.move_and_collide(0, inst.vy):
        landed = inst.vy > 0
        inst.vy = 0
        return landed
    return False


def standing(inst, half_width=5):
    """On solid ground, or on a plank."""
    return not inst.place_free(inst.x, inst.y + 1) or plank_below(inst, 1, half_width) is not None


def ledge_ahead(inst, facing, reach):
    """True at a wall, or at the edge of a drop: where a walking enemy turns round."""
    ahead = inst.x + facing * reach
    if not inst.place_free(ahead, inst.y - 2):
        return True
    return inst.place_free(ahead, inst.y + 4) and tile_at(ahead, inst.y + 2, "Planks") not in PLANK_TILES


# ---------------------------------------------------------------- the hero

def player():
    """The hero, or None while there isn't one."""
    found = instances("Player")
    return found[0] if found else None


def hurt_player(amount, from_x):
    p = player()
    if p is None or p.state == "dead" or p.invincible > 0:
        return
    global_vars.hp -= amount
    sound_play("hurt")
    camera_shake(4, 12)
    hit_pause(4)
    p.flash("red", 8)
    if global_vars.hp <= 0:
        global_vars.hp = 0
        p.state = "dead"
        p.vx = 0
        set_anim(p, "hero_dead")
        music_stop()
        p.alarm[0] = 150          # then back to the last checkpoint
        return
    p.state = "hurt"
    p.hurt_steps = 18
    p.invincible = HURT_TIME
    side = sign(p.x - from_x) or -p.facing
    p.vx = side * KNOCKBACK
    p.vy = -3


# ---------------------------------------------------------------- enemies

def enemy_hit(e, damage, from_x):
    """A sword (or anything) hitting an enemy. Every enemy and boss uses this."""
    e.hp -= damage
    e.flash("white", 6)
    sound_play("hit")
    hit_pause(3)
    particles(e.x, e.y - 10, count=8, color=["#ffffff", "#ffe8a3"], speed=2.5, size=2, life=14)
    e.knock = sign(e.x - from_x) * 2.5
    if e.hp <= 0:
        enemy_die(e)


def enemy_die(e):
    effect("smoke", e.x, e.y - 8)
    effect("sparkle", e.x, e.y - 12)
    global_vars.kills += 1
    if getattr(e, "corpse", None):
        c = instance_create(e.x, e.y, "Corpse")
        c.sprite = e.corpse
        c.image_xscale = e.image_xscale
        c.image_index = 0
    # Sometimes a coin, sometimes a potion when the hero is hurt.
    roll = random.random()
    if global_vars.hp < global_vars.max_hp and roll < 0.18:
        instance_create(e.x, e.y - 4, "Potion").dropped = True
    elif roll < 0.55:
        instance_create(e.x, e.y - 4, "Coin").dropped = True
    e.destroy()


# ---------------------------------------------------------------- remembering
# Dying sends the hero back to the last checkpoint by restarting the room,
# which builds every object again. Things that should stay done — a key
# taken, a wall broken, a boss beaten — are remembered here by where they
# were placed, and put themselves away again as they are made.

def place_key(inst):
    """Where inst was placed in the room: its name in global_vars.done. (Set in its Create, before it moves.)"""
    if not hasattr(inst, "home"):
        inst.home = f"{global_vars.level}:{int(inst.x)},{int(inst.y)}"
    return inst.home


def is_done(inst):
    return place_key(inst) in global_vars.done


def mark_done(inst):
    global_vars.done.add(place_key(inst))


def boss_beaten():
    return f"boss:{global_vars.level}" in global_vars.done


def boss_defeated(boss):
    """The boss's last moment: open the arena, light the exit, and remember."""
    global_vars.done.add(f"boss:{global_vars.level}")
    global_vars.boss = None
    for g in instances("BossGate"):
        g.visible = False
        g.solid = False
    effect("confetti", boss.x, boss.y - 40, scale=2)
    sound_play("power")
    music_play(LEVELS[global_vars.level][2])
    show_message(f"{boss.name} is beaten. A door has opened.", 240)
    save_progress()


def next_level():
    global_vars.level += 1
    global_vars.checkpoint = None
    save_progress()
    if global_vars.level < len(LEVELS):
        room_goto(LEVELS[global_vars.level][0])
    else:
        room_goto("Ending")


def new_game():
    """Everything a fresh game starts with."""
    global_vars.level = 0
    global_vars.max_hp = 5
    global_vars.hp = 5
    global_vars.coins = 0
    global_vars.kills = 0
    global_vars.keys = 0
    global_vars.abilities = set()
    global_vars.done = set()
    global_vars.checkpoint = None
    global_vars.boss = None
    global_vars.message = ""
    global_vars.message_time = 0
    global_vars.deaths = 0
    global_vars.frames = 0


def show_message(text, steps=180):
    global_vars.message = text
    global_vars.message_time = steps


def save_progress():
    """What Continue on the title screen comes back to."""
    save_set("level", global_vars.level)
    save_set("max_hp", global_vars.max_hp)
    save_set("coins", global_vars.coins)
    save_set("abilities", sorted(global_vars.abilities))


# ---------------------------------------------------------------- text
# The game's own pixel font: sprites "font1" and "font1_gold" (and "font2…"
# at twice the size), one frame per character (FONT_CHARS, in the font
# script), each with its shadow drawn in. draw_text would do, but a smooth
# font at 8 pixels blurs; these stay as sharp as the art.

def text_width(text, size=1):
    return len(str(text)) * 6 * size


def draw_words(x, y, text, size=1, gold=False):
    """Draws text with its top-left at (x, y). Use inside a Draw or Draw GUI event."""
    name = f"font{size}" + ("_gold" if gold else "")
    for i, ch in enumerate(str(text)):
        n = FONT_INDEX.get(ch, -1)
        if n > 0:                  # 0 is a space; -1 a character the font doesn't have
            draw_sprite(name, n, x + i * 6 * size, y)


def draw_words_centered(cx, y, text, size=1, gold=False):
    draw_words(cx - text_width(text, size) // 2, y, text, size, gold)
