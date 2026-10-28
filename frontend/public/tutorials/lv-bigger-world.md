---
title: A Bigger World
level: Getting Started
time: 15 min
starter: levels-4
description: A room wider than the screen, more ground to run on, a gap to fall through, and a camera that follows the hero.
---
# A bigger world

Your level fits on one screen. Real levels go on much further, and the screen follows the player through them.

---

## A wider room

Open **Room1** from the **Rooms** folder, and the **Room** tab on the right. Under **Size**, make the **Width** **1920**: three screens wide.

Press **Fit** at the top to see the whole room. The new part is empty.

highlight: folder-rooms

```check
room Room1 is at least 1600 wide
```

---

## More ground

Choose **Ground** in the box at the top of the room. In the **Tiles** tab, pick the grass, and use **Rectangle** to carry the strip on across the new part. Then the dirt under it.

Add a few platforms on the way, too.

highlight: room-tools

```check
room Room1 has at least 150 tiles
```

---

## A gap

Somewhere in the middle, erase a gap in the ground three or four tiles wide: right-click the tiles, or use **Erase**. Make sure you erase the grass and the dirt under it.

Fall in, and your hero falls forever. Bring it back: at the end of the **Player**'s Step event, add:

```python
if self.y > room_height:
    room_restart()
```

`room_height` is how tall the room is. Below it, the room starts again.

highlight: room-canvas

```check
Player.step uses room_restart
```

---

## The camera

Open **Room1** again, and its **Room** tab. Under **Camera**, tick **Show part of the room**. The dashed box in the room is what the screen shows: 640 by 480, one screen's worth.

Set **Follow** to **Player**.

highlight: folder-rooms

```check
room Room1 camera follows Player
```

---

## Play it

Press **Play** and run right. The view follows you along the whole level.

highlight: play

```check
after 2 seconds holding right, Player.x increased
game runs 2 seconds without errors
```

---

## Done

You built a level from free art: a sprite, a tileset, two layers of tiles, a hero who runs and jumps on them, and a world bigger than the screen.

Where next:
- **Game Elements** builds whole games, one idea at a time.
- **Starter Projects** has more for a game like this one: coins, enemies, scores.
