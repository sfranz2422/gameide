---
title: Art from the Library
level: Getting Started
time: 10 min
starter: levels-0
description: A walking hero from the free art library: two frames of a Kenney character, as a sprite.
---
# Art from the library

You don't have to draw your game's art. GameIDE has a **free art library**: packs of characters, tiles and ships by Kenney, a game artist who gives them away. They're **public domain**, so your games can use them, share them, even sell them.

In the next five lessons you'll build a level with that art: a hero, a tileset, a room painted with tiles, a player who walks and jumps on them, and a world bigger than the screen.

Each step tells you what to do, then **✔ Check my work** checks it. When it passes, **Next** opens the next step.

---

## Pick a character

Press the **+** beside **Sprites**, then choose **Free art library…**, then the **Pixel Platformer** pack. You'll see its sheets: **Tiles**, **Characters** and **Backgrounds**. A **sheet** is one picture with lots of small pictures on it, side by side.

A sprite can have several **frames**: pictures shown one after another, like a flip book. In **Characters**, click the green astronaut (the first picture). Then hold **Shift** and click the one beside it. The button under the sheet now says **Add as a sprite (2 frames)**. Press it.

The library closes and your new sprite opens, with its two frames. Then press **Next**.

highlight: add-sprites

---

## Name it hero

The library named your sprite after the sheet. Give it a better name: under **Sprites**, double-click its name (or click it and press **F2**), type **hero**, and press Enter.

highlight: folder-sprites

```check
sprite hero exists
sprite hero has 2 frames
```

---

## A Player

Press the **+** beside **Objects**, name it **Player**, and choose **hero** in its **Sprite** box.

highlight: add-objects

```check
object Player exists
Player has sprite
```

---

## Into the room

Open **Room1** from the **Rooms** folder and drag **Player** from the list on the left into the room.

highlight: folder-rooms

```check
room Room1 has at least 1 Player
```

---

## Play it

Press **Play**. The astronaut walks on the spot: its two frames take turns, 8 a second. That's an animation.

highlight: play

```check
game runs 1 second without errors
```

---

## Done

You have a hero from the library. The other packs are worth a look too: **Tiny Dungeon** and **Tiny Town** for games seen from above, **Pixel Shmup** for ships.

Next: **A Tileset**, the ground for your hero to stand on.
