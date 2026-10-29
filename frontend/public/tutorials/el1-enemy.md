---
title: 3. Enemy
level: Game Elements 1: The Basics
time: 12 min
starter: dodge-2
description: Enemies that fly across the screen, come back round at a random height, each at its own speed.
---
# Enemy

A game needs something to beat. This game has an **Enemy** object ready, with its sprite, but there are none in the room yet and they don't move.

---

## Fly left

Open **Enemy**, press **Add event** and choose **Create**. Create runs once, when an enemy appears. Type:

```python
self.hspeed = -3
```

`hspeed` is how far it moves across every step, all by itself. Minus is to the left.

Then open **Room1** and drag three enemies from the list into the room, near its right-hand side.

```quiz
What does `self.hspeed = -3` do?
- [x] Moves the enemy 3 pixels to the left every step, all by itself
- [ ] Moves the enemy 3 pixels to the left once
- [ ] Moves the enemy 3 pixels to the right every step
```

highlight: add-event

```check
Enemy has event create
room Room1 has at least 3 Enemy
after 1 second, Enemy.x decreased
```

---

## Come back round

Play it: the enemies fly off the left, and that's the end of them. Give **Enemy** a **Step** event:

```python
import random
if self.x < -12:
    self.x = room_width + 12
    self.y = random.randint(12, room_height - 12)
```

Once an enemy is off the left edge, it jumps back to just past the right edge, at a random height. `random.randint(a, b)` is a whole number from `a` to `b`, different every time.

```check
Enemy.step uses randint
game runs 8 seconds without errors
```

---

## Every one different

They all fly at the same speed, which is a bit dull. In **Enemy**'s **Create** event, change the speed to a random one:

```python
import random
self.hspeed = -random.randint(2, 5)
```

Each enemy picks its own speed as it appears.

```quiz
Which of these can `random.randint(2, 5)` never give?
- [ ] 2
- [ ] 3
- [ ] 5
- [x] 6
```

highlight: code-editor

```check
Enemy.create uses randint
game runs 2 seconds without errors
```

---

## Your turn: anywhere

The enemies still start at the heights you put them. In **Enemy**'s **Create** event, add a line that gives each one a random height as it appears too, just like the one in the Step event: a random `self.y` between the top and `room_height`.

```check
Enemy.create uses room_height
game runs 2 seconds without errors
```

---

## Enemies!

Your enemies fly across, come back round and never stop. But they fly straight through the player.

Next: **4. Collisions**.
