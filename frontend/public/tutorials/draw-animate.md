---
title: 2. Animate It
level: Draw Your Own
time: 15 min
starter: draw-1
description: Give your hero a second frame, watch it walk, and make it walk only while it moves, facing the way it goes.
---
# Animate It

An **animation** is a few pictures shown one after another, fast. Each picture is a **frame**. Two frames, legs together and legs apart, already make a walk.

This game has a **hero** sprite and a **Hero** that moves with the arrow keys, as at the end of **1. Draw a Sprite**. You'll give the hero a second frame and make it walk.

---

## A second frame

Open the **hero** sprite and choose the **Pencil**. Under the picture is its frame, **0**.

Press **Copy frame**. Now there's a frame **1**, the same picture as frame 0, and it's the one you're drawing on. Change it a little: move the legs apart, swing an arm. Use the **Eraser** to rub out the old legs and the **Pencil** to draw new ones.

Tick **Show last frame**: frame 0 shows faintly underneath, so you can see what moved.

highlight: sprite-editor

```check
sprite hero has at least 2 frames
sprite hero's frames are all different
```

---

## Watch it walk

Press **Play** under the frames. The two pictures take turns: your hero walks on the spot. Click the picture to stop it.

On the right, **Animation speed** is how many frames a second. Try 4 and 12, then pick one you like.

```quiz
A sprite has 4 frames and plays at 8 frames a second. How many times a second does it go through all of them?
answer: 2
answer: two
```

---

## Walk only when it moves

Press Play in the game: your hero walks all the time, even standing still. Open **Hero**'s **Step** event and change it to this:

```python
move_x = keyboard_check("right") - keyboard_check("left")
move_y = keyboard_check("down") - keyboard_check("up")
self.x += move_x * 4
self.y += move_y * 4
if move_x != 0 or move_y != 0:
    self.image_speed = 1
else:
    self.image_speed = 0
    self.image_index = 0
if move_x != 0:
    self.image_xscale = move_x
```

- `image_speed` 1 plays the animation, and 0 stops it.
- `image_index` is the frame showing: 0, standing still.
- `image_xscale` -1 flips the picture, so walking left your hero faces left.

```quiz
Your hero walks left. What is `self.image_xscale`?
answer: -1
answer: minus 1
answer: minus one
```

highlight: add-event

```check
Hero.step uses image_speed
Hero.step uses image_xscale
after 1 second, Hero.image_index stayed the same
after 1 second holding left, Hero.image_xscale decreased
```

---

## Play it

Press **Play** and walk about: legs moving when you move, still when you stop.

highlight: play

```check
game runs 2 seconds without errors
```

---

## More frames

Smoother walks have more frames: **Copy frame** again and again, a small change each time. **Move ◀** and **Move ▶** put them in order.

Next: **3. Shapes and Flips**.
