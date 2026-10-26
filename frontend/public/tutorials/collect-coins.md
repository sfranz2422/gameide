---
title: Collect the Coins
level: Getting Started
time: 20 min
starter: coins-start
description: Touch a coin to collect it, keep score, and show it on screen.
---
# Collect the coins

This game has a maze, coins, and a player who moves with the arrow keys. Press **Play** and try it: the coins don't do anything yet.

You'll make the coins disappear when the player touches them, count them, and show the score.

---

## Touching a coin

Open **Player**, press **Add event**, and under **Collision with** choose **Coin**.

This event runs when the player touches a coin. `other` is the coin it touched. Type:

```python
other.destroy()
```

highlight: add-event

```check
Player has event collision with Coin
Player.collision with Coin uses destroy
after 1 second holding right, instance_number("Coin") < 15
```

---

## Keep score

A **global variable** is one every object can see. Start the score at 0 in Player's **Create** event — add this line under what's there:

```python
global_vars.score = 0
```

Then in the **Collision with Coin** event, under `other.destroy()`:

```python
global_vars.score += 1
```

```check
Player.create uses global_vars
after 1 second holding right, global_vars.score >= 1
```

---

## Show the score

Make a new object called **Hud** (no sprite) and drag it into the room. Give it a **Draw GUI** event — it draws on top of everything:

```python
draw_set_color("white")
draw_text(8, 452, f"Coins: {global_vars.score}")
```

highlight: add-objects

```check
object Hud exists
Hud has event draw gui
Hud.draw gui uses draw_text
room Maze has 1 Hud
game runs 2 seconds without errors
```

---

## A sound

The game already has a **coin** sound. In the **Collision with Coin** event, add:

```python
sound_play("coin")
```

```check
Player.collision with Coin uses sound_play
```

---

## Done

Play it and collect them all. Ideas:

- Show "You got them all!" when `not instance_exists("Coin")`.
- Make some coins worth 5.
