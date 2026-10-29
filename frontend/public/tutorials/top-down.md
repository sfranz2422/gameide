---
title: Top-Down Adventure
level: Starter Projects
time: 30 min
starter: topdown
description: A village seen from above that already works: walk about, collect gold, dodge slimes, talk to the wizard. Then make it yours.
---
# Village Quest

This game already works. Press **Play** and try it:

- **Arrow keys** walk.
- **Space** talks to the wizard, when you're standing next to him.
- Collect all the gold, and keep away from the slimes: they send you back to the start.

Everything you see is made of pieces you can open and change. That's what the next steps do.

highlight: play

```check
game runs 3 seconds without errors
```

---

## A faster hero

Open **Player** from the **Objects** folder, and its **Create** event:

```python
self.walk_speed = 1.5
```

That's how many pixels the hero moves each step. Make it **2.5** and play again.

Why not call it `speed`? Because `speed` is GameIDE's own: give an object a speed and it moves by itself, without anyone pressing a key.

```quiz
Why is the hero's speed called `walk_speed` and not `speed`?
- [x] `speed` is GameIDE's own: it would make the hero move by itself
- [ ] Python doesn't let you name a variable `speed`
- [ ] `speed` can only be a whole number
```

highlight: object-editor

```check
Player.create uses 2.5
```

---

## More gold

Open the **Village** room from the **Rooms** folder. Choose **Coin** in the list on the left, pick the **Place** tool, and click to put five more coins around the map. Hide some behind trees!

The counter at the top of the game counts them by itself.

highlight: room-canvas

```check
room Village has at least 15 Coin
```

---

## The wizard's words

Open **Wizard**, and its **Create** event. `self.lines` is a **list**: everything the wizard says, one line at a time.

Add a third line of your own to the end of the list. Each line is in quotes, with a comma after it:

```python
self.lines = [
    "Welcome to the village, traveller!",
    "Slimes got into the fields and scattered my gold. Can you find it all?",
    "Mind the slimes. They are stickier than they look.",
]
```

highlight: object-editor

```check
game runs 2 seconds without errors
```

---

## Faster slimes

Place another **Slime** in the Village, somewhere on your way.

Then open **Slime**'s **Create** event. `self.hspeed` is how fast it slides across, in pixels a step. Make them faster: try **1.2**.

```check
room Village has at least 3 Slime
game runs 2 seconds without errors
```

---

## Paint the village

The map is painted with tiles from the **village** tileset. In the **Village** room, open the **Layers** tab and press **+ Tile layer**: a new layer, for scenery, on top of the ground.

Open the **Tiles** tab, pick flowers, bushes or a tree, and paint. Trees, bushes, roofs and fences are **solid**: the hero can't walk through them. (Open the **village** tileset to see which tiles are solid. They're marked red.)

```quiz
You painted a bush on the new layer. Can the hero walk through it?
- [x] No: bushes are solid tiles
- [ ] Yes: tiles on a new layer are only scenery
- [ ] Only if it's on the ground layer
```

highlight: room-tab-tiles

```check
room Village has at least 2 tile layers
room Village has at least 1205 tiles
```

---

## Done

You changed a working game: its speed, its gold, its words, its enemies and its map.

Ideas for more:

- A **Key** object to pick up, and a gate that only opens when you have it.
- A second room, through a house's door.
- A sword: press **X** to destroy a slime next to you.
- A villager who says something different once you've found all the gold.
