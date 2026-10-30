---
title: 2. Slicing a Tileset
level: Art and Tiles
time: 15 min
starter: empty
description: Download a whole town's worth of tiles as Kenney ships them, cut the picture into tiles yourself, and choose which ones are solid.
---
# Slicing a Tileset

A **tileset** is one picture holding all the pieces a level is built from: grass, roads, water, walls, trees. Before you can paint with it, GameIDE has to know how to cut the picture into tiles.

The art library cuts its tilesets for you. A tileset you download, or draw yourself, you cut yourself. In this lesson you'll cut one of Kenney's, just as he ships it.

---

## Download the picture

Click this link to save the picture: **[town.png](tutorials/art/town.png)**

It's Kenney's **Roguelike/RPG** pack: more than 1,700 tiles for towns, houses and the countryside, all in one picture.

Press the **+** beside **Tilesets** and name it **town**. Then press **Choose a picture…** and choose the file you saved.

highlight: folder-tilesets

```check
tileset town exists
```

---

## Cut it right

Look at the picture in the tileset editor. The grid doesn't fit: GameIDE guessed tiles of 32 × 32, and Kenney's are smaller.

In the **Tiles** box set:

- **Width** 16 and **Height** 16: each tile is 16 pixels square
- **Spacing x** 1 and **Spacing y** 1: Kenney leaves 1 pixel of empty space between tiles, so they never bleed into each other

Watch the grid line up with the tiles. Underneath it should say **57 × 31 = 1767 tiles**.

```quiz
Kenney's picture is 968 pixels wide. With tiles of 16 and 1 pixel between them, how many tiles are there across?
- [x] 57: each tile and its gap take 17 pixels, and the last tile has no gap after it
- [ ] 60: 968 divided by 16
- [ ] 56: 968 divided by 17
```

highlight: tileset-cut

```check
tileset town is cut 16 × 16 with spacing 1
```

---

## Solid tiles

Some tiles should stop the player: trees, bushes, water. Click them in the picture to mark them **solid**. Mark at least **three**: a round tree, a pine tree and a bush, all near the middle on the left of the picture, under the furniture.

Solid tiles are what `move_and_collide` and `place_free` bump into, wherever you paint them.

highlight: tileset-solid

```check
tileset town has at least 3 solid tiles
```

---

## Cut to size

Any tileset is cut the same way: the size of a tile, the gap between tiles, and the **Offset** if the picture has a border round its edge.

Next: **3. Autotiling**, where paths draw their own edges.
