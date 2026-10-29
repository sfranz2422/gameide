---
title: 4. Increasing Difficulty
level: Game Elements 2: Adding to the Fun
time: 12 min
starter: dodge2-3
description: Enemies that speed up every time they come round — up to a limit — and more of them as time goes on.
---
# Increasing Difficulty

A game that's the same at the end as at the start gets boring. Good games get **harder** as you get better.

---

## Faster every time

Open **Enemy**'s **Step** event. Inside the `if`, where the enemy goes back to the right, add one more line at the end:

```python
    self.hspeed -= 0.5
```

Each time an enemy comes round, it's half a pixel a step faster. `hspeed` is negative because it moves left, so taking away makes it faster.

highlight: code-editor

```check
Enemy.step uses hspeed
game runs 2 seconds without errors
```

---

## Not too fast

After a few minutes the enemies would be too fast to see. Add a line under the last one, to cap their speed:

```python
    self.hspeed = max(self.hspeed, -12)
```

`max` gives back the bigger of two numbers. -12 is bigger than -13, so once an enemy reaches -12 it can't get any faster.

```quiz
An enemy's `hspeed` has reached -12.5. What does `max(self.hspeed, -12)` give back?
answer: -12
answer: minus 12
```

```check
Enemy.step uses -12
game runs 2 seconds without errors
```

---

## More of them

Every 5 seconds, a new enemy. In **Hud**'s **Create** event, add:

```python
self.alarm[1] = 300
```

Then give **Hud** an **Alarm 1** event:

```python
instance_create(room_width + 12, room_height / 2, "Enemy")
self.alarm[1] = 300
```

Each one picks its own speed and height in its Create event, just like the ones in the room.

```quiz
Why does the **Alarm 1** event set `self.alarm[1] = 300` again at its end?
- [x] So another enemy comes 5 seconds later, and another after that
- [ ] To make the new enemy move faster
- [ ] It doesn't need to: an alarm goes off again by itself
```

```check
Hud has event alarm 1
Hud.alarm 1 uses instance_create
game runs 2 seconds without errors
```

---

## Your turn: fair's fair

More enemies is hard. Make each new one bring 5 more seconds on the clock too: in **Hud**'s **Alarm 1** event, add 5 to `global_vars.time_left`.

```check
Hud.alarm 1 uses time_left
game runs 2 seconds without errors
```

---

## A real challenge

The game now starts easy and gets harder. Play it, and change the numbers until it feels right: that's called **balancing** a game.

Next: **5. Multiplayer**.
