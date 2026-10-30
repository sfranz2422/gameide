---
title: 4. A Town from Tiles
level: Art and Tiles
time: 25 min
starter: art-town
description: Paint a town seen from above in layers, with trees and water you can't walk through, a player who walks it, and a camera.
---
# A Town from Tiles

This game has the **town** tileset, cut the way you cut it in **2. Slicing a Tileset**, and a **Player** in an empty room. You'll paint a town for the player to walk around.

---

## Grass everywhere

Open **Room1**. Press **+ Tile layer**, name it **Ground**, and choose the **town** tileset.

Pick plain grass from the palette: the light green square in the top row, sixth from the left. Choose the **Rectangle** tool and drag from one corner of the room to the other.

The room is 640 × 480, and the tiles are 16 pixels: 40 across, 30 down.

```quiz
How many tiles of grass cover the room?
answer: 1200
```

highlight: add-tile-layer

```check
room Room1 has a tile layer using town
room Room1 has at least 1200 tiles
```

---

## Roads and water

Still on the **Ground** layer, paint a road: the brown square beside the grass. Then a pond of water, from the top left corner of the picture.

Painting over a tile replaces it. That's why the road and the pond go on the same layer as the grass: they're ground too.

highlight: tile-palette

---

## Trees on a layer of their own

Press **+ Tile layer** again, name it **Things**, and choose **town**. Paint at least ten trees and bushes on it, round the edges and along the road.

Things on their own layer sit on top of the ground. Erase one, and the grass is still there underneath.

highlight: add-tile-layer

```check
room Room1 has at least 2 tile layers
room Room1 has at least 1210 tiles
```

---

## Walk the town

Give **Player** a **Step** event, to walk in four directions, stopped by anything solid:

```python
speed = 2
dx = (keyboard_check("right") - keyboard_check("left")) * speed
dy = (keyboard_check("down") - keyboard_check("up")) * speed
move_and_collide(dx, 0)
move_and_collide(0, dy)
```

Play it. The player walks straight through the trees! A tile only stops the player if it's **solid**. Open the **town** tileset, and click the trees, the bush and the water to mark them solid (any you didn't mark in lesson 2).

Play it again: now the trees and the pond stop you.

```quiz
Why does the player walk on the grass, but not through a tree?
- [x] The tree tiles are marked solid in the tileset, and the grass isn't
- [ ] Trees are on the Things layer
- [ ] move_and_collide only works on trees
```

highlight: tileset-solid

```check
Player.step uses move_and_collide
tileset town has at least 3 solid tiles
after 1 second holding right, Player.x changed
```

---

## A bigger town

A town fits better in a bigger room. Open **Room1**'s settings and set its **Width** to 1280 and its **Height** to 960. Then tick **Camera**, leave it 640 by 480, and choose **Player** to **follow**.

Fill the new space with grass, roads and trees.

highlight: room-camera

```check
room Room1 is at least 1280 wide
room Room1 camera follows Player
```

---

## Your town

You cut a tileset, painted it in layers, chose what's solid, and walked it. Ideas to go further:

- Houses: the walls and roofs further down the picture, with the walls marked solid.
- A fence round a field, and a gate you can walk through.
- Your own tileset, drawn or downloaded, cut the same way.
