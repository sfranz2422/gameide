---
title: 4. Collisions
level: Game Elements 1: The Basics
time: 12 min
starter: dodge-3
description: When the player touches an enemy, lose a life — and when the lives run out, start again.
---
# Collisions

A **collision** is two things touching. GameIDE notices when they do and runs a **collision event**, where you say what should happen.

---

## Lives, and losing one

The player needs lives. Open **Player**, add a **Create** event, and type:

```python
global_vars.lives = 3
```

`global_vars` holds things every object can see. The score and the lives belong there.

Now press **Add event** again, and under **Collision with** choose **Enemy**. Type:

```python
global_vars.lives -= 1
other.x = room_width + 12
```

`other` is the enemy the player touched. Sending it back to the right means it can't take a second life on the very next step.

highlight: add-event

```check
Player has event create
Player has event collision with Enemy
Player.collision with Enemy uses lives
after 1 second, global_vars.lives <= 3
```

---

## Out of lives

When the lives run out, the game starts again. Add to the collision event:

```python
if global_vars.lives <= 0:
    room_restart()
```

`room_restart()` builds the room again from the start: the player back at the start, and its Create event giving it 3 lives again.

```check
Player.collision with Enemy uses room_restart
game runs 2 seconds without errors
```

---

## Show it

Getting hit should feel like something happened. Add one more line to the collision event:

```python
self.flash("white", 10)
```

The player shows as solid white for 10 steps. Play it and fly into an enemy.

```check
Player.collision with Enemy uses flash
game runs 2 seconds without errors
```

---

## Ouch

Enemies hurt now, and three hits starts the game again. But you can't see how many lives are left.

Next: **5. Score**.
