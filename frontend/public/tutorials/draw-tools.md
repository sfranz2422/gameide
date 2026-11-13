---
title: 3. Shapes and Flips
level: Draw Your Own
time: 20 min
starter: draw-2
description: Draw a coin with the circle tool, collect coins, and make an enemy from your hero with paste and flip.
---
# Shapes and Flips

Drawing every pixel by hand is slow. The sprite editor has tools that do the work: shapes, paste, and flip.

This game has your walking **hero** from **2. Animate It**. You'll draw coins to collect and an enemy to dodge.

---

## A coin

Read this step first: a window opens over the screen.

Press the **+** beside **Sprites**. Under **Draw your own**, type the name **coin**, choose **16 × 16**, and press **Start drawing**.

Then draw it with shapes:

1. Choose **Circle** and tick **Filled**. Pick a yellow, and drag from one corner of the picture to the other. Hold **Shift** for a perfect circle.
2. Untick **Filled**, pick a darker yellow, and drag the same way again: an edge round it.
3. A white dot with the **Pencil** makes it shine.

**Line** and **Box** work the same way: drag from one end or corner to the other.

```quiz
You're drawing with **Circle** and you want a perfect circle, not an oval. What do you hold while you drag?
- [x] Shift
- [ ] Ctrl
- [ ] The right mouse button
```

highlight: add-sprites

```check
sprite coin is 16 × 16
sprite coin has a drawing on every frame
```

---

## Coins in the room

Make an object called **Coin** with the **coin** sprite, and drag three of them into **Room1**.

highlight: add-objects

```check
object Coin exists
Coin has sprite coin
room Room1 has at least 3 Coin
```

---

## Collect them

Open **Hero**, press **Add event**, and under **Collision with** choose **Coin**. `other` is the coin your hero touched:

```python
other.destroy()
```

highlight: add-event

```check
Hero has event collision with Coin
Hero.collision with Coin uses destroy
```

---

## An enemy from your hero

Read this step first: a window opens over the screen.

An enemy can start as your hero, turned round and repainted:

1. Open the **hero** sprite and choose **Select**. With nothing selected, press **Copy**: it takes the whole frame.
2. Press the **+** beside **Sprites**. Under **Draw your own**, type **enemy**, choose **32 × 32**, and press **Start drawing**.
3. Press **Paste**, then **Enter** to put it down.
4. Press **Flip ↔**: it faces the other way.
5. Choose **Fill**, pick a new colour, and click its shirt and hair.

**Select** picks out part of a picture: drag a box round it, then drag inside the box to move that part, or paste it somewhere else, or Flip and **Turn** just that part.

```quiz
You paste your hero into a new sprite and press **Flip ↔** with nothing selected. What happens?
- [x] The whole picture faces the other way
- [ ] Only the hero's legs flip
- [ ] It turns upside down
```

highlight: sprite-edit-tools

```check
sprite enemy has a drawing on every frame
```

---

## It walks at you

Make an object called **Enemy** with the **enemy** sprite, and drag one into the right side of **Room1**. Give it a **Step** event:

```python
self.x -= 2
if self.x < -16:
    self.x = room_width + 16
```

It walks left, and comes back in on the right when it's gone. Now open **Hero**, add a **Collision with Enemy** event, and start again when they touch:

```python
room_restart()
```

highlight: add-objects

```check
object Enemy exists
Enemy has sprite enemy
room Room1 has 1 Enemy
after 1 second, Enemy.x decreased
Hero has event collision with Enemy
Hero.collision with Enemy uses room_restart
```

---

## Play it

Collect the coins and dodge the enemy.

highlight: play

```check
game runs 2 seconds without errors
```

---

## Ideas

- Draw a second frame for the enemy so it walks too.
- Give the coin a second frame (**Copy frame**) and use **Turn ⟳** on it: a spinning coin.

Next: **4. Pictures from a Sheet**.
