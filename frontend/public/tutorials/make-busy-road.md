---
title: Busy Road
level: Now You Can Make
after: Game Elements 1: The Basics
time: 45 min
starter: empty
description: A whole game from an empty one: hop across lanes of traffic, one square at a time, without getting squashed.
---
# Busy Road

You've made a player, enemies, collisions, a score and lives. Now make a whole game of your own, from an empty one.

In **Busy Road** you hop across a road full of cars, one square at a time. Each lane's traffic goes its own way at its own speed. Every time you get across is a point, and every car that hits you is a life.

The room is a grid of 32-pixel squares: 20 across and 15 down. You start on the bottom row and cross to the top one.

---

## The hopper

Add the **player** sprite and an object called **Player** with it. Open **Room1** and drag **Player** onto the bottom row.

Give **Player** a **Step** event. `keyboard_check_pressed` is only true on the step a key goes down, so each press is one hop of one square:

```python
if keyboard_check_pressed("up"):
    self.y -= 32
if keyboard_check_pressed("down"):
    self.y += 32
if keyboard_check_pressed("left"):
    self.x -= 32
if keyboard_check_pressed("right"):
    self.x += 32
self.x = clamp(self.x, 4, room_width - 28)
self.y = clamp(self.y, 4, room_height - 28)
```

highlight: add-sprites

```check
object Player exists
Player has sprite
room Room1 has 1 Player
Player.step uses keyboard_check_pressed
after 1 second holding up, Player.y decreased
```

---

## Cars

Add the **car** sprite and an object called **Car** with it. Give **Car** a **Create** event, so it drives:

```python
self.hspeed = 2
```

And a **Step** event: a car that drives off one side comes back on the other.

```python
if self.x > room_width + 20:
    self.x = -20
if self.x < -20:
    self.x = room_width + 20
```

Now drag cars into the room: at least six, in the rows between the top and the bottom. Leave the top two rows and the bottom row clear. Put two or three cars in some lanes, with gaps to hop through.

highlight: add-objects

```check
object Car exists
Car has sprite
Car.step uses room_width
room Room1 has at least 6 Car
```

---

## Every lane its own way

Every car goes the same way at the same speed. Real roads aren't like that. Change **Car**'s **Create** event to:

```python
lane = self.y // 32
self.hspeed = 1 + lane % 3
if lane % 2 == 0:
    self.hspeed = -self.hspeed
self.image_xscale = sign(self.hspeed)
```

`self.y // 32` is which row the car is in: `//` divides and throws away the remainder. `lane % 3` is the remainder after dividing by 3, so the speeds go 1, 2, 3, 1, 2, 3 down the road. Even lanes go left. `image_xscale` set to -1 flips the picture, so the car faces the way it drives.

```quiz
A car is in lane 7. What is its `hspeed`?
- [x] 2, to the right (7 % 3 is 1, and 7 is odd)
- [ ] -2, to the left
- [ ] 7
```

highlight: code-editor

```check
Car.create uses lane
Car.create uses image_xscale
game runs 2 seconds without errors
```

---

## Squashed

Give **Player** a **Create** event. It keeps where the player started, and the score and lives:

```python
self.start_x = self.x
self.start_y = self.y
global_vars.score = 0
global_vars.lives = 3
```

Add a **Collision with Car** event to **Player**. A car sends you back to the start:

```python
global_vars.lives -= 1
self.flash("red", 12)
self.x = self.start_x
self.y = self.start_y
```

highlight: add-event

```check
Player has event create
Player.create uses start_x
Player has event collision with Car
Player.collision with Car uses lives
```

---

## Across

At the bottom of **Player**'s **Step** event, check whether you made it to the top row. If you did, it's a point, and back to the start for another go:

```python
if self.y < 32:
    global_vars.score += 1
    self.x = self.start_x
    self.y = self.start_y
```

```quiz
Why does the player go back to `start_x` and `start_y` after a point, and not to the bottom of the screen?
- [x] So it starts exactly where you put it in the room, on its square
- [ ] Because `start_x` is faster
- [ ] Because the bottom of the screen is off the grid
```

highlight: code-editor

```check
Player.step uses score
game runs 2 seconds without errors
```

---

## Score and lives

Make an object called **Hud**, with no sprite, and drag one into the room. Give it a **Draw GUI** event:

```python
draw_set_color("white")
draw_text(10, 4, f"Crossed: {global_vars.score}   Lives: {global_vars.lives}")
```

highlight: add-objects

```check
object Hud exists
room Room1 has 1 Hud
Hud.draw gui uses draw_text
```

---

## Game over

When the lives are gone, the player stops and Enter plays again. Add these lines at the **top** of **Player**'s **Step** event:

```python
if global_vars.lives <= 0:
    if keyboard_check_pressed("enter"):
        room_restart()
    return
```

And at the bottom of **Hud**'s **Draw GUI** event:

```python
if global_vars.lives <= 0:
    draw_text(240, 220, "Squashed! Enter to play again")
```

highlight: code-editor

```check
Player.step uses room_restart
game runs 2 seconds without errors
```

---

## Rush hour

Each time you get across, the traffic should get a little faster. Add this line at the bottom of **Car**'s **Step** event:

```python
self.x += self.hspeed * global_vars.score / 5
```

The car already moves `hspeed` pixels a step by itself. This adds a fifth more for every crossing.

```quiz
You've crossed 5 times. How fast is a car whose `hspeed` is 2 going now, in pixels a step?
answer: 4
```

highlight: code-editor

```check
Car.step uses score
game runs 2 seconds without errors
```

---

## You made Busy Road

Ideas to make it yours:

- A grass strip halfway, with no cars, to rest on.
- Logs on a river that carry you along instead of squashing you.
- A coin on the far side worth an extra point.
