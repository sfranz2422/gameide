---
title: 9. Level Maps
level: Game Elements 3: Advanced Techniques
time: 15 min
starter: cave-0
description: A new game, a platformer: its level drawn as rows of text, and loops that turn the text into walls.
---
# Level Maps

A new game: a **cave platformer**. It has objects ready (**Wall**, **Player**, **Coin**, **Slime**, **Friend** and **Slash**) but an empty room.

Dragging hundreds of walls into a room one by one is slow. Instead you'll **draw the level as text**, a list of rows where `#` is a wall, and let a loop build it. Changing the level then means changing the text.

---

## Rows of text

Make an object called **Level**, with no sprite, and drag one into the room. Give it a **Create** event:

```python
rows = [
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "...............###..",
    "....................",
    "..........####......",
    "....................",
    "....####............",
    "....................",
    "....................",
    "P...................",
    "####################",
]
for row in range(len(rows)):
    for col in range(len(rows[row])):
        if rows[row][col] == "#":
            instance_create(col * 32, row * 32, "Wall")
```

`rows` is a list of strings, one per row of the room, each 20 characters for the room's 20 columns of 32 pixels. The loops go through every row, and every character in it: wherever there's a `#`, a Wall is made at that column and row.

Play it: there's the level.

```quiz
type: blank
Counting rows and columns from 0, a `#` in column 5 of row 2 makes a Wall at x = [[160]] and y = [[64]].
```

highlight: add-objects

```check
object Level exists
room Room1 has 1 Level
Level.create uses for
game runs 2 seconds without errors
```

---

## Where the player starts

There's a `P` in the map, near the bottom left. Add another choice inside the loop, under the Wall line:

```python
        elif rows[row][col] == "P":
            instance_create(col * 32, row * 32, "Player")
```

`elif` means "otherwise, if": a character can't be both.

```check
Level.create uses elif
game runs 2 seconds without errors
```

---

## Your turn: coins

Put some `c`s in the map where coins should be, then add an `elif` that makes a **Coin** for each `c`. Coins look best in the middle of their square: `col * 32 + 16`, `row * 32 + 16`.

```check
Level.create uses Coin
game runs 2 seconds without errors
```

---

## A level from text

Your whole level is a few lines of text. Try changing it: more platforms, more coins. The player can't move yet.

Next: **10. Platformer Tools**.
