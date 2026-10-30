---
title: Bomb Dodge
level: Now You Can Make
after: el2-difficulty
time: 40 min
starter: empty
description: A whole game from an empty one: bombs rain down faster and faster, and you dodge them for as long as you can.
---
# Bomb Dodge

You've made a player, collisions, a score, lives, alarms, and a spawner that makes enemies faster and faster. Now put them together into a game of your own, from an empty one.

In **Bomb Dodge**, bombs fall from the sky. Every bomb you dodge is a point, every bomb that hits you is a life, and the bombs come faster the better you do.

---

## The player

Add the **player** sprite and an object called **Player** with it. Open **Room1** and drag **Player** to the bottom middle of the room.

Give **Player** a **Step** event. The player only goes left and right:

```python
self.x += (keyboard_check("right") - keyboard_check("left")) * 6
self.x = clamp(self.x, 0, room_width - 24)
```

highlight: add-sprites

```check
object Player exists
Player has sprite
room Room1 has 1 Player
Player.step uses clamp
after 1 second holding left, Player.x decreased
```

---

## A bomb

Add the **bomb** sprite, and an object called **Bomb** with it. Don't put any bombs in the room: the game will make them.

Give **Bomb** a **Create** event:

```python
self.vspeed = 3
```

`vspeed` is how far an instance moves down by itself, every step. A bomb with a `vspeed` of 3 falls without any more code.

highlight: add-objects

```check
object Bomb exists
Bomb has sprite
Bomb.create uses vspeed
```

---

## Where bombs come from

Make an object called **Spawner**, with no sprite, and drag one into the room. Its **Create** event sets an alarm:

```python
self.alarm[0] = 30
```

Its **Alarm 0** event makes a bomb just above the top of the room, at a random place across, then sets the alarm again:

```python
import random
instance_create(random.randint(8, room_width - 8), -10, "Bomb")
self.alarm[0] = 30
```

Play it. After a few seconds, `instance_number("Bomb")`, the number of bombs, is more than one.

```quiz
`self.alarm[0] = 30`. How often does the Spawner make a bomb?
- [x] Every half a second (30 steps, at 60 steps a second)
- [ ] Every 30 seconds
- [ ] 30 bombs at once
```

highlight: add-event

```check
room Room1 has 1 Spawner
Spawner has event alarm 0
Spawner.alarm 0 uses instance_create
after 3 seconds, instance_number("Bomb") >= 2
```

---

## Dodged

Give **Player** a **Create** event, for the score and the lives:

```python
global_vars.score = 0
global_vars.lives = 3
```

A bomb that falls out of the bottom of the room was dodged. Give **Bomb** a **Step** event:

```python
if self.y > room_height:
    global_vars.score += 1
    self.destroy()
```

`destroy()` takes it out of the game. Without it, every bomb would keep falling forever, far below the room.

highlight: add-event

```check
Player.create uses lives
Bomb has event step
Bomb.step uses destroy
after 4 seconds, global_vars.score >= 1
```

---

## Hit

Add a **Collision with Bomb** event to **Player**:

```python
other.destroy()
global_vars.lives -= 1
self.flash("white", 10)
```

The bomb is destroyed, so it can only hit once. `self.flash("white", 10)` makes the player flash white for 10 steps, so you can see you were hit.

highlight: add-event

```check
Player has event collision with Bomb
Player.collision with Bomb uses lives
Player.collision with Bomb uses flash
```

---

## Score and lives

Make an object called **Hud**, with no sprite, and drag one into the room. Give it a **Draw GUI** event:

```python
draw_set_color("white")
draw_text(10, 10, f"Dodged: {global_vars.score}")
draw_text(10, 30, f"Lives: {global_vars.lives}")
```

```quiz
Which one of these shows the lives?
- [x] `draw_text(10, 30, f"Lives: {global_vars.lives}")`
- [ ] `draw_text(10, 30, "Lives: {global_vars.lives}")`
- [ ] `draw_text(10, 30, f"Lives: lives")`
```

highlight: add-objects

```check
object Hud exists
room Room1 has 1 Hud
Hud.draw gui uses draw_text
```

---

## Game over

When the lives are gone, the game stops and Enter plays again. Add these lines at the **top** of **Player**'s **Step** event:

```python
if global_vars.lives <= 0:
    if keyboard_check_pressed("enter"):
        room_restart()
    return
```

The bombs should stop too. In **Spawner**'s **Alarm 0** event, put the line that makes a bomb inside an `if`:

```python
if global_vars.lives > 0:
    instance_create(random.randint(8, room_width - 8), -10, "Bomb")
```

And say so, at the bottom of **Hud**'s **Draw GUI** event:

```python
if global_vars.lives <= 0:
    draw_text(250, 220, "Game over! Enter to play again")
```

highlight: code-editor

```check
Player.step uses room_restart
Player.step uses keyboard_check_pressed
game runs 3 seconds without errors
```

---

## Faster and faster

It's too easy. The better you do, the faster the bombs should come.

In **Spawner**'s **Alarm 0** event, change the last line, `self.alarm[0] = 30`, to:

```python
self.alarm[0] = max(8, 30 - global_vars.score)
```

Every bomb you dodge takes a step off the wait, but never below 8 steps. And in **Bomb**'s **Create** event, change the speed to:

```python
self.vspeed = 3 + global_vars.score / 10
```

```quiz
You've dodged 25 bombs. How many steps is the wait now, `max(8, 30 - 25)`?
answer: 8
```

highlight: code-editor

```check
Spawner.alarm 0 uses max
Bomb.create uses score
game runs 3 seconds without errors
```

---

## You made Bomb Dodge

Ideas to make it yours:

- A heart that falls now and then, and gives a life back.
- A best score that's kept between games.
- Bombs that drift sideways as they fall: give them an `hspeed` too.
