---
title: Crypt of Keys
level: Now You Can Make
after: el3-strike
time: 55 min
starter: empty
description: A whole top-down adventure from an empty one: find keys to open locked doors, fight slimes with a sword, and escape with the gem.
---
# Crypt of Keys

You've drawn levels as text, made a strike that hits what's in front of you, and health that runs down. Now make a top-down adventure of your own, from an empty one.

In **Crypt of Keys** you're shut in an old crypt, seen from above. Each locked door needs a key, and the keys are guarded by slimes. Fight your way through with your sword, and grab the gem in the last room to escape.

---

## The crypt

Add the **wall** sprite and an object called **Wall** with it, and tick **Solid**.

Make an object called **Level**, with no sprite, and drag one into **Room1**. Give it a **Create** event: the crypt as a map, 20 by 15. Only the `#`s become walls for now.

```python
rows = [
    "####################",
    "#......#......#....#",
    "#.P....#...s..#..G.#",
    "#......#......#....#",
    "#......D......D....#",
    "#..k...#......#....#",
    "#......#......#.s..#",
    "#......#......#....#",
    "#......#......#....#",
    "##########.#########",
    "#..................#",
    "#.........k........#",
    "#...s..........s...#",
    "#..................#",
    "####################",
]
for row in range(len(rows)):
    for col in range(len(rows[row])):
        if rows[row][col] == "#":
            instance_create(col * 32, row * 32, "Wall")
```

There are three rooms along the top, with a locked door `D` between each, and a hall underneath the middle one.

highlight: add-objects

```check
object Wall exists
room Room1 has 1 Level
Level.create uses for
```

---

## The explorer

Add the **player** sprite and an object called **Player** with it. In **Level**'s loop, under the Wall line:

```python
        elif rows[row][col] == "P":
            instance_create(col * 32 + 4, row * 32 + 4, "Player")
```

Give **Player** a **Create** event. `face_x` and `face_y` are the way it's facing, which the sword will need:

```python
self.face_x = 1
self.face_y = 0
```

And a **Step** event. Seen from above there's no falling, just walking in four directions, stopped by walls:

```python
speed = 3
dx = (keyboard_check("right") - keyboard_check("left")) * speed
dy = (keyboard_check("down") - keyboard_check("up")) * speed
move_and_collide(dx, 0)
move_and_collide(0, dy)
if dx != 0 or dy != 0:
    self.face_x = sign(dx)
    self.face_y = sign(dy)
```

Moving across and down separately means that walking into a wall at an angle slides you along it, instead of sticking.

highlight: add-event

```check
Level.create uses elif
Player.step uses move_and_collide
after 1 second holding right, Player.x increased
after 1 second holding down, Player.y increased
```

---

## Keys and doors

Add the **key** sprite and an object called **Key**, and the **door** sprite and an object called **Door**. Tick **Solid** for Door. In **Level**'s loop:

```python
        elif rows[row][col] == "k":
            instance_create(col * 32 + 16, row * 32 + 16, "Key")
        elif rows[row][col] == "D":
            instance_create(col * 32, row * 32, "Door")
```

Add a line to **Player**'s **Create** event:

```python
global_vars.keys = 0
```

A **Collision with Key** event on **Player** picks one up:

```python
global_vars.keys += 1
other.destroy()
```

A door is solid, so you never touch it: you stop beside it. So the player opens the nearest door when it's close enough, if there's a key to open it with. Add to the bottom of **Player**'s **Step** event:

```python
door = instance_nearest(self.x, self.y, "Door")
if door and global_vars.keys > 0 and point_distance(self.x + 12, self.y + 12, door.x + 16, door.y + 16) < 40:
    door.destroy()
    global_vars.keys -= 1
```

`self.x + 12` is the middle of the player, and `door.x + 16` the middle of the door: from middle to middle, they're 28 pixels apart when they touch.

Play it: there are two doors in the map, so `instance_number("Door")`, the number of doors, is 2 until you open one.

```quiz
You walk up to a door with no keys. What happens?
- [x] Nothing: you stop beside it, because it's solid and `global_vars.keys > 0` is False
- [ ] It opens, and keys goes down to -1
- [ ] You walk through it
```

highlight: add-objects

```check
object Key exists
object Door exists
Player has event collision with Key
Player.step uses instance_nearest
after 1 second, instance_number("Door") == 2
```

---

## Slimes

