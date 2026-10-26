---
title: Your First Game
level: Getting Started
time: 15 min
starter: empty
description: A sprite, an object, a room, and a player you move with the arrow keys.
---
# Your first game

In this tutorial you'll make a player you can move around the screen with the arrow keys.

Each step tells you what to do, then **✔ Check my work** checks it. When it passes, **Next** opens the next step.

Type the code yourself — that's how you learn it.

---

## A sprite

A **sprite** is a picture. Press the **+** beside **Sprites** and pick the **player**.

highlight: add-sprites

```check
sprite player exists
```

---

## An object

An **object** is a thing in your game: it has a sprite, and code that says what it does.

Press the **+** beside **Objects**, type the name **Player**, and press Enter.

highlight: add-objects

```check
object Player exists
```

---

## Give it its sprite

With **Player** open, choose **player** in its **Sprite** box.

highlight: object-sprite

```check
Player has sprite
```

---

## Put it in the room

A **room** is where the game happens. Open **Room1** from the **Rooms** folder, then drag **Player** from the list on the left into the room.

highlight: folder-rooms

```check
room Room1 has at least 1 Player
```

---

## Make it move

Open **Player**, press **Add event** and choose **Step**. A Step event runs every frame — 60 times a second.

Type this into it:

```python
self.x += (keyboard_check("right") - keyboard_check("left")) * 4
self.y += (keyboard_check("down") - keyboard_check("up")) * 4
```

`keyboard_check("right")` is 1 while the right arrow is held, and 0 when it isn't. So right minus left is 1, -1 or 0 — which way to go — and `* 4` is how fast.

highlight: add-event

```check
Player has event step
Player.step uses keyboard_check
after 1 second holding right, Player.x increased
after 1 second holding down, Player.y increased
```

---

## Play it

Press **Play**, click the game, and move with the arrow keys.

highlight: play

```check
game runs 2 seconds without errors
```

---

## You made a game

Your player moves. Ideas to try next:

- Change the `4` to make it faster or slower.
- Add a second sprite and object — a coin, a wall.
- Try the **Collect the Coins** tutorial.
