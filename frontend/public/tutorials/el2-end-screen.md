---
title: 6. End Screen
level: Game Elements 2: Adding to the Fun
time: 15 min
starter: dodge2-5
description: A game-over room with the final score, back to the title from there, and a best score that's saved.
---
# End Screen

When the game ends, it should say so properly: a screen of its own with the score, and a way back to the start.

---

## A game-over room

Make a new room called **GameOver**. Leave it below Room1 in the list. Make an object called **EndScreen**, with no sprite, and drag one into **GameOver**. Give it a **Draw GUI** event:

```python
draw_set_color("white")
draw_set_halign("center")
draw_text(320, 160, "GAME OVER")
draw_text(320, 220, f"Score: {global_vars.score}")
draw_text(320, 250, f"Best: {global_vars.best}")
draw_text(320, 320, "Press Space to play again")
```

and a **Step** event:

```python
if keyboard_check_pressed("space"):
    room_goto("Title")
```

highlight: folder-rooms

```check
room GameOver exists
object EndScreen exists
room GameOver has 1 EndScreen
EndScreen.step uses room_goto
```

---

## Go there

Now send the game there when it ends. In **Hud**'s **Alarm 0** event, change the `else` so it goes to the new room instead of pausing:

```python
else:
    room_goto("GameOver")
```

And in **Player**'s **Collision with Enemy** event, when the lives run out:

```python
if global_vars.lives <= 0:
    room_goto("GameOver")
```

```check
Hud.alarm 0 uses room_goto
Player.collision with Enemy uses room_goto
game runs 2 seconds without errors
```

---

## Tidy up

The old "Time's up!" code isn't needed now. In **Hud**:

- delete the **Step** event (the bin beside it in the list)
- in **Create**, delete the `game_over` and `ignore_pause` lines
- in **Draw GUI**, delete the `if global_vars.game_over:` lines at the end

```check
Hud avoids game_over
Hud avoids game_pause
game runs 2 seconds without errors
```

---

## Saved for next time

The best score is forgotten when the page closes. `save_set` keeps a value in the browser for next time, and `save_get` reads it back.

In **EndScreen**, add a **Create** event:

```python
save_set("best", global_vars.best)
```

And in **Player**'s **Create** event, start `best` from the saved one:

```python
if not hasattr(global_vars, "best"):
    global_vars.best = save_get("best", 0)
```

`save_get("best", 0)` gives 0 when nothing's been saved yet.

```check
EndScreen.create uses save_set
Player.create uses save_get
game runs 2 seconds without errors
```

---

## Start to finish

Your game has a title, coins, bullets, enemies that get faster, two players, and a game-over screen with a best score that lasts. That's a whole game, beginning to end.

Next: **Game Elements 3: Advanced Techniques**.
