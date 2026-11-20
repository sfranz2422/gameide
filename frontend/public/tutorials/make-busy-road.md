---
title: Busy Road
level: Now You Can Make
after: el1-time-limit
time: 45 min
starter: empty
description: Your own crossing game, from an empty one: you choose who crosses, what's in the way, how it looks and which keys play it.
---
# Busy Road

You've made a player, enemies, collisions, a score and lives. Now make a whole game of **your own** from an empty one.

It's a crossing game: something has to get from the bottom of the screen to the top while things race across in lanes. **Everything else is up to you.**

- **Who crosses?** A frog, a chicken, a kid on a skateboard, a tiny robot…
- **What's in the way?** Cars, logs, dragons, asteroids, angry geese…
- **Which keys?** The arrows, W A S D, or something else.
- **What does it look like?** Draw your own pictures, pick from the art library, or import your own.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names, keys and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

The room is 640 × 480. If you move in squares of 32, that's 20 across and 15 down.

---

## Your hero

Make the thing that crosses the road.

1. **Its picture.** Choose one way:
   - **Draw it:** make a new sprite and paint it in the sprite editor.
   - **The art library:** open **Library** and pick a picture.
   - **Your own file:** import a picture you made.
2. **Its object.** Make an object for it, give it that sprite, and give it a name that fits your game (*Frog*, *Chicken*, *Hopper*…).
3. **Put it in the room.** Drag one onto the bottom of **Room1**.

highlight: open-library

```check
some object has a sprite
room Room1 has at least 1 thing
```

---

## Your controls

Give your hero a **Step** event that moves it with the keys **you** choose.

Here is one way: the arrow keys, one hop of one square for each press. Change `"up"`, `"down"`, `"left"` and `"right"` to your keys. Letter keys are written as the letter, like `"w"`.

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

**Hop or glide?** `keyboard_check_pressed` is true only on the step a key goes down, so each press is one hop. If you'd rather glide while a key is held, use `keyboard_check` and smaller numbers, like `self.y -= 3`.

```quiz
Your hero hops with `keyboard_check_pressed`. You hold the key down for a whole second. How many hops is that?
- [x] One: it's only true on the step the key goes down
- [ ] Sixty, one every step
- [ ] None until you let go
```

highlight: code-editor

```check
holding a key moves something
```

---

## What's in the way

Now the things that race across: your cars, logs, dragons or asteroids.

1. **Their picture.** Draw it, pick it from the library, or import it, like your hero's.
2. **Their object.** Make an object with that sprite, named for your game.
3. **Make them move.** Give it a **Create** event:

```python
self.hspeed = 2
```

And a **Step** event, so one that leaves one side comes back on the other:

```python
if self.x > room_width + 20:
    self.x = -20
if self.x < -20:
    self.x = room_width + 20
```

4. **Fill the road.** Drag at least six into the room, in the rows between the top and the bottom. Leave the top row and the bottom row clear, and leave gaps to cross through.

highlight: add-objects

```check
at least 2 objects have sprites
room Room1 has at least 7 things
uses room_width
```

---

## Every lane its own way

Everything goes the same way at the same speed. Real roads aren't like that. Make each lane go **its own speed**, and make some lanes go **the other way**.

Here's a start for your moving object's **Create** event. Fill in the blanks (`___`):

```python
lane = self.y // 32
self.hspeed = ___          # a speed that changes with the lane, like 1 + lane % 3
if lane % 2 == 0:
    self.hspeed = ___      # this lane goes the other way
self.image_xscale = sign(self.hspeed)
```

`self.y // 32` is which row it's in: `//` divides and throws away the remainder. `lane % 3` is the remainder after dividing by 3, so it counts 0, 1, 2, 0, 1, 2 down the road. A negative `hspeed` goes left. Setting `image_xscale` to -1 flips the picture, so it faces the way it's going.

Your road needs **at least three different speeds**, and **some lanes going each way**.

