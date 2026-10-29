---
title: A Tileset
level: Getting Started
time: 10 min
starter: levels-1
description: A whole sheet of tiles from the library, and which of them are solid ground.
---
# A tileset

Levels are made of **tiles**: small squares, like grass, dirt and bricks, laid side by side. A **tileset** is one picture with all the tiles on it. You paint a room with them, the way you'd paint with a brush.

This game has your hero from last time. Now you'll add the ground.

---

## Add the sheet

Press the **+** beside **Sprites**, choose **Free art library…**, then **Pixel Platformer**.

This time take a whole sheet: under **Tiles**, press **Add the sheet as a tileset**. The library closes, and your tileset opens in the tileset editor and appears under **Tilesets**. Then press **Next**.

highlight: add-sprites

---

## Name it ground

Under **Tilesets**, double-click its name, type **ground**, and press Enter.

highlight: folder-tilesets

```check
tileset ground exists
```

---

## How it's cut

The tileset editor shows how the picture is cut into tiles. The library already set it: each tile is **18 × 18** pixels, and there are 20 across and 9 down, **180 tiles**.

Every tile has a number, counting from 0 along the top row. You won't need the numbers, but your game uses them to remember which tile goes where.

```quiz
Why does the tileset need to know each tile is **18 × 18** pixels?
- [x] So it knows where to cut the picture into tiles
- [ ] So the room is 18 tiles wide
- [ ] So the hero is the same size as a tile
```

highlight: tileset-editor

---

## Solid tiles

A **solid** tile is one your player stands on and bumps into. Everything else is scenery.

Under **Solid tiles**, keep **Solid** chosen. Click the four grass blocks in the top-left corner, then the four plain dirt squares beside them (two in the top row, two under those). Each turns red as you click it.

Clicked the wrong one? Click it again.

```quiz
Which of these should be solid? Pick all that are right.
- [x] The grass your hero stands on
- [x] The dirt under the grass
- [ ] A plant growing on the grass
- [ ] A sign beside the path
```

highlight: tileset-solid

```check
tileset ground has at least 4 solid tiles
```

---

## Done

Your tileset has ground to stand on. The plants, signs and coins aren't solid, so your hero will walk past them.

**One-way** is for platforms you jump up through from below and land on from above. Try it on a tile later.

Next: **Painting a Room**.
