---
title: Blocks to Python
level: Getting Started
time: 15 min
starter: player-start
description: Build an event from blocks, read the Python they make, then turn it into Python.
---
# Blocks to Python

Blocks and Python are the same code, written two ways. You'll build an event from blocks, see the Python it makes, then turn it into Python and carry on typing.

---

## A Step event in blocks

Open **Player**, press **Add event** and choose **Step**. Then press the **Blocks** tab above the code.

highlight: tab-blocks

```check
Player has event step
Player.step is written in blocks
```

---

## Move right

Build this from the blocks on the left:

- from **Logic**, an **if** block
- from **Input**, a **keyboard_check** block in the if's slot — choose **right**
- from **Motion**, **change x by 4** inside the if

highlight: blocks-workspace

```check
Player.step uses keyboard_check
after 1 second holding right, Player.x increased
```

---

## The Python it makes

Look beside the blocks: that's the Python your blocks make. The game only ever runs that Python.

```python
if keyboard_check("right"):
    self.x += 4
```

```quiz
When you build an event from blocks, what does the game run?
- [x] The Python the blocks make
- [ ] The blocks, one at a time
- [ ] The blocks first, then the Python
```

highlight: blocks-python

---

## Turn it into Python

Press the **Python** tab and say OK. From now on this event is Python.

```check
Player.step is written in python
```

---

## Now type the rest

Add moving left, in Python, under what's there:

```python
if keyboard_check("left"):
    self.x -= 4
```

```quiz
Why does moving left use `self.x -= 4`?
- [x] Taking away from x moves the player left
- [ ] -= makes the player move faster
- [ ] x can only go up, so -= turns the player around
```

```check
after 1 second holding left, Player.x decreased
game runs 2 seconds without errors
```

---

## Done

You've moved from blocks to Python. Anything blocks can do, Python can — and much more.
