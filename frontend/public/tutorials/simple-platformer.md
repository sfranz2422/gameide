---
title: Simple Platformer
level: Starter Projects
time: 25 min
starter: platformer-start
description: Gravity, solid ground, running and jumping.
---
# A platformer

The level is built from tiles, and some tiles are **solid**. The **Player** is there, but it has no code yet: press **Play**, and nothing moves.

You'll give it gravity, running and jumping.

---

## Speed

Open **Player**, add a **Create** event, and type:

```python
self.vx = 0
self.vy = 0
```

`vx` and `vy` are how fast it moves across and down, in pixels a frame.

```check
Player has event create
Player.create uses vy
```

---

## Running

Add a **Step** event:

```python
move = keyboard_check("right") - keyboard_check("left")
self.vx = move * 4
if move_and_collide(self.vx, 0):
    self.vx = 0
```

`move_and_collide` moves it, but stops it against anything solid — and says whether it hit something.

highlight: add-event

```check
Player.step uses move_and_collide
after 1 second holding right, Player.x increased
```

---

## Gravity

Under that, in the same Step event:

```python
self.vy = min(self.vy + 0.6, 12)
if move_and_collide(0, self.vy):
    self.vy = 0
```

Each frame it falls a little faster, up to 12. Hitting the ground stops the fall.

```check
Player.step uses min
game runs 2 seconds without errors
```

---

## Jumping

Only jump when standing on something. Add, above the gravity lines:

```python
on_ground = not place_free(self.x, self.y + 1)
if on_ground and keyboard_check_pressed("space"):
    self.vy = -11
```

`place_free` says whether a spot is empty. One pixel below your feet not being free means you're standing.

```check
Player.step uses place_free
Player.step uses keyboard_check_pressed
game runs 2 seconds without errors
```

---

## Coins

Add a **Collision with Coin** event to Player:

```python
other.destroy()
sound_play("coin")
```

```check
Player has event collision with Coin
Player.collision with Coin uses destroy
```

---

## Done

You have a platformer. Ideas:

- Face the way you're going: `self.image_xscale = move` when `move != 0`.
- Make the jump higher or the gravity stronger.
- Add an Enemy that you can jump on.
