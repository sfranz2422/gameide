# script: controls
# Who presses what. One player: arrows or WASD, and Z X C (or 1 2 3).
# Two players share the keyboard: WASD with C V B, and the arrows with
# I O P. A gamepad works for each player too: the stick, and A B X.

ONE = {"left": ["left", "a"], "right": ["right", "d"], "up": ["up", "w"], "down": ["down", "s"],
       "buttons": [["z", "space", "enter", "1"], ["x", "2"], ["c", "3"]], "names": ["Z", "X", "C"]}
TWO = [
    {"left": ["a"], "right": ["d"], "up": ["w"], "down": ["s"],
     "buttons": [["c"], ["v"], ["b"]], "names": ["C", "V", "B"]},
    {"left": ["left"], "right": ["right"], "up": ["up"], "down": ["down"],
     "buttons": [["i"], ["o"], ["p"]], "names": ["I", "O", "P"]},
]
PAD = ["a", "b", "x"]


def keys_for(c):
    return TWO[c] if MATCH.get("two") else ONE


def held(keys):
    return any(keyboard_check(k) for k in keys)


def pad_axis(c):
    """Where controller c is pushing: (x, y), each -1 to 1, never longer than 1."""
    k = keys_for(c)
    ax = (1 if held(k["right"]) else 0) - (1 if held(k["left"]) else 0)
    ay = (1 if held(k["down"]) else 0) - (1 if held(k["up"]) else 0)
    if gamepad_connected(c):
        sx, sy = gamepad_axis("left_x", c), gamepad_axis("left_y", c)
        if abs(sx) > 0.25 or abs(sy) > 0.25:     # a stick at rest is never quite at 0
            ax, ay = sx, sy
        ax += (1 if gamepad_check("right", c) else 0) - (1 if gamepad_check("left", c) else 0)
        ay += (1 if gamepad_check("down", c) else 0) - (1 if gamepad_check("up", c) else 0)
    n = (ax * ax + ay * ay) ** 0.5
    return (ax / n, ay / n) if n > 1 else (ax, ay)


def button_pressed(c, n):
    """True on the step controller c presses its button n (0, 1 or 2)."""
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
