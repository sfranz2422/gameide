# script: controls
# Who presses what. One player: the arrows (or WASD), Z or Space to swing
# and to throw, X to change the pitch. Two players share the keyboard: WASD
# with C and V, and the arrows with I and O. A gamepad works for each player
# too: the d-pad or stick, A and B. On a phone: the touch buttons, Z and X.

ONE = {"left": ["left", "a"], "right": ["right", "d"], "up": ["up", "w"], "down": ["down", "s"],
       "buttons": [["z", "space", "enter"], ["x"]], "names": ["Z", "X"]}
TWO = [
    {"left": ["a"], "right": ["d"], "up": ["w"], "down": ["s"], "buttons": [["c"], ["v"]], "names": ["C", "V"]},
    {"left": ["left"], "right": ["right"], "up": ["up"], "down": ["down"], "buttons": [["i"], ["o"]], "names": ["I", "O"]},
]
NO_KEYS = {"left": [], "right": [], "up": [], "down": [], "buttons": [[], []], "names": ["A", "B"]}
PAD = ["a", "b"]
MATCH = {"two": False}


def keys_for(c):
    """Controller c's keys. Outside a two-player game the keyboard is
    controller 0's alone: given to both, a menu would read every press twice."""
    if MATCH.get("two"):
        return TWO[c]
    return ONE if c == 0 else NO_KEYS


def held(keys):
    return any(keyboard_check(k) for k in keys)


def stick(c):
    """Where controller c is pushing: (x, y), each -1, 0 or 1 (y is down)."""
    k = keys_for(c)
    ax = held(k["right"]) - held(k["left"])
    ay = held(k["down"]) - held(k["up"])
    if gamepad_connected(c):
        ax += gamepad_check("right", c) - gamepad_check("left", c)
        ay += gamepad_check("down", c) - gamepad_check("up", c)
        if abs(gamepad_axis("left_x", c)) > 0.4:
            ax += sign(gamepad_axis("left_x", c))
        if abs(gamepad_axis("left_y", c)) > 0.4:
            ay += sign(gamepad_axis("left_y", c))
    return clamp(ax, -1, 1), clamp(ay, -1, 1)


def button_pressed(c, n):
    """True on the step controller c presses its button n (0: swing / throw, 1: change pitch)."""
    if any(keyboard_check_pressed(k) for k in keys_for(c)["buttons"][n]):
        return True
    return gamepad_connected(c) and gamepad_check_pressed(PAD[n], c)


def button_name(c, n):
    return keys_for(c)["names"][n]


def menu_moved(c):
    """-1 for up, 1 for down, the step it's pressed."""
    k = keys_for(c)
    if any(keyboard_check_pressed(x) for x in k["up"]) or (gamepad_connected(c) and gamepad_check_pressed("up", c)):
        return -1
    if any(keyboard_check_pressed(x) for x in k["down"]) or (gamepad_connected(c) and gamepad_check_pressed("down", c)):
        return 1
    return 0
