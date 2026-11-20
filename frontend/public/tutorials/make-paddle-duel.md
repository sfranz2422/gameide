---
title: Paddle Duel
level: Now You Can Make
after: el2-multiplayer
time: 45 min
starter: empty
description: Your own two-player game on one keyboard, from an empty one: you choose the paddles, the ball, how it looks, both players' keys and the score that wins.
---
# Paddle Duel

You've made a second player from the first, with keys of its own, and a function in a script. Now make a two-player game of **your own**, from an empty one.

Each player has a paddle on their side of the screen. A ball bounces between them, and gets faster every hit. Let it past you and the other player scores. **Everything else is up to you.**

- **What are the paddles?** Paddles, wizards with shields, goalkeepers, two frying pans…
- **What's the ball?** A ball, a puck, a fireball, a pancake…
- **Which keys?** Each player gets two: up and down. W and S, the arrows, or others.
- **How many points win?** Five, seven, eleven, you choose.
- **What does it look like?** Draw your own pictures, pick from the art library, or import your own.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names, keys and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

The room is 640 × 480.

---

## Your paddle

Make the left player's paddle. Pick a tall, thin picture: the examples are for one 64 pixels tall.

1. **Its picture.** Choose one way:
   - **Draw it:** make a new sprite and paint it in the sprite editor.
   - **The art library:** open **Library** and pick a picture.
   - **Your own file:** import a picture you made.
2. **Its object.** Make an object for it, give it that sprite, and give it a name that fits your game (*Paddle*, *Wizard*, *Keeper*…).
3. **Put it in the room.** Drag one near the left edge of **Room1**, halfway down.

highlight: open-library

```check
some object has a sprite
room Room1 has at least 1 thing
```

---

## Its keys

Give your paddle a **Create** event. As in **5. Multiplayer**, its keys are kept in variables, so the other paddle can have its own. Choose the left player's keys:

```python
self.up_key = "w"
self.down_key = "s"
```

And a **Step** event:

```python
move = keyboard_check(self.down_key) - keyboard_check(self.up_key)
self.y = clamp(self.y + move * 6, 0, room_height - 64)
```

`clamp` keeps the paddle on the screen. 64 is how tall the paddle's picture is: if yours is taller or shorter, change it to its height. Change the 6 to how fast you like.

highlight: code-editor

```check
holding a key moves something
uses up_key
```

---

## The other paddle

Make a second object for the right player, and choose your first paddle as its **Parent**. It gets all of its parent's events. Give it a sprite (the same picture, or one of its own), and drag one near the right edge of the room.

Give it a **Create** event of its own, with the right player's keys:

```python
super().on_create()
self.up_key = "up"
self.down_key = "down"
```

`super().on_create()` runs the parent's Create event first; then the new keys replace the parent's.

```quiz
What would go wrong if this Create event had only the two key lines, without `super().on_create()`?
- [x] Nothing yet, but anything else the parent's Create event sets up would be missing
- [ ] It would use the left player's keys
- [ ] It would have no sprite
```

highlight: object-parent

```check
uses super
room Room1 has at least 2 things
```

---

## The ball

1. **Its picture.** Draw it, pick it from the library, or import it.
2. **Its object.** Make an object with that sprite, named for your game (*Ball*, *Puck*, *Fireball*…).
3. **Put one in the room**, in the middle.

Give it a **Create** event, which sends it off one way or the other. Fill in the blanks (`___`):

```python
import random
self.hspeed = random.choice([___, ___])     # a speed to the left, and the same to the right
self.vspeed = random.choice([-3, -2, 2, 3])
```

And a **Step** event, to bounce off the top:

```python
if self.y < 6:
    self.vspeed = abs(self.vspeed)
```

`abs` is a number without its minus sign. At the top the ball must go down, so `vspeed` must be more than 0, whichever way it was going. That's safer than `-self.vspeed`, which would flip it back up if the ball were still over the edge on the next step.

**Finish it yourself:** add the bottom. When the ball is lower than `room_height - 6`, it must go **up**: `vspeed` less than 0, whichever way it was going.

highlight: add-objects