Add the **enemy** sprite and an object called **Slime** with it. In **Level**'s loop:

```python
        elif rows[row][col] == "s":
            instance_create(col * 32 + 16, row * 32 + 16, "Slime")
```

Give **Slime** a **Step** event. When the player is near, it creeps towards them, stopped by walls and doors like the player:

```python
player = instance_nearest(self.x, self.y, "Player")
if player and point_distance(self.x, self.y, player.x + 12, player.y + 12) < 150:
    move_and_collide(sign(player.x + 12 - self.x), 0)
    move_and_collide(0, sign(player.y + 12 - self.y))
```

`sign` is -1, 0 or 1: one pixel a step, towards the player, across and down. Slower than you, so you can get away.

highlight: add-event

```check
object Slime exists
Slime.step uses point_distance
game runs 2 seconds without errors
```

---

## A sword

Add the **slash** sprite and an object called **Slash** with it. Give **Slash** a **Create** event, so it only lasts a moment:

```python
self.alarm[0] = 10
```

An **Alarm 0** event:

```python
self.destroy()
```

And a **Collision with Slime** event:

```python
effect("hit", other.x, other.y)
other.destroy()
```

Now swing it. At the bottom of **Player**'s **Step** event, X makes a slash in front of the player, turned the way it faces:

```python
if keyboard_check_pressed("x"):
    s = instance_create(self.x + 12 + self.face_x * 24, self.y + 12 + self.face_y * 24, "Slash")
    s.image_angle = point_direction(0, 0, self.face_x, self.face_y)
```

`point_direction(0, 0, self.face_x, self.face_y)` is the angle the player faces: 0 for right, 90 for up, 180 for left, 270 for down.

highlight: add-event

```check
object Slash exists
Slash has event collision with Slime
Player.step uses image_angle
```

---

## Hearts

Add these lines to **Player**'s **Create** event. `hurt` counts down after a hit, so one slime can't take all your hearts at once:

```python
global_vars.hearts = 3
self.hurt = 0
```

Add a **Collision with Slime** event to **Player**:

```python
if self.hurt == 0:
    global_vars.hearts -= 1
    self.hurt = 60
    self.flash("red", 20)
    if global_vars.hearts <= 0:
        room_restart()
```

And count it down, at the bottom of **Player**'s **Step** event:

```python
if self.hurt > 0:
    self.hurt -= 1
```

Add the **heart** sprite. Make an object called **Hud**, with no sprite, drag one into the room, and give it a **Draw GUI** event. A loop draws one heart for each you have:

```python
for i in range(global_vars.hearts):
    draw_sprite("heart", 0, 20 + i * 20, 20)
draw_set_color("white")
draw_text(84, 12, f"Keys: {global_vars.keys}")
```

```quiz
A slime touches you on every step for a whole second (60 steps). How many hearts do you lose?
answer: 1
```

highlight: add-objects

```check
Player has event collision with Slime
Player.create uses hearts
room Room1 has 1 Hud
Hud.draw gui uses draw_sprite
```

---

## The gem

Add the **gem** sprite and an object called **Gem** with it. In **Level**'s loop:

```python
        elif rows[row][col] == "G":
            instance_create(col * 32 + 16, row * 32 + 16, "Gem")
```

A **Collision with Gem** event on **Player**:

```python
global_vars.escaped = True
other.destroy()
```

Start it as False in **Player**'s **Create** event:

```python
global_vars.escaped = False
```

Once you've escaped, the explorer stops and Enter plays again. At the **top** of **Player**'s **Step** event:

```python
if global_vars.escaped:
    if keyboard_check_pressed("enter"):
        room_restart()
    return
```

And at the bottom of **Hud**'s **Draw GUI** event:

```python
if global_vars.escaped:
    draw_text(200, 220, "You escaped with the gem! Enter to play again")
```

```quiz
Why does `return` stop the explorer from moving?
- [x] It ends the Step event before the lines that move the player
- [ ] It sends the player back to the start
- [ ] It destroys the player
```

highlight: add-event

```check
object Gem exists
Player has event collision with Gem
Player.create uses escaped
game runs 2 seconds without errors
```

---

## You made Crypt of Keys

Ideas to make it yours:

- A second crypt: another room and map, and the gem takes you there with `room_goto`.
- Slimes that need two hits: give them an `hp`, as in **5. Health Bars**.
- A heart to pick up that gives one back, never more than 3.
