---
title: 5. Multiplayer
level: Game Elements 2: Adding to the Fun
time: 15 min
starter: dodge2-4
description: A second player on WASD, made from the first one with its own keys — one object defining another.
---
# Multiplayer

Two players on one keyboard: Player 1 on the arrows, Player 2 on **W A S D**. You won't type the player's code twice. Player 2 will be **made from** Player 1, with its own keys.

---

## Keys in variables

At the moment the keys are written into Player's Step event. To let two players share it, each one needs to keep its own keys in a variable.

Add these to the end of **Player**'s **Create** event:

```python
self.left_key = "left"
self.right_key = "right"
self.up_key = "up"
self.down_key = "down"
self.run_key = "shift"
self.fire_key = "space"
self.pad = 0
```

Then change **Player**'s **Step** event to use them. `self.pad` is which gamepad: 0 is the first one plugged in.

```python
speed = 4
if keyboard_check(self.run_key) or gamepad_check("b", self.pad):
    speed = 8
move_x = gamepad_axis("left_x", self.pad)
move_y = gamepad_axis("left_y", self.pad)
if keyboard_check(self.left_key) or gamepad_check("left", self.pad):
    move_x = -1
if keyboard_check(self.right_key) or gamepad_check("right", self.pad):
    move_x = 1
if keyboard_check(self.up_key) or gamepad_check("up", self.pad):
    move_y = -1
if keyboard_check(self.down_key) or gamepad_check("down", self.pad):
    move_y = 1
self.x += move_x * speed
self.y += move_y * speed
self.x = clamp(self.x, 0, room_width - 24)
self.y = clamp(self.y, 0, room_height - 24)
if self.cooldown > 0:
    self.cooldown -= 1
if (keyboard_check(self.fire_key) or gamepad_check("a", self.pad)) and self.cooldown == 0:
    instance_create(self.x + 24, self.y + 12, "Bullet")
    self.cooldown = 15
```

WASD doesn't move Player 1 any more. That's for Player 2.

```quiz
Why are the keys kept in variables like `self.left_key`, instead of written into the Step event?
- [x] So another player can use the same Step event with its own keys
- [ ] Variables make keyboard_check work faster
- [ ] keyboard_check only works with a variable
```

highlight: code-editor

```check
Player.create uses left_key
Player.step uses left_key
game runs 2 seconds without errors
```

---

## Player 2

Make a new object called **Player2**, with the **player** sprite, and choose **Player** as its **Parent**. A child object gets all its parent's events: the moving, the firing, the collisions.

highlight: object-parent

Drag a **Player2** into **Room1**, below Player 1. Then give **Player2** a **Create** event:

```python
super().on_create()
self.left_key = "a"
self.right_key = "d"
self.up_key = "w"
self.down_key = "s"
self.run_key = "q"
self.fire_key = "f"
self.pad = 1
```

`super().on_create()` runs Player's Create event first. Then Player 2 changes the keys to its own.

```quiz
Why is `super().on_create()` the first line of Player2's Create event, before the keys?
- [x] Player's Create runs first, and then Player 2's lines change the keys to its own
- [ ] Python needs super() at the top of every event
- [ ] It puts Player 2 below Player 1 in the room
```

```check
object Player2 exists
room Room1 has 1 Player2
Player2.create uses on_create
Player2.create uses left_key
game runs 2 seconds without errors
```

---

## Your turn: a different colour

Both players look the same. In **Player2**'s **Create** event, give it a colour with `self.image_blend`: `"orange"`, say. It tints the sprite.

```check
Player2.create uses image_blend
game runs 2 seconds without errors
```

---

## Two of you

Player 2 is a whole new player in a handful of lines. It shares the lives and the score with Player 1, so you win or lose together.

Next: **6. End Screen**.
