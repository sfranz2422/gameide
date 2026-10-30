---
title: Ledge Runner
level: Now You Can Make
after: el3-camera
time: 50 min
starter: empty
description: A whole platformer from an empty one: a level drawn as text, running and jumping, coins, crawlers to stomp, and a flag at the end.
---
# Ledge Runner

You've drawn a level as text, made a player run and jump on it, and a camera that follows. Now make a whole platformer of your own, from an empty one.

In **Ledge Runner** you run and jump across a level two screens wide, grab coins, stomp the crawlers or dodge them, and reach the flag at the far end. Fall down a gap and you start again.

---

## The level

Add the **wall** sprite and an object called **Wall** with it. Tick **Solid**: the player will stop at anything solid.

Open **Room1** and change its **Width** to **1280**, two screens wide.

Make an object called **Level**, with no sprite, and drag one into the room. Give it a **Create** event. Each row of the map is 40 characters, for the room's 40 columns of 32 pixels. For now only the `#`s become walls; the other letters come later.

```python
rows = [
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "..................c.....................",
    ".................###....................",
    ".............c..........................",
    "............###.........................",
    ".........c......................c.......",
    "........###....................###......",
    "....c..........c.........e..............",
    "...###........###..##########...........",
    "P.....c..e..................c.....e...F.",
    "##########..########.....###############",
]
for row in range(len(rows)):
    for col in range(len(rows[row])):
        if rows[row][col] == "#":
            instance_create(col * 32, row * 32, "Wall")
```

highlight: room-editor

```check
object Wall exists
object Level exists
room Room1 has 1 Level
room Room1 is at least 1280 wide
Level.create uses for
```

---

## The runner

Add the **player** sprite and an object called **Player** with it. Then add another choice inside the loop in **Level**'s **Create** event, under the Wall line, to make the player at the `P`:

```python
        elif rows[row][col] == "P":
            instance_create(col * 32 + 4, row * 32 + 8, "Player")
```

The player is 24 pixels square, so `+ 4` puts it in the middle of its column and `+ 8` stands it on the floor.

Give **Player** a **Create** event, for how fast it's falling:

```python
self.vy = 0
```

And a **Step** event: the running and the falling from **10. Platformer Tools**.

```python
move = keyboard_check("right") - keyboard_check("left")
move_and_collide(move * 3, 0)
self.vy += 0.5
if move_and_collide(0, self.vy):
    self.vy = 0
```

`move_and_collide` moves until something solid is in the way, and gives back what it bumped into. Bumping into something while falling means you've landed, so `vy` goes back to 0.

highlight: add-event

```check
Level.create uses elif
Player.step uses move_and_collide
after 1 second holding right, Player.x increased
```

---

## Jumping, and falling off

Add to the bottom of **Player**'s **Step** event:

```python
on_ground = not place_free(self.x, self.y + 1)
if on_ground and keyboard_check("up"):
    self.vy = -9
if self.vy < 0 and not keyboard_check("up"):
    self.vy = max(self.vy, -3)
if self.y > room_height:
    room_restart()
```

`place_free(self.x, self.y + 1)` asks: if the player were one pixel lower, would it be clear? If not, it's standing on something. Letting go of up early cuts the jump short, so a tap is a hop and holding is a leap. Fall below the room and it starts again.

```quiz
Why is the jump only allowed when `on_ground` is true?
- [x] Otherwise you could jump again in mid-air, and fly up the screen
- [ ] So the player falls faster
- [ ] `place_free` only works on the ground
```

highlight: code-editor

```check
Player.step uses place_free
Player.step uses room_restart
after 0.3 seconds holding up, Player.y decreased
```

---

## Follow the runner

Play it and run right: you go off the screen. Open **Room1**'s settings, tick **Camera**, leave it 640 by 480, and choose **Player** to **follow**.

highlight: room-camera

```check
room Room1 camera follows Player
```

---

## Coins

Add the **coin** sprite and an object called **Coin** with it. In **Level**'s loop, add a choice for the `c`s:

```python
        elif rows[row][col] == "c":
            instance_create(col * 32 + 16, row * 32 + 16, "Coin")
```

Add a line to **Player**'s **Create** event:

```python
global_vars.coins = 0
```

And a **Collision with Coin** event to **Player**:

```python
global_vars.coins += 1
other.destroy()
```

There are 8 `c`s in the map, so when you play, `instance_number("Coin")`, the number of coins, is 8.

highlight: add-event

```check
object Coin exists
Player has event collision with Coin
Player.collision with Coin uses coins
after 2 seconds, instance_number("Coin") == 8
```

---

## Crawlers

Add the **enemy** sprite and an object called **Crawler** with it. In **Level**'s loop, a choice for the `e`s:

```python
        elif rows[row][col] == "e":
            instance_create(col * 32 + 16, row * 32 + 20, "Crawler")
```

Give **Crawler** a **Create** event:

```python
self.hspeed = 1
```

And a **Step** event. It turns round at a wall, and at the edge of a drop, so it never walks off:

```python
ahead = self.x + sign(self.hspeed) * 14
if not place_free(ahead, self.y) or place_free(ahead, self.y + 16):
    self.hspeed = -self.hspeed
```

Then a **Collision with Crawler** event on **Player**. Land on top and you stomp it; run into it and you start again:

```python
if self.vy > 0 and self.y + 24 < other.y:
    other.destroy()
    self.vy = -6
else:
    room_restart()
```

`self.y + 24` is the player's feet. Feet above the crawler's middle, while falling, is a stomp.

```quiz
`place_free(ahead, self.y + 16)` is True. What has the crawler found?
- [x] The edge of a drop: there's no floor in front of it
- [ ] A wall in front of it
- [ ] The player
```

highlight: add-event

```check
object Crawler exists
Crawler.step uses place_free
Player has event collision with Crawler
after 2 seconds, Crawler.x changed
```

---

## The flag

Add the **flag** sprite and an object called **Flag** with it. In **Level**'s loop:

```python
        elif rows[row][col] == "F":
            instance_create(col * 32, row * 32, "Flag")
```

Add a **Collision with Flag** event to **Player**:

```python
global_vars.won = True
```

And start it as False, in **Player**'s **Create** event:

```python
global_vars.won = False
```

Once you've won, the runner stops and Enter plays again. Add these lines at the **top** of **Player**'s **Step** event:

```python
if global_vars.won:
    if keyboard_check_pressed("enter"):
        room_restart()
    return
```

highlight: add-event

```check
object Flag exists
Player has event collision with Flag
Player.create uses won
```

---

## Coins and the finish on screen

Make an object called **Hud**, with no sprite, and drag one into the room. Its **Draw GUI** event draws in the window's own corner, wherever the camera has gone:

```python
draw_set_color("white")
draw_text(10, 10, f"Coins: {global_vars.coins} of 8")
if global_vars.won:
    draw_text(220, 200, f"You made it with {global_vars.coins} coins!")
    draw_text(240, 220, "Enter to play again")
```

```quiz
Why does the Hud use a **Draw GUI** event, not a **Draw** event?
- [x] Draw GUI draws on the window, so the score stays in the corner when the camera moves
- [ ] Draw events can't draw text
- [ ] Draw GUI runs faster
```

highlight: add-objects

```check
object Hud exists
room Room1 has 1 Hud
Hud.draw gui uses draw_text
```

---

## You made Ledge Runner

Ideas to make it yours:

- A second level: another room, another map, and the flag goes there with `room_goto`.
- Springs: a new letter for a block that throws you up with `self.vy = -14`.
- Lives, so a fall costs one instead of starting again.
