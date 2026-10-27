---
title: 10. Platformer Tools
level: Game Elements 3: Advanced Techniques
time: 15 min
starter: cave-1
description: Walking that stops at walls, gravity, jumping only from the ground, short hops and a top falling speed.
---
# Platformer Tools

A **platformer** needs a few tools: walking that walls stop, gravity, and a jump that only works from the ground.

---

## Walk and fall

Give **Player** a **Create** event:

```python
self.vy = 0
```

`vy` is how fast the player is falling: positive is down. Then a **Step** event:

```python
move = keyboard_check("right") - keyboard_check("left")
move_and_collide(move * 3, 0)
self.vy += 0.5
if move_and_collide(0, self.vy):
    self.vy = 0
```

`keyboard_check` gives 1 or 0, so right minus left is 1, -1 or 0. `move_and_collide` moves until it bumps into something solid (the walls are ticked **Solid**), and gives back what it bumped into. Gravity adds to `vy` every step; landing on something sets it back to 0.

highlight: add-event

```check
Player has event step
after 1 second, instances("Player")[0].y == 424
after 1 second holding right, Player.x increased
```

---

## Jump

A jump is only allowed from the ground. Add these lines after the `move_and_collide(move * 3, 0)` line, before gravity:

```python
on_ground = not place_free(self.x, self.y + 1)
if on_ground and keyboard_check("up"):
    self.vy = -9
```

`place_free(x, y)` asks whether the player could be at (x, y) without touching anything solid. One pixel down not being free means standing on something.

highlight: code-editor

```check
Player.step uses place_free
after 1 second holding up, instances("Player")[0].y < 424
```

---

## Short hops

In good platformers, a tap of Up is a small hop and holding it is a big jump. Add, under the jump:

```python
if self.vy < 0 and not keyboard_check("up"):
    self.vy = max(self.vy, -3)
```

While going up (`vy` below 0) with Up let go, the rising speed is cut, so the jump ends sooner.

```check
Player.step uses max
game runs 2 seconds without errors
```

---

## Your turn: a top falling speed

A long fall gets faster and faster until the player falls through things. Under `self.vy += 0.5`, stop `vy` going above 10. `min` will help.

```check
Player.step uses min
game runs 2 seconds without errors
```

---

## Platforming

Walls, gravity, jumps, short hops and a falling speed limit: the tools of every platformer.

Next: **11. Scrolling Camera**.
