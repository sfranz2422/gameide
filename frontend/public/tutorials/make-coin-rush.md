---
title: Coin Rush
level: Now You Can Make
after: Getting Started
time: 35 min
starter: empty
description: A whole game from an empty one: grab as many coins as you can in thirty seconds.
---
# Coin Rush

You know sprites, objects, rooms, events and collisions now. That's enough to make a whole game, starting from nothing.

In **Coin Rush** a coin appears somewhere in the room. Grab it, and it jumps somewhere else. You have thirty seconds to grab as many as you can.

---

## The player

Press the **+** beside **Sprites** and pick the **player**.

Then press the **+** beside **Objects**, name it **Player**, and choose **player** in its **Sprite** box.

Open **Room1** and drag **Player** into the middle of the room.

highlight: add-sprites

```check
sprite player exists
object Player exists
Player has sprite
room Room1 has 1 Player
```

---

## Moving

Give **Player** a **Step** event:

```python
speed = 5
self.x += (keyboard_check("right") - keyboard_check("left")) * speed
self.y += (keyboard_check("down") - keyboard_check("up")) * speed
self.x = clamp(self.x, 0, room_width - 24)
self.y = clamp(self.y, 0, room_height - 24)
```

`clamp` keeps a number between two others, so the player can't walk off the screen. The player is 24 pixels wide, so its left edge stops 24 pixels before the right edge of the room.

```quiz
What does `clamp(700, 0, 616)` give?
answer: 616
```

highlight: add-event

```check
Player has event step
Player.step uses clamp
after 1 second holding right, Player.x increased
after 1 second holding up, Player.y decreased
```

---

## A coin

Add the **coin** sprite, then an object called **Coin** with that sprite. Drag **one** Coin into the room.

Give **Coin** a **Create** event. It puts the coin somewhere new each time the game starts:

```python
import random
self.x = random.randint(16, room_width - 16)
self.y = random.randint(16, room_height - 16)
```

`random.randint(16, room_width - 16)` is a whole number, different every time, at least 16 pixels from each edge.

highlight: add-objects

```check
object Coin exists
Coin has sprite
room Room1 has 1 Coin
Coin.create uses randint
```

---

## Grab it

Give **Player** a **Create** event, to start the score at nothing:

```python
global_vars.score = 0
```

Then add a **Collision with Coin** event to **Player**. The coin isn't destroyed: it jumps somewhere else, so there's always one to chase.

```python
import random
global_vars.score += 1
other.x = random.randint(16, room_width - 16)
other.y = random.randint(16, room_height - 16)
```

Play it and grab a few coins.

highlight: add-event

```check
Player has event create
Player.create uses score
Player has event collision with Coin
Player.collision with Coin uses randint
game runs 2 seconds without errors
```

---

## The score on screen

Make an object called **Hud**, with no sprite, and drag one into the room. Give it a **Draw GUI** event:

```python
draw_set_color("white")
draw_text(10, 10, f"Coins: {global_vars.score}")
```

````quiz
You've grabbed 7 coins. What does the Hud show?
```py
draw_text(10, 10, f"Coins: {global_vars.score}")
```
- [x] Coins: 7
- [ ] Coins: {global_vars.score}
- [ ] Coins: score
````

highlight: add-objects

```check
object Hud exists
room Room1 has 1 Hud
Hud has event draw gui
Hud.draw gui uses draw_text
```

---

## Thirty seconds

Give **Hud** a **Create** event. It starts the clock, and sets **alarm 0** to go off in 60 steps, which is one second:

```python
global_vars.time = 30
self.alarm[0] = 60
```

Add an **Alarm 0** event. Each second it takes one off the clock, then sets the alarm again, until the time is gone:

```python
if global_vars.time > 0:
    global_vars.time -= 1
    self.alarm[0] = 60
```

And show the time: add this line at the bottom of the **Draw GUI** event.

```python
draw_text(10, 30, f"Time: {global_vars.time}")
```

highlight: add-event

```check
Hud has event alarm 0
Hud.alarm 0 uses alarm
after 2 seconds, global_vars.time < 30
```

---

## Time's up

When the time runs out, the player stops, and Enter plays again. Add these lines at the **top** of **Player**'s **Step** event:

```python
if global_vars.time == 0:
    if keyboard_check_pressed("enter"):
        room_restart()
    return
```

`return` ends the event there: the lines under it, the ones that move the player, don't run.

`room_restart()` starts the room again from the beginning. Every Create event runs again, so the score is 0 and the clock is 30.

Then tell the player, at the bottom of **Hud**'s **Draw GUI** event:

```python
if global_vars.time == 0:
    draw_text(220, 220, "Time's up! Enter to play again")
```

```quiz
Why doesn't the player move once the time is 0?
- [x] `return` ends the Step event before the lines that move it
- [ ] `room_restart()` freezes the player
- [ ] The alarm stops the Step event
```

highlight: code-editor

```check
Player.step uses keyboard_check_pressed
Player.step uses room_restart
game runs 2 seconds without errors
```

---

## You made Coin Rush

That's a whole game, made from an empty one. Ideas to make it yours:

- Make the coins worth more as the clock runs down.
- Add a second kind of coin that gives you five extra seconds.
- Keep a best score: look at **6. End Screen** in **Game Elements 2** to see how.
