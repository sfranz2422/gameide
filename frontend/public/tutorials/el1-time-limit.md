---
title: 6. Time Limit
level: Game Elements 1: The Basics
time: 15 min
starter: dodge-5
description: A 30-second countdown with an alarm, "Time's up!", and Space to play again.
---
# Time Limit

A **time limit** turns a game into a challenge: how many can you dodge in 30 seconds?

GameIDE's **alarms** count down steps for you. Set `self.alarm[0] = 60`, and 60 steps later (one second) the **Alarm 0** event runs.

---

## Counting down

Open **Hud**, add a **Create** event and type:

```python
global_vars.time_left = 30
self.alarm[0] = 60
```

Now add an **Alarm 0** event. It runs a second later, takes a second off, and sets the alarm again, so it runs every second:

```python
global_vars.time_left -= 1
if global_vars.time_left > 0:
    self.alarm[0] = 60
```

And show it in the **Draw GUI** event:

```python
draw_text(10, 70, f"Time: {global_vars.time_left}")
```

```quiz
Why does the Alarm 0 event set `self.alarm[0] = 60` again?
- [x] So it runs again a second later, every second
- [ ] So the time goes back to 60
- [ ] So the alarm stops
```

highlight: add-event

```check
Hud has event alarm 0
after 2 seconds, global_vars.time_left in (27, 28)
```

---

## Time's up

When the time reaches 0, the game stops. In **Hud**'s **Create** event, add:

```python
global_vars.game_over = False
```

In the **Alarm 0** event, add an `else` under the `if`, not pushed in:

```python
else:
    global_vars.game_over = True
    game_pause()
```

`game_pause()` stops everything moving. And in **Draw GUI**, show the message:

```python
if global_vars.game_over:
    draw_text(260, 220, "Time's up!")
```

```check
Hud.alarm 0 uses game_pause
Hud.draw gui uses game_over
game runs 2 seconds without errors
```

---

## Play again

While the game is paused, nothing runs, so pressing a key does nothing. Unless an object **ignores the pause**. In **Hud**'s **Create** event, add:

```python
self.ignore_pause = True
```

Then give **Hud** a **Step** event:

```python
if global_vars.game_over and keyboard_check_pressed("space"):
    game_pause(False)
    room_restart()
```

`game_pause(False)` lets everything move again, and `room_restart()` starts the room over: the time, the score and the lives go back to how they began. The best score is kept, because `global_vars` stays the same when the room restarts.

```quiz
Why does Hud need `self.ignore_pause = True`?
- [x] While the game is paused nothing runs, so Hud's Step couldn't notice Space
- [ ] Without it the game can't be paused
- [ ] It makes the "Time's up!" message show
```

```check
Hud.create uses ignore_pause
Hud has event step
Hud.step uses room_restart
```

---

## Your turn: the final score

Change the "Time's up!" message so it says the score too, like **Time's up! You scored 12**. An f-string will help.

```check
Hud.draw gui uses scored
game runs 2 seconds without errors
```

---

## A whole game

You've made a complete game: a player, enemies, crashes, lives, a score, a best score and a time limit. Those are the basics almost every game is built from.

Play it, and change things: the speeds, the time, the number of enemies. Then try **Game Elements 2: Adding to the Fun**.
