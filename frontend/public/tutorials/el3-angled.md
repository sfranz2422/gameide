---
title: 1. Angled Movement
level: Game Elements 3: Advanced Techniques
time: 12 min
starter: space-0
description: A ship that turns, and flies the way it's pointing — direction, speed, and the hspeed and vspeed they make.
---
# Angled Movement

So far everything has moved straight across or straight down. In these lessons you'll build a **space shooter** where the ship turns and flies at **any angle**: a rock-blasting game, in the spirit of *Asteroids*.

The game has a **Ship**, a **Rock** and a **Bullet** ready, with their sprites. Only the ship is in the room, and nothing moves yet.

---

## Turn

Open **Ship**, add a **Step** event, and type:

```python
if keyboard_check("left"):
    self.image_angle += 5
if keyboard_check("right"):
    self.image_angle -= 5
```

`image_angle` turns the sprite. Angles go **anticlockwise**, in degrees: 0 points right, 90 up, 180 left. So left adds and right takes away.

highlight: add-event

```check
Ship has event step
after 1 second holding left, Ship.image_angle increased
```

---

## Thrust

Add to the Step event:

```python
if keyboard_check("up"):
    self.direction = self.image_angle
    self.speed = 4
else:
    self.speed = 0
```

`direction` is which way it moves and `speed` how fast: the ship flies the way it's pointing. Turn while you fly and it goes round in a circle.

highlight: code-editor

```check
after 1 second holding up, Ship.x increased
after 0.5 seconds holding up and left, Ship.y decreased
```

---

## Two parts

A speed in a direction is really two speeds at once: some across, some down. GameIDE works them out for you as `hspeed` and `vspeed`. Give **Ship** a **Draw GUI** event to see them:

```python
draw_set_color("white")
draw_text(10, 10, f"hspeed {self.hspeed:.1f}   vspeed {self.vspeed:.1f}")
```

`:.1f` shows one decimal place. Fly about and watch: pointing right is all hspeed; pointing up is all vspeed, negative because up is minus. In between, a bit of each. A speed with a direction is called a **vector**.

```check
Ship has event draw gui
Ship.draw gui uses hspeed
game runs 2 seconds without errors
```

---

## Your turn: round the edges

Fly off one edge and you're lost. Make the ship come back on the opposite side: at the end of the Step event, set `self.x` to `self.x % room_width`, and `self.y` the same way with `room_height`.

`%` gives what's left after dividing. 650 % 640 is 10, so flying off the right brings you in on the left. And -5 % 640 is 635.

```check
Ship.step uses %
after 3 seconds holding up, 0 <= instances("Ship")[0].x < room_width
```

---

## Any angle

Your ship turns and flies any way it points, and space wraps round.

Next: **2. Top-Down Physics**, so it drifts like a real spaceship.
