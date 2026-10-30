---
title: 1. Your Own Sprite Sheet
level: Art and Tiles
time: 15 min
starter: empty
description: Download a sheet of a robot walking, cut it into frames on a grid, and make the robot walk the way you press.
---
# Your Own Sprite Sheet

Art for games usually comes as a **sprite sheet**: one picture with every frame of an animation laid out in a grid. Kenney's free packs, art you draw, and art from other sites all come this way.

In this lesson you'll download a sheet, cut it into frames yourself, and make the robot in it walk.

---

## Download the sheet

Click this link to save the picture: **[robot-walk.png](tutorials/art/robot-walk.png)**

It's Kenney's robot walking: 8 frames, 4 across and 2 down. Each frame is **96 × 128** pixels, and there are **2 pixels** of empty space between them.

---

## Import it, and cut it into frames

Read this step first: the importer covers the screen while it's open.

Press the **+** beside **Sprites**, then **Import your own picture…**, and choose the file you saved. The importer shows the picture. Choose **Grid**, then set:

- **Frame width** 96 and **Frame height** 128
- **Spacing x** 2 and **Spacing y** 2

The **spacing** is the gap between frames. Without it, every frame after the first starts 2 pixels too early, and the robot slides across its own frames.

Watch the grid on the picture line up with the robots, and the little preview walk. It should say **8 frames, 96 × 128**.

Name it **robot**, choose **Bottom center (feet)** for its **Origin**, set the **Speed** to 10, and press **Make sprite**.

```quiz
A sheet has frames 64 pixels wide with 4 pixels between them. Where does the third frame start, counting from 0 at the left edge?
answer: 136
```

highlight: import-picture

```check
sprite robot has 8 frames
sprite robot is 96 × 128
```

---

## A robot

Make an object called **Robot** with the **robot** sprite, and drag one into the room.

Give it a **Step** event. It walks left and right, faces the way it walks, and only plays its walk while it moves:

```python
move = keyboard_check("right") - keyboard_check("left")
self.x += move * 3
if move != 0:
    self.image_xscale = move
    self.image_speed = 1
else:
    self.image_speed = 0
    self.image_index = 0
```

`image_xscale` set to -1 flips the picture, so the robot faces left. `image_speed` 0 stops the animation, and `image_index` 0 is its first frame, standing still.

```quiz
The robot walks left. What is its `image_xscale`?
answer: -1
```

highlight: add-objects

```check
object Robot exists
Robot has sprite
room Room1 has 1 Robot
Robot.step uses image_xscale
after 1 second holding right, Robot.x increased
```

---

## Your own art

Any sheet works the same way: the size of a frame, and the gap between frames if there is one. Some sheets have a border round the edge too: that's the **Offset**.

Next: **2. Slicing a Tileset**, where a whole level's worth of tiles is cut the same way.
