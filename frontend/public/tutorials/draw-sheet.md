---
title: 4. Pictures from a Sheet
level: Draw Your Own
time: 15 min
starter: draw-2
description: Cut a page of climbers made with Google Gemini into frames with Find the pictures, walk one of them, and give Gemini the credit.
---
# Pictures from a Sheet

Picture makers like **Google Gemini** can draw a whole page of characters for you. The page isn't a neat grid: the drawings are scattered on a coloured background. GameIDE can find each drawing for you and make them frames.

This game has your walking **Hero** from **2. Animate It**. You'll give it a new look from a sheet made with Gemini.

---

## Download the sheet

Click this link to save the picture: **[snow-climbers.jpg](tutorials/art/snow-climbers.jpg)**

Four climbers, each in six poses: standing, two running, jumping, arms up, and throwing a snowball. It was **made with Google Gemini** for GameIDE's game **Snowcap Scramble**.

Art made with Gemini is free for your games, but always say where it came from: you'll put a credit in your game at the end of this lesson.

---

## Find the pictures

Read this step first: the importer covers the screen while it's open.

Press the **+** beside **Sprites**, then **Import your own picture…**, and choose the file you saved. Choose **Find the pictures**.

The pink background goes see-through, and every drawing gets a box and a number. You only want three of them, so:

1. Press **Leave out all**.
2. Click the red climber's first three pictures in the top row, in order: standing, and its two running poses.

It should say **3 frames**. Name it **climber**, leave **Origin** at **Bottom center (feet)**, and press **Make sprite**.

Every frame is made the size of the biggest drawing, each one standing on the bottom, so the climber doesn't jump up and down as it walks.

```quiz
Why does **Find the pictures** make every frame the same size, with each drawing standing on the bottom?
- [x] So the animation doesn't jump about as the frames change
- [ ] So the file is smaller
- [ ] So the background goes see-through
```

highlight: import-picture

```check
sprite climber has 3 frames
sprite climber has a drawing on every frame
```

---

## A new look

Open **Hero** and choose **climber** in its **Sprite** box. Press **Play**: the Step event from **2. Animate It** already walks it, faces it the right way, and stands it still.

highlight: object-sprite

```check
Hero has sprite climber
game runs 2 seconds without errors
```

---

## Give the credit

Make an object called **Credits** (no sprite) and drag it into the room. Give it a **Draw GUI** event, which draws on top of everything, in the corner of the screen:

```python
draw_set_color("white")
draw_text(8, 456, "Art made with Google Gemini")
```

Whenever your game uses art you didn't make, say who or what made it.

```quiz
You use pictures made with Google Gemini in a game you publish. What should you do?
- [x] Say so in the game: "Art made with Google Gemini"
- [ ] Nothing: nobody can tell
- [ ] Say you drew them yourself
```

highlight: add-objects

```check
object Credits exists
Credits has event draw gui
Credits.draw gui uses draw_text
room Room1 has 1 Credits
```

---

## Your own sheets

The Free art library has every picture from GameIDE's games made with Gemini, already cut: press **+** beside **Sprites**, then **Free art library…**. Credit those the same way.

You can also mix: cut a sheet with **Find the pictures**, then change the frames with the Pencil.