```quiz
A car is in lane 7, and `self.hspeed = 1 + lane % 3`. What is its speed?
- [x] 2 (7 % 3 is 1)
- [ ] 3
- [ ] 7
```

highlight: code-editor

```check
uses image_xscale
things move at 3 or more speeds
some things move left and some move right
```

---

## Getting hit

When something hits your hero, it loses a life and goes back to where it started.

Give your hero a **Create** event that remembers where it started and how many lives it has. Fill in the blanks:

```python
self.start_x = self.x
self.start_y = ___         # like start_x, for y
global_vars.lives = ___    # how many lives your game gives
```

Then add a **Collision** event to your hero, with the object that's in the way. Take away a life, and finish it off yourself: put your hero back at `self.start_x` and `self.start_y`.

```python
global_vars.lives -= ___
self.flash("red", 12)
```

**Make it yours:** `self.flash` takes any colour and any number of steps. Or play a sound with `sound_play` if you've added one.

highlight: add-event

```check
some object has event collision
some object's create uses start_y
some object's collision uses lives
some object's collision uses start_x
```

---

## Across!

Getting to the top is a point, and back to the start for another go.

First, your hero's **Create** event needs the score to start at nothing: add a line that sets `global_vars.score` to 0.

Then, at the bottom of its **Step** event, fill in the row and finish the rest yourself:

```python
if self.y < ___:           # the top row
    global_vars.score += 1
```

After the point, send your hero back to the start, the same way the collision does.

```quiz
Why does your hero go back to `start_x` and `start_y` after a point, and not to the bottom of the screen?
- [x] So it starts exactly where you put it in the room, on its square
- [ ] Because `start_x` is faster
- [ ] Because the bottom of the screen is off the grid
```

highlight: code-editor

```check
some object's create uses score
some object's step uses score
game runs 2 seconds without errors
```

---

## Score and lives on the screen

Make an object with **no sprite** to show the score and lives, name it (*Hud*, *Scoreboard*…), and drag one into the room. Give it a **Draw GUI** event.

You choose the colour, the words and where they go. Fill in the blanks, and show the lives too:

```python
draw_set_color(___)        # a colour, like "white" or "yellow"
draw_text(10, 4, f"___ {global_vars.score}")
```

Draw GUI is drawn on top of everything, at screen pixels: (10, 4) is near the top-left corner. `f"…{…}"` puts a value into the words.

highlight: add-objects

```check
some object's draw gui uses score
some object's draw gui uses lives
```

---

## Game over

When the lives run out, your hero should stop, and a key of your choice should play again. Fill in the key, and put these lines at the **top** of your hero's **Step** event:

```python
if global_vars.lives <= 0:
    if keyboard_check_pressed(___):
        room_restart()
    return
```

`return` ends the Step event there, so nothing below it runs: your hero stops.

Then, in your score object's **Draw GUI** event, write your own game-over words when the lives are gone, and say which key plays again.

highlight: code-editor

```check
uses room_restart
some object's step uses return
game runs 2 seconds without errors
```

---

## Make it harder

A good game gets harder the better you get. Choose one (or more), and write it yourself:

- **Rush hour:** each crossing makes everything faster. In your moving object's **Step** event, move it a little more each step as the score goes up. Hint: `self.x += self.hspeed * global_vars.score / 5`
- **More traffic:** each crossing adds one more, in a random lane, with `instance_create`.
- **Your own idea:** a timer, faster lanes near the top, anything.

```quiz
You've crossed 5 times, and you used the rush-hour hint. How fast is something whose `hspeed` is 2 going now, in pixels a step?
answer: 4
```

highlight: code-editor

```check
game runs 2 seconds without errors
```

---

## You made your own crossing game

Play it, then make it even more yours:

- A **background**: a road, a river, space. Paint one, or pick one from the library.
- A **safe strip** halfway, with nothing in it, to rest on.
- Things that **carry** you instead of hitting you, like logs on a river.
- A **prize** on the far side worth an extra point.
- **Sounds** for a hop, a hit and a point.
- A **title screen** in a room of its own.
