---
title: Crypt of Keys
level: Now You Can Make
after: el3-strike
time: 55 min
starter: empty
description: Your own top-down adventure, from an empty one: you choose the explorer, the guards, the keys, the doors, the prize, the map and the keys that play it.
---
# Crypt of Keys

You've drawn levels as text, made a strike that hits what's in front of you, and health that runs down. Now make a top-down adventure of **your own** from an empty one.

It's an escape: your explorer is shut in somewhere, seen from above. Each locked door needs a key, the keys are guarded, and a prize waits in the last room. **Everything else is up to you.**

- **Where is it?** An old crypt, a haunted library, a spaceship, a candy factory…
- **Who explores?** A knight, a cat, a robot, an owl…
- **What guards the keys?** Slimes, ghosts, bats, angry vacuum cleaners…
- **What do the keys, doors, weapon and prize look like?** A key could be a scroll, a keycard or a bone. The prize could be a gem, a crown or a lost book.
- **Which keys?** The arrows, W A S D, or something else.
- **What does it look like?** Draw your own pictures, pick from the art library, or import your own.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names, keys and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

The room is 640 × 480: a map of squares of 32, 20 across and 15 down. Walls and doors should be **32 × 32**, one square each. Make your explorer a little smaller, like 24 × 24 or 16 × 16, so it fits through a gap.

---

## The walls

Make the walls of your crypt.

1. **Their picture.** Choose one way:
   - **Draw it:** make a new sprite, 32 × 32, and paint it in the sprite editor.
   - **The art library:** open **Library** and pick a picture.
   - **Your own file:** import a picture you made.
2. **Their object.** Make an object for it, give it that sprite, name it (*Wall*, *Stone*, *Hedge*…), and tick **Solid**.
3. **The map.** Make an object with **no sprite** that builds the level, name it (*Level*, *Builder*…), and drag one into **Room1**. Give it a **Create** event:

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

Change `"Wall"` to your wall object's name. Only the `#`s become walls for now: the other letters come later. `P` is where your explorer starts, `k` a key, `D` a locked door, `s` a guard and `G` the prize.

**Make it yours:** change the map. Keep it 20 across and 15 down, with walls all round the edge, and put each letter somewhere it can be reached.

highlight: open-library

```check
some object has a sprite
room Room1 has at least 1 thing
some object's create uses instance_create
```

---

## Your explorer

Make the one who explores: its picture (draw it, the library, or import it), and an object with it, named for your game.

Your map-building object makes it at the `P`. In its loop, under the wall line:

```python
        elif rows[row][col] == "P":
            instance_create(col * 32 + 4, row * 32 + 4, "Player")
```

Change `"Player"` to your explorer's name. `+ 4` puts a 24-pixel picture in the middle of its square. If your picture's origin is its middle, use `+ 16` instead.

Give your explorer a **Create** event. `face_x` and `face_y` are the way it's facing, which the weapon will need:

```python
self.face_x = 1
self.face_y = 0
```

And a **Step** event: walking in four directions, stopped by walls. Change `"up"`, `"down"`, `"left"` and `"right"` to your keys:

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
holding a key moves something
some object's step uses move_and_collide
some object's create uses elif
```

---

## Keys and doors

Make two more things, each with its picture and its object: a **key** (or a keycard, a scroll, a bone…) and a **door** (or a gate, a force field…). Tick **Solid** for the door.

In the map's loop, fill in your objects' names:

```python
        elif rows[row][col] == "k":
            instance_create(col * 32 + 16, row * 32 + 16, ___)    # your key's object, in quotes
        elif rows[row][col] == "D":
            instance_create(col * 32, row * 32, ___)    # your door's object, in quotes
```

Now your explorer needs to count keys. Add a line to its **Create** event yourself that sets `global_vars.keys` to 0.

A **Collision** event on your explorer, with the key, picks one up:

```python
global_vars.keys += 1
other.destroy()
```

A door is solid, so you never touch it: you stop beside it. So your explorer opens the nearest door when it's close enough, if there's a key to open it with. Add to the bottom of its **Step** event, and fill in the blanks:

```python
door = instance_nearest(self.x, self.y, ___)    # your door's object, in quotes
if door and global_vars.keys > 0 and point_distance(self.x, self.y, door.x, door.y) < ___:    # how close
    door.destroy()
    global_vars.keys -= 1
```

How close? Standing beside a door, your explorer is about a square away from it, so a bit more than 32 works, like 48. Too small and the door never opens; too big and it opens from across the room.

```quiz
You walk up to a door with no keys. What happens?
- [x] Nothing: you stop beside it, because it's solid and `global_vars.keys > 0` is False
- [ ] It opens, and keys goes down to -1
- [ ] You walk through it
```

highlight: add-objects

```check
at least 4 objects have sprites
some object's collision uses keys
some object's step uses instance_nearest
after 1 second, global_vars.keys == 0
```

---

## The guards

Make what guards the keys: its picture and its object, named for your game.

In the map's loop, add an `elif` for the `s` yourself, like the key's: make one of your guards in the middle of the square.

Give your guard a **Step** event. When your explorer is near, it creeps towards them, stopped by walls and doors. Fill in the blanks:

```python
hero = instance_nearest(self.x, self.y, ___)    # your explorer's object, in quotes
if hero and point_distance(self.x, self.y, hero.x, hero.y) < ___:    # how near before it comes for you, like 150
    move_and_collide(sign(hero.x - self.x), 0)
    move_and_collide(0, sign(hero.y - self.y))
