---
title: Bomb Dodge
level: Now You Can Make
after: el2-difficulty
time: 40 min
starter: empty
description: Your own dodging game, from an empty one: you choose who dodges, what falls from the sky, how it looks and which keys play it.
---
# Bomb Dodge

You've made a player, collisions, a score, lives, alarms, and a spawner that makes enemies faster and faster. Now put them together into a game of **your own**, from an empty one.

It's a dodging game: things fall from the sky. Every one you dodge is a point, every one that hits you is a life, and they come faster the better you do. **Everything else is up to you.**

- **Who dodges?** A cat with an umbrella, a snail, a tiny knight, a spaceship…
- **What falls?** Bombs, rocks, raindrops, pianos, meteors…
- **Which keys?** The arrows, A and D, or something else. Your hero only goes left and right.
- **What does it look like?** Draw your own pictures, pick from the art library, or import your own.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names, keys and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

The room is 640 × 480.

---

## Your hero

Make the one who dodges.

1. **Its picture.** Choose one way:
   - **Draw it:** make a new sprite and paint it in the sprite editor.
   - **The art library:** open **Library** and pick a picture.
   - **Your own file:** import a picture you made.
2. **Its object.** Make an object for it, give it that sprite, and give it a name that fits your game (*Cat*, *Knight*, *Dodger*…).
3. **Put it in the room.** Drag one to the bottom middle of **Room1**.

highlight: open-library

```check
some object has a sprite
room Room1 has at least 1 thing
```

---

## Your controls

Give your hero a **Step** event that moves it left and right with the keys **you** choose.

Here is one way: the arrow keys. Change `"left"` and `"right"` to your keys (letter keys are written as the letter, like `"a"`), and the 6 to how fast you like.

```python
self.x += (keyboard_check("right") - keyboard_check("left")) * 6
self.x = clamp(self.x, 0, room_width - 24)
```

`clamp` keeps your hero on the screen. 24 is how wide the hero's picture is: if yours is wider or thinner, change it to its width.

highlight: code-editor

```check
holding a key moves something
uses clamp
```

---

## What falls

Now the things that fall: your bombs, rocks or raindrops.

1. **Their picture.** Draw it, pick it from the library, or import it, like your hero's.
2. **Their object.** Make an object with that sprite, named for your game. **Don't** put any in the room: the game will make them.
3. **Make them fall.** Give it a **Create** event:

```python
self.vspeed = 3
```

`vspeed` is how far an instance moves down by itself, every step. One with a `vspeed` of 3 falls without any more code.

highlight: add-objects

```check
at least 2 objects have sprites
uses vspeed
```

---

## Where they come from

Make an object with **no sprite** that makes the falling things, name it (*Spawner*, *Cloud*, *Sky*…), and drag one into the room. Give it a **Create** event that sets an alarm. Fill in the blank (`___`):

```python
self.alarm[0] = ___        # steps until the first one falls: 60 is a second
```

Its **Alarm 0** event makes one just above the top of the room, at a random place across, then sets the alarm again. Fill in the blanks:

```python
import random
instance_create(random.randint(8, room_width - 8), -10, ___)   # your falling object's name, in quotes
self.alarm[0] = ___        # steps until the next one
```

Play it. If your falling object's name is spelled differently from the one in quotes, the game stops with an error: the names must match exactly, capitals too.

```quiz
`self.alarm[0] = 30`. How often does a new one fall?
- [x] Every half a second (30 steps, at 60 steps a second)
- [ ] Every 30 seconds
- [ ] 30 at once
```

highlight: add-event

```check
room Room1 has at least 2 things
some object's alarm 0 uses instance_create
game runs 3 seconds without errors
```

---

## Dodged

Give your hero a **Create** event, for the score and the lives. Fill in how many lives your game gives:

```python
global_vars.score = 0
global_vars.lives = ___
```

One that falls out of the bottom of the room was dodged. Give your falling object a **Step** event, and fill in the points:

```python
if self.y > room_height:
    global_vars.score += ___
```

**Finish it yourself:** after the point, take it out of the game with `self.destroy()`, inside the `if`. Without that, every one would keep falling forever, far below the room.

highlight: add-event

```check
some object's create uses lives
some object's step uses destroy
after 6 seconds, global_vars.score >= 1
```

---

## Hit

Add a **Collision** event to your hero, with the falling object. Fill in how many lives a hit takes:

```python
other.destroy()
global_vars.lives -= ___
```

The falling one is destroyed, so it can only hit once.

**Finish it yourself:** make your hero flash, so you can see you were hit. `self.flash("white", 10)` flashes white for 10 steps: choose your own colour and number of steps.

highlight: add-event

```check
some object has event collision
some object's collision uses lives
some object's collision uses flash
```

---

## Score and lives

Make an object with **no sprite** to show the score and lives, name it (*Hud*, *Scoreboard*…), and drag one into the room. Give it a **Draw GUI** event.

You choose the colour, the words and where they go. Fill in the blanks, and **show the lives yourself**, on a line underneath:

```python
draw_set_color(___)        # a colour, like "white" or "yellow"
draw_text(10, 10, f"___ {global_vars.score}")
```

```quiz
Which one of these shows the lives?
- [x] `draw_text(10, 30, f"Lives: {global_vars.lives}")`
- [ ] `draw_text(10, 30, "Lives: {global_vars.lives}")`
- [ ] `draw_text(10, 30, f"Lives: lives")`
```

highlight: add-objects

```check
some object's draw gui uses score
some object's draw gui uses lives
```

---

## Game over

When the lives are gone, your hero should stop, and a key of your choice should play again. Fill in the key, and put these lines at the **top** of your hero's **Step** event:

```python
if global_vars.lives <= 0:
    if keyboard_check_pressed(___):
        room_restart()
    return
```

`return` ends the Step event there, so nothing below it runs: your hero stops.

**Finish it yourself:**

- Nothing should fall once the game is over. In the **Alarm 0** event that makes them, put the `instance_create` line inside an `if`, so it only runs while `global_vars.lives > 0`.
- In your score object's **Draw GUI** event, write your own game-over words when the lives are gone, and say which key plays again.

highlight: code-editor

```check
uses room_restart
some object's step uses return
some object's alarm 0 uses lives
game runs 3 seconds without errors
```

---

## Faster and faster

It's too easy. The better you do, the faster they should come.

In the **Alarm 0** event, change the last line, the one that sets the alarm again, to this. Fill in the blanks:

```python
self.alarm[0] = max(___, ___ - global_vars.score)   # the shortest wait; the wait at the start
```

Every one you dodge takes a step off the wait, but never below the shortest wait.

Then make them fall faster too: in your falling object's **Create** event, change the speed to this, and fill in the blanks:

```python
self.vspeed = ___ + global_vars.score / ___     # the speed at the start; how many points make it 1 faster
```

```quiz
You've dodged 25. How many steps is the wait now, `max(8, 30 - 25)`?
answer: 8
```

highlight: code-editor

```check
some object's alarm 0 uses max
game runs 3 seconds without errors
```

---

## You made your own dodging game

Play it, then make it even more yours:

- A **background**: a city, a cave, space. Paint one, or pick one from the library.
- Something that falls now and then and **gives a life back**.
- A **best score** that's kept between games.
- Falling things that **drift sideways**: give them an `hspeed` too.
- **Sounds** for a hit and for game over.
