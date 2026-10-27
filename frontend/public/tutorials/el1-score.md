---
title: 5. Score
level: Game Elements 1: The Basics
time: 15 min
starter: dodge-4
description: A point for every enemy dodged, the score and lives on screen, and a best score that's kept.
---
# Score

A **score** tells players how well they're doing, and gives them something to beat. In this game, every enemy that gets past you without hitting you is a point.

---

## Count the dodges

Open **Player**'s **Create** event and add:

```python
global_vars.score = 0
```

Then open **Enemy**'s **Step** event. Inside the `if`, where the enemy goes back to the right, add a line, pushed in like the lines above it:

```python
global_vars.score += 1
```

An enemy only gets back to the right by flying past the player. One that hits the player is sent back by the collision event instead, so it doesn't score.

highlight: code-editor

```check
Enemy.step uses score
after 8 seconds, global_vars.score >= 1
```

---

## On the screen

Make a new object called **Hud** (short for *heads-up display*), with no sprite, and drag one into the room. Give it a **Draw GUI** event: it draws on top of everything, in the window's own corner.

```python
draw_set_color("white")
draw_text(10, 10, f"Score: {global_vars.score}")
draw_text(10, 30, f"Lives: {global_vars.lives}")
```

highlight: add-objects

```check
object Hud exists
room Room1 has 1 Hud
Hud has event draw gui
Hud.draw gui uses draw_text
game runs 2 seconds without errors
```

---

## The best score

When the room restarts, the score goes back to 0. A **best** score should be kept. In **Player**'s **Create** event, add:

```python
if not hasattr(global_vars, "best"):
    global_vars.best = 0
```

That makes `best` only the very first time: `global_vars` stays the same when the room restarts. Then in **Enemy**'s **Step** event, under `global_vars.score += 1`:

```python
global_vars.best = max(global_vars.best, global_vars.score)
```

And show it in **Hud**'s **Draw GUI** event:

```python
draw_text(10, 50, f"Best: {global_vars.best}")
```

```check
Hud.draw gui uses best
after 8 seconds, global_vars.best >= 1
```

---

## Keeping score

The score counts your dodges, and the best one is kept.

Next: **6. Time Limit**.
