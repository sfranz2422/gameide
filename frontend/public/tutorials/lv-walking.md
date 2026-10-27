---
title: Walking on Tiles
level: Getting Started
time: 15 min
starter: levels-3
description: Gravity, solid ground, running and jumping, on the level you painted.
---
# Walking on tiles

Your level is painted, and its grass and dirt are solid. Now give your hero gravity, so it lands on them, and let it run and jump.

---

## Falling

Open **Player**, add a **Create** event, and type:

```python
self.vy = 0
```

`vy` is how fast it's moving down, in pixels a frame. It starts still.

Then add a **Step** event:

```python
self.vy = min(self.vy + 0.5, 10)
if move_and_collide(0, self.vy):
    self.vy = 0
```

Every frame it falls a bit faster, up to 10. `move_and_collide` moves it, but stops it against anything solid, like your grass, and says whether it hit something. Landing stops the fall.

highlight: add-event

```check
Player has event create
Player.step uses move_and_collide
after 2 seconds, instances("Player")[0].vy == 0
```

---

## Running

At the **top** of the Step event, add:

```python
move = keyboard_check("right") - keyboard_check("left")
move_and_collide(move * 3, 0)
```

`move` is 1 holding right, -1 holding left, and 0 otherwise, so it walks 3 pixels a frame that way, and stops at a wall.

```check
Player.step uses keyboard_check
after 1 second holding right, Player.x increased
```

---

## Jumping

Only jump when standing on something. Between the `min` line and the `move_and_collide(0, self.vy)` line, add:

```python
on_ground = not place_free(self.x, self.y + 1)
if on_ground and keyboard_check_pressed("space"):
    self.vy = -9
```

`place_free` says whether a spot is empty. If the spot one pixel under your feet isn't free, you're standing on something.

```check
Player.step uses place_free
Player.step uses keyboard_check_pressed
game runs 2 seconds without errors
```

---

## Try your level

Press **Play**, click the game, and run with the arrows. Jump with **Space** onto your platform.

Your whole Step event should now read:

```python
move = keyboard_check("right") - keyboard_check("left")
move_and_collide(move * 3, 0)

self.vy = min(self.vy + 0.5, 10)
on_ground = not place_free(self.x, self.y + 1)
if on_ground and keyboard_check_pressed("space"):
    self.vy = -9
if move_and_collide(0, self.vy):
    self.vy = 0
```

highlight: play

```check
after 1 second holding left, Player.x decreased
```

---

## Done

Your hero stands on the tiles you marked solid and walks straight past the plants. Try marking a plant solid in the **ground** tileset, then play again.

Next: **A Bigger World**.
