---
title: 11. Scrolling Camera
level: Game Elements 3: Advanced Techniques
time: 15 min
starter: cave-2
description: A level three screens wide, and a camera that follows the player through it, smoothly.
---
# Scrolling Camera

One screen isn't much of a level. With a **camera**, the room can be much bigger than the window, and the view follows the player through it.

---

## A bigger room

Open **Room1** and change its **Width** to **1920**: three screens wide.

highlight: room-editor

Then make the map three times as wide. In **Level**'s **Create** event, change `rows` to this. Each row now has 60 characters, and the level carries on to the right:

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
    "P...........................................................",
    "############################################################",
]
```

```check
room Room1 is at least 1920 wide
game runs 2 seconds without errors
```

---

## Follow the player

Play it. The window still shows the whole room squashed small. In **Room1**'s settings, tick **Camera**, leave it 640 by 480 (the window's size), and choose **Player** to **follow**.

highlight: room-camera

```check
room Room1 camera follows Player
```

---

## Smoothly

A camera stuck to the player is a bit jerky. In **Player**'s **Create** event, add:

```python
camera_follow(self, 0.1)
```

The camera moves a tenth of the way to the player each step: it glides after it instead.

```quiz
With `camera_follow(self, 0.1)`, the camera is 100 pixels behind the player. How many pixels does it move this step?
answer: 10
answer: ten
```

```check
Player.create uses camera_follow
game runs 2 seconds without errors
```

---

## Your turn: closer

Zoom in, so everything looks bigger: `camera_zoom(1.5)` in the Player's Create event shows a smaller part of the room, one and a half times as big.

```quiz
After `camera_zoom(1.5)`, how much of the room does the window show?
- [x] Less of it, with everything bigger
- [ ] More of it, with everything smaller
- [ ] The same part, only brighter
```

```check
Player.create uses camera_zoom
game runs 2 seconds without errors
```

---

## A world to explore

The level is three screens wide and the camera glides along with you. `view_x` and `view_y` tell your code where the view is.

Next: **12. Strike and Interact**.
