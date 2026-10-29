---
title: 7. Pause Menu
level: Game Elements 3: Advanced Techniques
time: 15 min
starter: space-6
description: P pauses the game; a menu of choices from a list, picked with the arrow keys and Enter.
---
# Pause Menu

A **pause menu** stops the game and offers some choices. The trick is that while everything else is paused, the menu itself has to keep running.

---

## Pause

Make an object called **Menu**, with no sprite, and drag one into the room. Give it a **Create** event:

```python
self.ignore_pause = True
```

and a **Step** event:

```python
if keyboard_check_pressed("p"):
    game_pause(not game_paused())
```

`game_paused()` is True while the game is paused, so `not game_paused()` is the opposite: P pauses, and P again carries on. `ignore_pause` keeps the Menu running while everything else stops.

```quiz
What would go wrong without `self.ignore_pause = True`?
- [ ] The game would never pause
- [x] The Menu would stop too, so pressing P again couldn't carry on
- [ ] The game would pause and carry on every step
```

highlight: add-objects

```check
object Menu exists
room Room1 has 1 Menu
Menu.create uses ignore_pause
after 1 second holding p, game_paused()
```

---

## Show it

Give **Menu** a **Draw GUI** event:

```python
if game_paused():
    draw_set_alpha(0.6)
    draw_set_color("black")
    draw_rect(0, 0, 640, 480)
    draw_set_alpha(1)
    draw_set_color("white")
    draw_set_halign("center")
    draw_text(320, 150, "PAUSED")
```

`draw_set_alpha(0.6)` makes the black box see-through, so the frozen game shows dimly behind.

```check
Menu has event draw gui
Menu.draw gui uses game_paused
game runs 2 seconds without errors
```

---

## Choices in a list

The menu's choices are a **list**, and `choice` is which one is picked. Add to **Menu**'s **Create** event:

```python
self.options = ["Resume", "Restart"]
self.choice = 0
```

Draw them with a loop, the picked one in yellow. Add inside the `if` in **Draw GUI**:

```python
    for i in range(len(self.options)):
        if i == self.choice:
            draw_set_color("yellow")
        else:
            draw_set_color("white")
        draw_text(320, 220 + i * 30, self.options[i])
```

And move the choice with the arrow keys. Add to the **Step** event:

```python
if game_paused():
    if keyboard_check_pressed("down"):
        self.choice = (self.choice + 1) % len(self.options)
    if keyboard_check_pressed("up"):
        self.choice = (self.choice - 1) % len(self.options)
```

`% len(self.options)` wraps round: down from the last choice goes back to the first.

```quiz
There are two options, `self.choice` is 1, and you press Down. What is `self.choice` now?
answer: 0
answer: zero
```

```check
Menu.create uses options
Menu.draw gui uses for
game runs 2 seconds without errors
```

---

## Pick one

Add inside the last `if game_paused():` in the **Step** event:

```python
    if keyboard_check_pressed("enter"):
        game_pause(False)
        if self.options[self.choice] == "Restart":
            room_restart()
```

```check
Menu.step uses enter
game runs 2 seconds without errors
```

---

## Your turn: Escape

Lots of players expect **Escape** to pause a game. Make Escape do the same as P. Its name in code is `"escape"`.

```check
Menu.step uses escape
game runs 2 seconds without errors
```

---

## Paused

A menu that runs while the game doesn't, with choices kept in a list. Add more choices to the list and the loop draws them all.

Next: **8. Button Click and Tap**.
