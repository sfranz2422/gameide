---
title: 2. Gamepad
level: Game Elements 1: The Basics
time: 12 min
starter: dodge-1
description: Play with a controller: the stick, the D-pad, and a button to run.
---
# Gamepad

Many players would rather use a **gamepad** (a game controller) than a keyboard. GameIDE can read one plugged into the computer, or connected by Bluetooth.

You don't need one for this lesson: the keyboard keeps working, and the checks use it. If you have one, plug it in and try it as you go.

---

## Which way, then move

First, a small change to how the player moves. Open **Player**'s **Step** event and change it to this:

```python
speed = 4
move_x = 0
move_y = 0
if keyboard_check("left") or keyboard_check("a"):
    move_x = -1
if keyboard_check("right") or keyboard_check("d"):
    move_x = 1
if keyboard_check("up") or keyboard_check("w"):
    move_y = -1
if keyboard_check("down") or keyboard_check("s"):
    move_y = 1
self.x += move_x * speed
self.y += move_y * speed
self.x = clamp(self.x, 0, room_width - 24)
self.y = clamp(self.y, 0, room_height - 24)
```

Now the keys only decide **which way** (`-1`, `0` or `1`), and the player moves once, at the bottom. It plays the same, but now a stick can decide which way too.

```quiz
Holding only the left arrow, what happens in one step?
- [x] move_x is -1, so the player moves 4 pixels left
- [ ] move_x is -4, so the player moves 16 pixels left
- [ ] move_x is 1, so the player moves 4 pixels right
```

highlight: code-editor

```check
Player.step uses move_x
after 1 second holding right, Player.x increased
after 1 second holding up, Player.y decreased
```

---

## The stick

`gamepad_axis("left_x")` is how far the left stick is pushed across: from `-1` (all the way left) to `1` (all the way right). `"left_y"` is up and down.

Start `move_x` and `move_y` from the stick instead of from 0. Change those two lines to:

```python
move_x = gamepad_axis("left_x")
move_y = gamepad_axis("left_y")
```

Push the stick a little and the player moves slowly; push it all the way and it goes at full speed. With no gamepad, both are 0.

```check
Player.step uses gamepad_axis
game runs 2 seconds without errors
```

---

## The D-pad

The D-pad is the cross of four buttons. `gamepad_check("left")` is True while its left is held. Add it to each `if`:

```python
if keyboard_check("left") or keyboard_check("a") or gamepad_check("left"):
    move_x = -1
if keyboard_check("right") or keyboard_check("d") or gamepad_check("right"):
    move_x = 1
if keyboard_check("up") or keyboard_check("w") or gamepad_check("up"):
    move_y = -1
if keyboard_check("down") or keyboard_check("s") or gamepad_check("down"):
    move_y = 1
```

```quiz
With this code, which of these make the player go left? (Pick all that do.)
- [x] The left arrow
- [x] The A key
- [x] The left of the D-pad
- [ ] The S key
- [ ] The right arrow
```

```check
Player.step uses gamepad_check
after 1 second holding left, Player.x decreased
```

---

## Your turn: run

Make the player go twice as fast while **Shift** (or the gamepad's **B** button) is held. Put this just under `speed = 4`:

```python
if keyboard_check("shift") or gamepad_check("b"):
    speed = 8
```

```check
Player.step uses shift
game runs 2 seconds without errors
```

---

## Any controller

Your player now works with the keyboard, a stick or a D-pad. A gamepad's buttons are named after an Xbox controller: `"a"`, `"b"`, `"x"`, `"y"`, `"start"` and more. Look in **Docs** under **Input**.

Next: **3. Enemy**.