```check
at least 3 objects have sprites
some object's step uses abs
game runs 2 seconds without errors
```

---

## Hit it back

Add a **Collision** event to your ball, with your **first** paddle, the parent. The other paddle is its child, so touching it counts as touching the parent too.

Fill in the blanks:

```python
speed = abs(self.hspeed) * ___       # a little faster each hit, like 1.05
if other.x < room_width / 2:
    self.hspeed = speed
else:
    self.hspeed = ___                # away from the paddle on the right
offset = (self.y - (other.y + 32)) / 32
self.vspeed = offset * ___           # how steep it can fly off, like 5
```

The ball goes away from whichever paddle it hit. `offset` is where it hit the paddle: -1 at the very top, 0 in the middle, 1 at the bottom (32 is half of 64, the paddle's height). The further from the middle, the steeper it flies off, so you can aim.

```quiz
The ball hits the very top of a paddle, and the last line is `self.vspeed = offset * 5`. What is its `vspeed` afterwards?
answer: -5
```

highlight: add-event

```check
some object has event collision
some object's collision uses offset
game runs 2 seconds without errors
```

---

## Serve and score

When the ball gets past a paddle, the other player scores and the ball is served again from the middle. Serving happens in three places, so write it once, as a function.

Make a **script**, and name it (*rules*, *game*…). Fill in the blanks with the same speeds as your ball's Create event:

```python
import random


def serve(ball):
    ball.x = room_width / 2
    ball.y = room_height / 2
    ball.hspeed = random.choice([___, ___])
    ball.vspeed = random.choice([-3, -2, 2, 3])
```

Change your ball's **Create** event to start the scores and serve, in place of what was there:

```python
global_vars.left = 0
global_vars.right = 0
serve(self)
```

And add this at the bottom of the ball's **Step** event:

```python
if self.x < -20:
    global_vars.right += 1
    serve(self)
```

**Finish it yourself:** the other side. When the ball is further right than `room_width + 20`, the **left** player scores, and the ball is served again.

highlight: folder-scripts

```check
some object's create uses serve
some object's step uses serve
some object's step uses left
game runs 3 seconds without errors
```

---

## The scores

Make an object with **no sprite** to show the scores, name it (*Hud*, *Scoreboard*…), and drag one into the room. Its **Draw GUI** event draws a dashed line down the middle with a loop, then the scores. Fill in the blanks:

```python
draw_set_color(___)                      # a colour, like "white"
for y in range(0, room_height, ___):     # one dash every this many pixels, like 32
    draw_rect(318, y, 322, y + 16)
draw_text(270, 20, global_vars.left)
```

`range(0, room_height, 32)` counts 0, 32, 64… down the screen: one dash every 32 pixels, each 16 long.

**Finish it yourself:** draw the right player's score, `global_vars.right`, on the right of the line.

highlight: add-objects

```check
some object's draw gui uses range
some object's draw gui uses right
```

---

## The winner

Once someone has enough points, the ball stops, and a key of your choice plays again. Fill in the score that wins (the same number twice) and the key, and put these lines at the **top** of your ball's **Step** event:

```python
if global_vars.left == ___ or global_vars.right == ___:
    self.hspeed = 0
    self.vspeed = 0
    if keyboard_check_pressed(___):
        room_restart()
    return
```

**Finish it yourself:** in your score object's **Draw GUI** event, write your own words for each winner (one when `global_vars.left` has won, one for `global_vars.right`), and say which key plays again.

```quiz
The left player has just scored their winning point. Where is the ball on the next step?
- [x] Stopped in the middle: `serve` put it there, then the first lines of Step stopped it
- [ ] Still flying off the left edge
- [ ] Gone: it was destroyed
```

highlight: code-editor

```check
uses room_restart
some object's step uses return
game runs 2 seconds without errors
```

---

## You made your own two-player game

Play it with a friend, then make it even more yours:

- A **speed limit**, so a long rally doesn't go too fast to see: `min(speed, 12)`.
- A **power-up** in the middle that makes the paddle that last hit the ball taller.
- A **computer player**: a paddle that moves towards the ball's `y` by itself.
- A **background** and **sounds** for a hit and a point.
