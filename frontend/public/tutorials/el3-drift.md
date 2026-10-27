---
title: 2. Top-Down Physics
level: Game Elements 3: Advanced Techniques
time: 15 min
starter: space-1
description: Push, don't set: speed that builds up and drifts, friction to slow it, a top speed, and brakes.
---
# Top-Down Physics

Real things don't start and stop instantly. They speed up, keep going, and slow down. Making movement work like that is **physics**, and it's what makes a spaceship feel like a spaceship.

---

## Push, don't set

At the moment, Up **sets** the speed to 4. Instead, each step Up should **add** a little push in the way the ship is pointing. Replace the whole `if keyboard_check("up"):` block, `else` and all, with:

```python
import math
if keyboard_check("up"):
    self.hspeed += math.cos(math.radians(self.image_angle)) * 0.2
    self.vspeed -= math.sin(math.radians(self.image_angle)) * 0.2
```

`cos` says how much of a push at that angle goes across, and `sin` how much goes up. `radians` turns degrees into the units `cos` and `sin` use. The push is 0.2 a step, so speed builds up while you hold Up, and stays when you let go.

highlight: code-editor

```check
Ship.step uses cos
after 1 second holding up, instances("Ship")[0].speed > 4
```

---

## Friction

In space you'd drift forever. A game is more fun if you slowly stop. Give **Ship** a **Create** event:

```python
self.friction = 0.05
```

`friction` takes a little off the speed every step, all by itself.

```check
Ship.create uses friction
game runs 2 seconds without errors
```

---

## A top speed

Hold Up for long and the ship gets too fast to steer. Add this under the push:

```python
if self.speed > 6:
    self.speed = 6
```

Changing `speed` keeps the direction: the ship still goes the same way, just no faster than 6.

```check
after 2 seconds holding up, instances("Ship")[0].speed <= 6
```

---

## Your turn: brakes

Make **Down** slow the ship quickly: while it's held, multiply `self.speed` by 0.9 each step. Put it under the top-speed lines.

```check
after 2 seconds holding up and down, instances("Ship")[0].speed < 3
```

---

## It drifts

The ship speeds up, drifts, slows down, and has brakes: four lines of physics.

Next: **3. Spawning and Destroying**.
