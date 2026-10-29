---
title: 1. Player
level: Game Elements 1: The Basics
time: 10 min
starter: dodge-0
description: A player you move with the arrow keys or WASD, who can't leave the screen.
---
# Player

Every game needs a **player**: the thing you control. In these six lessons you'll build a dodging game, one piece at a time: a player, enemies, crashes, a score and a time limit.

This game already has a **Player** object, in the room on the left. It doesn't do anything yet. That's your job.

Each step says what to do, then **✔ Check my work** checks it. Type the code yourself. That's how you learn it.

---

## Moving

Open **Player**, press **Add event** and choose **Step**. A Step event runs every frame, 60 times a second.

Type:

```python
speed = 4
if keyboard_check("left"):
    self.x -= speed
if keyboard_check("right"):
    self.x += speed
if keyboard_check("up"):
    self.y -= speed
if keyboard_check("down"):
    self.y += speed
```

`self.x` is how far across the player is, and `self.y` how far down. Down the screen is **bigger** y, so going up takes away from `self.y`.

Press **Play**, click the game, and try the arrow keys.

```quiz
Why does going up take away from `self.y`?
- [ ] The room is upside down
- [x] Down the screen is bigger y
- [ ] self.y can't go below 0
```

highlight: add-event

```check
Player has event step
after 1 second holding right, Player.x increased
after 1 second holding up, Player.y decreased
```

---

## WASD too

Lots of players like **W A S D** instead of the arrows. Change each `if` so either key works:

```python
speed = 4
if keyboard_check("left") or keyboard_check("a"):
    self.x -= speed
if keyboard_check("right") or keyboard_check("d"):
    self.x += speed
if keyboard_check("up") or keyboard_check("w"):
    self.y -= speed
if keyboard_check("down") or keyboard_check("s"):
    self.y += speed
```

`or` means "either one is enough".

highlight: code-editor

```check
after 1 second holding d, Player.x increased
after 1 second holding w, Player.y decreased
```

---

## Stay on the screen

Hold left for a while: the player walks right off the screen. Add these two lines at the end:

```python
self.x = clamp(self.x, 0, room_width - 24)
self.y = clamp(self.y, 0, room_height - 24)
```

`clamp(value, low, high)` keeps a number between two others. The room is `room_width` across and `room_height` down, and the player is 24 pixels wide, so its left edge can go from 0 to `room_width - 24`.

```quiz
Why is the biggest x `room_width - 24` and not `room_width`?
- [x] The player is 24 pixels wide, so its left edge has to stop 24 short of the side
- [ ] The room has a 24 pixel border
- [ ] The player moves 24 pixels every step
```

```check
Player.step uses clamp
game runs 2 seconds without errors
```

---

## You have a player

Your player moves with the arrows or WASD, and stays on the screen.

Next: **2. Gamepad**, so it works with a controller too.
