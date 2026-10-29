---
title: Painting a Room
level: Getting Started
time: 15 min
starter: levels-2
description: A tile layer, a brush, a floor and a platform — and a second layer for the scenery.
---
# Painting a room

You have a hero and a tileset. Now paint a level with it.

A room has **layers**, like sheets of glass stacked up. One holds your objects. You'll add **tile layers** to paint on: one for the ground, and one for scenery.

---

## A tile layer

Open **Room1** from the **Rooms** folder. On the right, open the **Layers** tab and press **+ Tile layer**.

It's called **Ground**, and it already uses your **ground** tileset (the ⚙ beside it shows its settings, where you could choose another). It's now the layer you're working on: the box at the top of the room says **Ground**.

highlight: folder-rooms

```check
room Room1 has a tile layer using ground
```

---

## Pick a tile

Open the **Tiles** tab. It shows your tileset: this is your paint box.

Click the middle grass block, the third one in the top row. Under the tiles it says **Brush: 1 × 1 (tile 2)**.

highlight: room-tab-tiles

---

## Paint the ground

At the top of the room, choose the **Rectangle** tool. Drag a line across the whole room, two rows up from the bottom edge: a strip of grass.

Then click a plain dirt square in the Tiles tab and paint the row under the grass the same way.

Other tools: **Paint** paints where you click or drag, **Fill** fills a space, **Erase** rubs tiles out, and a right-click always erases.

```quiz
type: match
Match each tool to what it does:
- Rectangle -> paints the whole shape you drag out
- Paint -> paints where you click or drag
- Fill -> fills a space
- Erase -> rubs tiles out
```

highlight: room-tools

```check
room Room1 has at least 30 tiles
```

---

## A platform

Pick the grass again and paint a short line in the air, about five tiles long, higher than your hero's head. Your hero will jump up onto it in the next lesson.

highlight: room-canvas

```check
room Room1 has at least 35 tiles
```

---

## Scenery on its own layer

Scenery is easier to change on a layer of its own. In **Layers**, press **+ Tile layer** again. Its settings open under it: change its **Name** to **Decor**.

In **Tiles**, pick a plant (there's a sprout, a bush and a tree near the bottom-left of the sheet) and paint a few of them standing on your grass.

Plants aren't solid, so your hero will walk in front of them. To move a layer in front or behind, use its ↑ and ↓.

```quiz
Why won't your hero bump into the plants?
- [ ] Because they're on the Decor layer
- [x] Because plant tiles aren't solid
- [ ] Because plants are smaller than the hero
```

highlight: room-tab-layers

```check
room Room1 has at least 2 tile layers
```

---

## Play it

Press **Play**. Your level is there. Your hero just floats, though: it has no code yet. That's next.

highlight: play

```check
game runs 1 second without errors
```

---

## Done

You painted a level on two layers. To change it later, choose the layer in the box at the top of the room, then paint or erase.

Next: **Walking on Tiles**.
