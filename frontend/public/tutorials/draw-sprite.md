---
title: 1. Draw a Sprite
level: Draw Your Own
time: 15 min
starter: empty
description: Draw your own character pixel by pixel, put it in a game, and move it with the arrow keys.
---
# Draw a Sprite

A **sprite** is a picture in your game. You don't have to find one: you can draw your own, right here, one square **pixel** at a time.

In this lesson you'll draw a character, put it in a game, and walk it around with the arrow keys.

---

## A picture to draw on

Read this step first: a window opens over the screen.

Press the **+** beside **Sprites**. At the top, under **Draw your own**:

- type **hero** in the **Name** box
- choose **32 × 32** (32 pixels across and 32 down: plenty for a character)
- press **Start drawing**

The sprite editor opens with an empty picture and the **Pencil** chosen.

highlight: add-sprites

```check
sprite hero exists
sprite hero is 32 × 32
```

---

## Draw your hero

Click a colour, then click or drag on the picture to draw. Draw a person, an animal, a robot: anything you like.

- **Brush size** 1 to 4 draws bigger squares.
- The **right mouse button** rubs out. So does the **Eraser**.
- **Fill** colours a whole area at once: try it on a shirt.
- Made a mistake? **Ctrl+Z** takes back the last stroke.
- **−** and **+** zoom in and out.

The checkerboard behind your drawing is see-through: in the game, whatever is behind your hero shows there.

```quiz
You want to colour in a big shirt you've drawn the outline of. Which tool does it in one click?
- [x] Fill
- [ ] Pencil with brush size 4
- [ ] Pick colour
```

highlight: sprite-paint-tools

```check
sprite hero has a drawing on every frame
```

---

## An object

An **object** is a thing in your game: it has a sprite, and code that says what it does.

Press the **+** beside **Objects**, type the name **Hero**, and press Enter. Then choose **hero** in its **Sprite** box.

highlight: add-objects

```check
object Hero exists
Hero has sprite hero
```

---

## Into the room

Open **Room1** from the **Rooms** folder and drag **Hero** from the list on the left into the room.

highlight: folder-rooms

```check
room Room1 has 1 Hero
```

---

## Make it move

Open **Hero**, press **Add event** and choose **Step**. A Step event runs every frame, 60 times a second. Type:

```python
self.x += (keyboard_check("right") - keyboard_check("left")) * 4
self.y += (keyboard_check("down") - keyboard_check("up")) * 4
```

Right minus left is 1, -1 or 0: which way to go. `* 4` is how fast. Press **Play**, click the game, and walk your hero around.

```quiz
Your hero moves too slowly. What do you change?
- [x] The 4, to a bigger number
- [ ] "right" to "left"
- [ ] self.x to self.y
```

highlight: add-event

```check
Hero has event step
Hero.step uses keyboard_check
after 1 second holding right, Hero.x increased
```

---

## Change it, and play again

Open the **hero** sprite again and change something: a hat, a different colour. Then press **Play**.

The game uses your drawing as it is now. There's nothing to save or export: every stroke is kept as you draw.

highlight: play

```check
game runs 2 seconds without errors
```

---

## You drew a game character

Next: **2. Animate It**, where your hero gets a second picture and walks.
