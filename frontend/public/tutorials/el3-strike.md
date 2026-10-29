---
title: 12. Strike and Interact
level: Game Elements 3: Advanced Techniques
time: 20 min
starter: cave-3
description: Slimes to fight with a sword strike that lasts a moment, and a friend to talk to when you're close.
---
# Strike and Interact

Two things a player often does to the world: **strike** it (swing a sword, punch) and **interact** with it (talk, open, pick up). Both happen near the player, for a moment.

---

## Slimes

In **Level**'s **Create** event, change the map so the row above the floor has some slimes (`s`) and a friend (`F`):

```python
rows = [
    "............................................................",
    "............................................................",
    "............................................................",
    "....................................................c.......",
    "...................................................####.....",
    "................c...........................................",
    "...............###........c.................................",
    "...........c.............###............c...................",
    "..........####.........................###......#####.......",
    ".....c......................................................",
    "....####.......................c............................",
    "..............................###...........................",
    "............................................................",
    "P...F.......s.................s..............s..............",
    "############################################################",
]
```

and make them, with two more choices in the loop:

```python
        elif rows[row][col] == "s":
            instance_create(col * 32 + 16, row * 32 + 20, "Slime")
        elif rows[row][col] == "F":
            instance_create(col * 32, row * 32 + 8, "Friend")
```

Give **Slime** a **Create** event, `self.hspeed = -1`, and a **Step** event that turns it round at walls:

```python
if not place_free(self.x + self.hspeed * 13, self.y):
    self.hspeed = -self.hspeed
```

And touching one is bad. Give **Player** a **Collision with Slime** event:

```python
room_restart()
```

```check
Level.create uses Slime
Slime.step uses place_free
Player has event collision with Slime
game runs 2 seconds without errors
```

---

## Strike

A strike is an instance that's there for a moment: a **Slash**, in front of the player. First, the player must know which way it's facing. In **Player**'s **Create** event, add:

```python
self.facing = 1
```

At the end of its **Step** event:

```python
if move != 0:
    self.facing = move
if keyboard_check_pressed("x"):
    instance_create(self.x + self.facing * 28, self.y - 4, "Slash")
```

Give **Slash** a **Create** event that makes it small, see-through and short-lived:

```python
self.image_xscale = 0.5
self.image_yscale = 0.5
self.image_alpha = 0.5
self.alarm[0] = 15
```

an **Alarm 0** event, `self.destroy()`, and a **Collision with Slime** event:

```python
effect("hit", other.x, other.y)
other.destroy()
```

```quiz
Why does a Slash vanish a moment after it's made?
- [ ] `image_alpha` fades it out
- [x] Its Alarm 0 goes off 15 steps later and destroys it
- [ ] It's destroyed as soon as the player stops pressing X
```

```check
Slash has event alarm 0
Slash has event collision with Slime
Player.step uses Slash
game runs 2 seconds without errors
```

---

## Interact

Talking to the friend works only when you're close, so first find the nearest friend and how far away it is. Give **Friend** a **Create** event, `self.image_blend = "lime"`, so it looks different from you. Then add to the end of **Player**'s **Step** event:

```python
friend = instance_nearest(self.x, self.y, "Friend")
if friend and point_distance(self.x, self.y, friend.x, friend.y) < 48:
    if keyboard_check_pressed("z"):
        say("Hello! Press X to fight the slimes.", "Friend")
```

`instance_nearest` finds the closest Friend, and `point_distance` how far it is. `say` shows a speech box at the bottom of the screen.

```quiz
type: match
Match each function to what it does:
- instance_nearest -> finds the closest instance of an object
- point_distance -> says how far apart two points are
- say -> shows a speech box at the bottom of the screen
```

```check
Player.step uses point_distance
Player.step uses say
game runs 2 seconds without errors
```

---

## Your turn: useful advice

Make the friend say how many slimes are left, with an f-string and `instance_number("Slime")`.

```check
Player.step uses instance_number
game runs 2 seconds without errors
```

---

## Game Elements, done

You've built three games and used every element on the way: players, enemies, collisions, scores, timers, title and end screens, projectiles, two players, angled movement, physics, spawning, health bars, explosions, pause menus, buttons, level maps, platforming, cameras, striking and talking.

Every game you'll ever play is made of pieces like these. Now make your own.
