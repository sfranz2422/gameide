---
title: 9. Python in a Game
level: Python Basics
time: 15 min
starter: python-start
description: Variables, if and loops on the screen: draw with a loop, and grow a circle with the arrow keys.
---
# Python in a Game

Everything you've learned works in games. Instead of printing, this time you'll **draw**, and you'll make it react to the keyboard.

---

## A Draw event

Open **Main**, press **Add event** and choose **Draw**. Code in a Draw event runs every frame, 60 times a second, and draws the picture.

Type:

```python
draw_set_color("yellow")
draw_circle(320, 240, 50)
```

`draw_circle(x, y, size)` draws a circle. **x** is how far across, **y** how far down. Press **Play**.

highlight: add-event

```check
Main has event draw
Main.draw uses draw_circle
game runs 1 second without errors
```

---

## A loop draws a row

One loop can draw lots of circles. Add this under your circle in the **Draw** event:

```python
for i in range(10):
    draw_circle(40 + i * 64, 400, 20)
```

Each time round the loop, `i` is one bigger, so each circle is 64 to the right of the last. Play it.

```quiz
`i` starts at 0. How far across (its x) is the **third** circle in the row?
answer: 168
```

highlight: code-editor

```check
Main.draw uses for
game runs 1 second without errors
```

---

## A variable that belongs to Main

`self.` in front of a variable keeps it with this object between events. In the **Create** event, add:

```python
self.size = 50
```

In the **Draw** event, change your first circle to use it:

```python
draw_circle(320, 240, self.size)
```

```check
Main.create uses self
Main.draw uses self
game runs 1 second without errors
```

---

## Grow it with a key

Press **Add event** and choose **Step**. It runs every frame, before drawing. Type:

```python
if keyboard_check("up"):
    self.size += 2
if keyboard_check("down") and self.size > 5:
    self.size -= 2
```

Play it, click the game, and hold the up and down arrows.

```quiz
The Step event runs every frame, 60 times a second. Hold up for exactly one second: how much bigger does `self.size` get?
answer: 120
answer: 120 pixels
```

highlight: add-event

```check
Main has event step
Main.step uses keyboard_check
after 1 second holding up, Main.size increased
after 1 second holding down, Main.size decreased
```

---

## Your turn: colours

Change the colour as the circle grows. In the **Draw** event, before your first circle, use `if` and `else` to pick a colour, such as `"red"` when `self.size` is more than 100 and `"yellow"` otherwise.

```check
Main.draw uses if
game runs 1 second without errors
```

---

## You're ready for games

You've used variables, `if`, loops and keys in a game. That's all a game is: a lot of small decisions, every frame.

Head to **Getting Started** and try **Your First Game** or **Collect the Coins**, or explore **Starter Projects**.
