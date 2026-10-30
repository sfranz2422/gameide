---
title: 3. Autotiling
level: Art and Tiles
time: 15 min
starter: art-garden
description: Paths that draw their own corners and edges as you paint, from 16 pieces in the order GameIDE reads them.
---
# Autotiling

This game has a garden tileset and a room covered in grass. You'll paint garden paths across it.

A path needs a different piece for every way it can join its neighbours: a straight bit, a corner, a T, a crossroads, a dead end. Picking the right one for every square by hand is slow. **Autotiling** picks it for you as you paint.

---

## Sixteen pieces

Open the **garden** tileset. Its first two rows are the path, in 16 pieces: one for every way a square can join the squares beside it.

A piece's number says which sides it joins: add **1** for up, **2** for right, **4** for down and **8** for left. Piece 0 joins nothing, a little square of path on its own. Piece 5 is up and down (1 + 4), a straight path going down the screen. Piece 15 joins all four, a crossroads.

Kenney's sheets and most others aren't laid out like this, so you'd pick each piece's slot yourself. This one was drawn in that order, so it's quick.

```quiz
Which piece is a path that joins the square to its right and the square below it?
answer: 6
```

highlight: tileset-editor

---

## An autotile set

Under **Autotile sets** press **New autotile set**, and name it **path**.

Its 16 slots are empty. The pieces are already in order, starting at tile 0, so leave **From tile** at 0 and press **Take 16 in order**. Each slot fills with its piece.

highlight: autotile-sets

```check
tileset garden has an autotile set
```

---

## Paint the paths

Open **Room1**. Press **+ Tile layer**, name it **Paths**, and choose the **garden** tileset for it, so the paths sit over the grass.

Now pick the **path** autotile brush, and paint: a path round the edge of the garden, one across the middle, a dead end or two. Each square you paint chooses its piece from its neighbours, and changes them to join it.

Paint at least 20 squares of path.

```quiz
You paint a square of path with path on its left and right, and nothing above or below. Which piece does it become?
- [x] 10, a straight path across (2 + 8)
- [ ] 5, a straight path down
- [ ] 15, a crossroads
```

highlight: autotile-brushes

```check
room Room1 has at least 2 tile layers
room Room1 has at least 1220 tiles
```

---

## Paths that join

The grass is 1,200 tiles, and every square of path you painted is one more.

A tileset can have more than one autotile set: water with banks, hedges, walls. Draw the 16 pieces in this order, or fill the slots one by one from any sheet.

Next: **4. A Town from Tiles**.
