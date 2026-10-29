---
title: 2. Collecting
level: Game Elements 2: Adding to the Fun
time: 15 min
starter: dodge2-1
description: Coins worth 5 points that turn up somewhere new, and your first function in a script of its own.
---
# Collecting

Dodging is only half the fun. Something to **collect** gives the player a reason to move around. You'll add a coin worth 5 points that turns up somewhere new each time it's picked up.

---

## A coin

The game has a **coin** sprite ready. Make an object called **Coin** with that sprite, and drag one into **Room1**. Give it a **Create** event that puts it somewhere random:

```python
import random
self.x = random.randint(40, room_width - 40)
self.y = random.randint(40, room_height - 40)
```

The 40s keep it away from the edges, where it would be hard to reach.

highlight: add-objects

```check
object Coin exists
Coin has sprite
room Room1 has at least 1 Coin
Coin.create uses randint
```

---

## Pick it up

Open **Player**, press **Add event**, and under **Collision with** choose **Coin**:

```python
import random
global_vars.score += 5
global_vars.best = max(global_vars.best, global_vars.score)
other.x = random.randint(40, room_width - 40)
other.y = random.randint(40, room_height - 40)
```

The coin isn't destroyed: it jumps somewhere new, so there's always one to chase.

```quiz
Why does this event set `other.x`, and not `self.x`?
- [x] `other` is the coin; `self.x` would move the player
- [ ] `self` is the coin in a collision event
- [ ] `other.x` moves every coin in the room
```

```check
Player has event collision with Coin
Player.collision with Coin uses score
game runs 2 seconds without errors
```

---

## Write it once

The same two lines that pick a random place are now in two events. When the same code is needed in two places, make it a **function**, written once.

Press the **+** beside **Scripts** and call the script **places**. A script holds functions every object can use. Type:

```python
import random


def move_to_random_place(thing):
    thing.x = random.randint(40, room_width - 40)
    thing.y = random.randint(40, room_height - 40)
```

Now use it. Change **Coin**'s **Create** event to just:

```python
move_to_random_place(self)
```

And in **Player**'s **Collision with Coin** event, replace the `import` and the two `random` lines with:

```python
move_to_random_place(other)
```

`thing` is whatever you pass in: the coin itself, or `other`, the coin the player touched.

```quiz
In Player's **Collision with Coin** event, `move_to_random_place(other)` runs. Inside the function, what is `thing`?
- [x] The coin the player touched
- [ ] The player
- [ ] Every coin in the room
```

highlight: folder-scripts

```check
script places exists
Coin.create uses move_to_random_place
Player.collision with Coin uses move_to_random_place
game runs 2 seconds without errors
```

---

## Your turn: more time

Make picking up a coin give the player one more second on the clock. You'll need `global_vars.time_left`.

```check
Player.collision with Coin uses time_left
game runs 2 seconds without errors
```

---

## Collect them all

Coins to chase, worth more than a dodge, and a function you wrote once and used twice.

Next: **3. Projectile**.
