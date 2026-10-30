---
title: Paddle Duel
level: Now You Can Make
after: el2-multiplayer
time: 45 min
starter: empty
description: A whole game from an empty one, for two players on one keyboard: knock the ball past each other, first to five wins.
---
# Paddle Duel

You've made a second player from the first, with keys of its own, and a function in a script. Now make a two-player game of your own, from an empty one.

In **Paddle Duel** each player has a paddle on their side of the screen. The ball bounces between them, and gets faster every hit. Let it past you and the other player scores. First to five wins.

---

## The left paddle

Add the **paddle** sprite and an object called **Paddle** with it. Open **Room1** and drag a **Paddle** near the left edge, halfway down.

Give **Paddle** a **Create** event. As in **5. Multiplayer**, its keys are kept in variables, so another paddle can have its own:

```python
self.up_key = "w"
self.down_key = "s"
```

And a **Step** event:

```python
move = keyboard_check(self.down_key) - keyboard_check(self.up_key)
self.y = clamp(self.y + move * 6, 0, room_height - 64)
```

The paddle is 64 pixels tall, so its top stops 64 pixels above the bottom of the room.

highlight: add-sprites

```check
object Paddle exists
Paddle has sprite
room Room1 has 1 Paddle
after 1 second holding s, Paddle.y increased
```

---

## The right paddle

Make an object called **Paddle2**, with the **paddle** sprite, and choose **Paddle** as its **Parent**. It gets all of Paddle's events. Drag one near the right edge of the room.

Give **Paddle2** a **Create** event of its own, with the arrow keys:

```python
super().on_create()
self.up_key = "up"
self.down_key = "down"
```

```quiz
What would go wrong if Paddle2's Create event had only the two key lines, without `super().on_create()`?
- [x] Nothing yet, but anything else Paddle's Create event sets up would be missing from Paddle2
- [ ] Paddle2 would use W and S
- [ ] Paddle2 would have no sprite
```

highlight: object-parent

```check
object Paddle2 exists
room Room1 has 1 Paddle2
Paddle2.create uses super
after 1 second holding down, Paddle2.y increased
```

---

## The ball

Add the **ball** sprite and an object called **Ball** with it. Drag one into the middle of the room. Give it a **Create** event, which sends it off one way or the other:

```python
import random
self.hspeed = random.choice([-4, 4])
self.vspeed = random.choice([-3, -2, 2, 3])
```

And a **Step** event, to bounce off the top and the bottom:

```python
if self.y < 6:
    self.vspeed = abs(self.vspeed)
if self.y > room_height - 6:
    self.vspeed = -abs(self.vspeed)
```

`abs` is a number without its minus sign. At the top the ball must go down, so `vspeed` must be more than 0, whichever way it was going. That's safer than `-self.vspeed`, which would flip it back up if the ball were still over the edge on the next step.

highlight: add-objects

```check
object Ball exists
room Room1 has 1 Ball
Ball.step uses abs
after 1 second, Ball.x changed
```

---

## Hit it back

Add a **Collision with Paddle** event to **Ball**. Paddle2's children-of-Paddle rule works here too: touching Paddle2 is touching a Paddle.

```python
speed = abs(self.hspeed) * 1.05
if other.x < room_width / 2:
    self.hspeed = speed
else:
    self.hspeed = -speed
offset = (self.y - (other.y + 32)) / 32
self.vspeed = offset * 5
```

The ball goes away from whichever paddle it hit, 5% faster. `offset` is where it hit the paddle: -1 at the very top, 0 in the middle, 1 at the bottom. The further from the middle, the steeper it flies off, so you can aim.

```quiz
The ball hits the very top of a paddle. What is its `vspeed` afterwards?
answer: -5
```

highlight: add-event

```check
Ball has event collision with Paddle
Ball.collision with Paddle uses offset
game runs 2 seconds without errors
```

---

## Serve and score

When the ball gets past a paddle, the other player scores and the ball is served again from the middle. Serving happens in three places, so write it once, as a function.

Make a **script** called **rules**:

```python
import random


def serve(ball):
    ball.x = room_width / 2
    ball.y = room_height / 2
    ball.hspeed = random.choice([-4, 4])
    ball.vspeed = random.choice([-3, -2, 2, 3])
```

Change **Ball**'s **Create** event to start the scores and serve:

```python
global_vars.left = 0
global_vars.right = 0
serve(self)
```

And add this at the bottom of **Ball**'s **Step** event:

```python
if self.x < -20:
    global_vars.right += 1
    serve(self)
if self.x > room_width + 20:
    global_vars.left += 1
    serve(self)
```

highlight: folder-scripts

```check
script rules exists
Ball.create uses serve
Ball.step uses serve
game runs 3 seconds without errors
```

---

## The scores

Make an object called **Hud**, with no sprite, and drag one into the room. Its **Draw GUI** event draws a dashed line down the middle with a loop, then the two scores:

```python
draw_set_color("white")
for y in range(0, room_height, 32):
    draw_rect(318, y, 322, y + 16)
draw_text(270, 20, global_vars.left)
draw_text(360, 20, global_vars.right)
```

`range(0, room_height, 32)` counts 0, 32, 64… up the screen: one dash every 32 pixels, each 16 long.

highlight: add-objects

```check
object Hud exists
room Room1 has 1 Hud
Hud.draw gui uses range
```

---

## First to five

Add these lines at the **top** of **Ball**'s **Step** event. Once someone has five, the ball stops, and Enter plays again:

```python
if global_vars.left == 5 or global_vars.right == 5:
    self.hspeed = 0
    self.vspeed = 0
    if keyboard_check_pressed("enter"):
        room_restart()
    return
```

And at the bottom of **Hud**'s **Draw GUI** event:

```python
if global_vars.left == 5:
    draw_text(190, 220, "Left player wins! Enter to play again")
if global_vars.right == 5:
    draw_text(190, 220, "Right player wins! Enter to play again")
```

```quiz
The left player has just scored their fifth point. Where is the ball on the next step?
- [x] Stopped in the middle: `serve` put it there, then the first lines of Step stopped it
- [ ] Still flying off the left edge
- [ ] Gone: it was destroyed
```

highlight: code-editor

```check
Ball.step uses room_restart
game runs 2 seconds without errors
```

---

## You made Paddle Duel

Ideas to make it yours:

- A speed limit, so a long rally doesn't go too fast to see: `min(speed, 12)`.
- A power-up in the middle that makes the paddle that last hit the ball taller.
- A computer player: Paddle2 that moves towards the ball's `y` by itself.