```

`sign` is -1, 0 or 1: one pixel a step, towards your explorer, across and down. Slower than you, so you can get away.

**Make it yours:** a quicker guard moves `sign(…) * 2`. A lazy one only notices you from very close.

highlight: add-event

```check
at least 5 objects have sprites
game runs 2 seconds without errors
```

---

## A weapon

Make your weapon: a sword's slash, a magic spark, a puff of pepper… Its picture and its object.

Give it a **Create** event, so it only lasts a moment:

```python
self.alarm[0] = ___    # how many steps it lasts: 10 is a sixth of a second
```

Give it an **Alarm 0** event yourself, that destroys it.

And a **Collision** event with your guard:

```python
effect("hit", other.x, other.y)
other.destroy()
```

Now swing it. At the bottom of your explorer's **Step** event, choose your attack key and fill in your weapon's name:

```python
if keyboard_check_pressed(___):    # your attack key, like "x" or "space"
    s = instance_create(self.x + self.face_x * 24, self.y + self.face_y * 24, ___)    # your weapon's object
    s.image_angle = point_direction(0, 0, self.face_x, self.face_y)
```

That makes one in front of your explorer, turned the way it faces. `point_direction(0, 0, self.face_x, self.face_y)` is that angle: 0 for right, 90 for up, 180 for left, 270 for down.

highlight: add-event

```check
some object has event alarm 0
some object's alarm 0 uses destroy
some object's collision uses effect
some object's step uses image_angle
```

---

## Hearts

Your explorer needs hearts (or lives, or batteries). Add these lines to its **Create** event, and choose how many. `hurt` counts down after a hit, so one guard can't take all your hearts at once:

```python
global_vars.hearts = ___    # how many hearts you start with
self.hurt = 0
```

Add a **Collision** event to your explorer, with your guard:

```python
if self.hurt == 0:
    global_vars.hearts -= 1
    self.hurt = ___    # steps before it can hurt you again: 60 is a second
    self.flash(___, 20)    # a colour, like "red"
    if global_vars.hearts <= 0:
        room_restart()
```

Then count `hurt` down yourself: at the bottom of your explorer's **Step** event, if `self.hurt` is more than 0, take 1 off it.

Make a sprite for one heart (draw it, or pick one from the library). Make an object with **no sprite** to show the hearts and keys, name it (*Hud*, *Panel*…), drag one into the room, and give it a **Draw GUI** event. A loop draws one heart for each you have:

```python
for i in range(global_vars.hearts):
    draw_sprite(___, 0, 20 + i * 20, 20)    # your heart sprite's name, in quotes
draw_set_color("white")
```

Under it, show how many keys you have, with `draw_text` and `global_vars.keys`. You choose the words.

```quiz
Your `self.hurt` is set to 60. A guard touches you on every step for a whole second (60 steps). How many hearts do you lose?
answer: 1
```

highlight: add-objects

```check
room Room1 has at least 2 things
some object's collision uses hurt
some object's step uses hurt
some object's draw gui uses draw_sprite
some object's draw gui uses keys
after 1 second, global_vars.hearts > 0
```

---

## The prize

Make your prize: its picture and its object. In the map's loop, add an `elif` for the `G` yourself.

Your explorer's **Create** event needs one more line: write one that sets `global_vars.escaped` to False.

A **Collision** event on your explorer, with the prize:

```python
global_vars.escaped = True
other.destroy()
```

Once you've escaped, your explorer stops, and a key of your choice plays again. At the **top** of its **Step** event:

```python
if global_vars.escaped:
    if keyboard_check_pressed(___):    # the key that plays again
        room_restart()
    return
```

Then, in your Draw GUI event, write your own words for when `global_vars.escaped` is True, and say which key plays again.

```quiz
Why does `return` stop the explorer from moving?
- [x] It ends the Step event before the lines that move it
- [ ] It sends the explorer back to the start
- [ ] It destroys the explorer
```

highlight: add-event

```check
at least 7 objects have sprites
some object's create uses escaped
some object's collision uses escaped
some object's step uses return
some object's draw gui uses escaped
game runs 2 seconds without errors
```

---

## You made your own adventure

Play it, then make it even more yours:

- A **second map**: another room, and the prize takes you there with `room_goto`.
- Guards that need **two hits**: give them an `hp`, as in **5. Health Bars**.
- A **heart to pick up** that gives one back, never more than you started with.
- A guard that **walks a beat** back and forth until it sees you.
- A **floor**: paint one, or pick a background from the library.
- **Sounds** for a swing, a key and a door opening.
