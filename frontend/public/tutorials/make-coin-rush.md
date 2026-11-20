---
title: Coin Rush
level: Now You Can Make
after: collect-coins
time: 35 min
starter: empty
description: Your own grab-it-quick game, from an empty one: you choose who grabs, what they grab, how it looks, which keys play it and how long the clock runs.
---
# Coin Rush

You know sprites, objects, rooms, events and collisions now. That's enough to make a whole game of **your own**, starting from nothing.

It's a race against the clock: something to grab appears somewhere in the room. Grab it, and it jumps somewhere else. Grab as many as you can before the time runs out. **Everything else is up to you.**

- **Who grabs?** A cat, a robot, a bee, a kid with a net…
- **What do they grab?** Coins, gems, apples, stars, socks…
- **Which keys?** The arrows, W A S D, or something else.
- **How long?** Thirty seconds, a minute, you choose.
- **What does it look like?** Draw your own pictures, pick from the art library, or import your own.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names, keys and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

The room is 640 × 480.

---

## Your hero

Make the one who does the grabbing.

1. **Its picture.** Choose one way:
   - **Draw it:** make a new sprite and paint it in the sprite editor.
   - **The art library:** open **Library** and pick a picture.
   - **Your own file:** import a picture you made.
2. **Its object.** Make an object for it, give it that sprite, and give it a name that fits your game (*Cat*, *Robot*, *Grabber*…).
3. **Put it in the room.** Drag one into the middle of **Room1**.

highlight: open-library

```check
some object has a sprite
room Room1 has at least 1 thing
```

---

## Your controls

Give your hero a **Step** event that moves it with the keys **you** choose.

Here is one way: the arrow keys, gliding while a key is held. Change `"up"`, `"down"`, `"left"` and `"right"` to your keys (letter keys are written as the letter, like `"w"`), and `speed` to how fast you like.

```python
speed = 5
self.x += (keyboard_check("right") - keyboard_check("left")) * speed
self.y += (keyboard_check("down") - keyboard_check("up")) * speed
self.x = clamp(self.x, 0, room_width - 24)
self.y = clamp(self.y, 0, room_height - 24)
```

`clamp` keeps a number between two others, so your hero can't walk off the screen. 24 is how big the hero's picture is: if yours is bigger or smaller, change the 24s to its size.

```quiz
What does `clamp(700, 0, 616)` give?
answer: 616
```

highlight: code-editor

```check
holding a key moves something
uses clamp
```

---

## Something to grab

Now the thing your hero grabs: your coins, gems, apples or stars.

1. **Its picture.** Draw it, pick it from the library, or import it, like your hero's.
2. **Its object.** Make an object with that sprite, named for your game.
3. **Put one in the room.** Just **one**: it will jump around.
4. **Somewhere new each game.** Give it a **Create** event:

```python
import random
self.x = random.randint(16, room_width - 16)
self.y = random.randint(16, room_height - 16)
```

`random.randint(16, room_width - 16)` is a whole number, different every time, at least 16 pixels from each edge.

highlight: add-objects

```check
at least 2 objects have sprites
room Room1 has at least 2 things
uses randint
```

---

## Grab it

Give your hero a **Create** event, to start the score at nothing:

```python
global_vars.score = 0
```

Then add a **Collision** event to your hero, with the thing it grabs. The thing isn't destroyed: it jumps somewhere else, so there's always one to chase. Fill in the blank (`___`):

```python
import random
global_vars.score += ___    # how many points each one is worth
other.x = random.randint(16, room_width - 16)
```

`other` is the thing your hero touched. That line moves it across. **Finish it yourself:** add a line that moves it down or up too, to a new `other.y`. The room is `room_height` tall.

Play it and grab a few.

highlight: add-event

```check
some object has event collision
some object's collision uses score
some object's collision uses room_height
game runs 2 seconds without errors
```

---

## The score on screen

Make an object with **no sprite** to show the score, name it (*Hud*, *Scoreboard*…), and drag one into the room. Give it a **Draw GUI** event.

You choose the colour and the words. Fill in the blanks:

```python
draw_set_color(___)        # a colour, like "white" or "yellow"
draw_text(10, 10, f"___ {global_vars.score}")
```

Draw GUI is drawn on top of everything, at screen pixels: (10, 10) is near the top-left corner. `f"…{…}"` puts a value into the words.

````quiz
You've grabbed 7. What does this show?
```py
draw_text(10, 10, f"Coins: {global_vars.score}")
```
- [x] Coins: 7
- [ ] Coins: {global_vars.score}
- [ ] Coins: score
````

highlight: add-objects

```check
some object's draw gui uses score
```

---

## Against the clock

Give your score object a **Create** event. It starts the clock, and sets **alarm 0** to go off in 60 steps, which is one second. Fill in how long your game lasts:

```python
global_vars.time = ___     # how many seconds, like 30
self.alarm[0] = 60
```

Add an **Alarm 0** event. Each second it takes one off the clock, then sets the alarm again, until the time is gone. Fill in the blanks:

```python
if global_vars.time > 0:
    global_vars.time -= ___    # one second gone
    self.alarm[0] = ___        # steps until it goes off again
```

**Show the time yourself:** add a line at the bottom of the **Draw GUI** event that draws `global_vars.time`, a little under the score.

highlight: add-event

```check
some object has event alarm 0
some object's draw gui uses time
game runs 2 seconds without errors
```

---

## Time's up

When the time runs out, your hero should stop, and a key of your choice should play again. Fill in the key, and put these lines at the **top** of your hero's **Step** event:

```python
if global_vars.time == 0:
    if keyboard_check_pressed(___):
        room_restart()
    return
```

`return` ends the event there: the lines under it, the ones that move your hero, don't run.

`room_restart()` starts the room again from the beginning. Every Create event runs again, so the score is 0 and the clock is full.

Then, in your score object's **Draw GUI** event, write your own time's-up words when the clock reaches 0, and say which key plays again.

```quiz
Why doesn't your hero move once the time is 0?
- [x] `return` ends the Step event before the lines that move it
- [ ] `room_restart()` freezes the hero
- [ ] The alarm stops the Step event
```

highlight: code-editor

```check
uses room_restart
some object's step uses return
game runs 2 seconds without errors
```

---

## Make it yours

Make your game more fun to play. Choose one (or more), and write it yourself:

- **Last-second rush:** grabs are worth more when the clock is nearly out. Hint: in the collision, `if global_vars.time < 10:`
- **A time bonus:** a second kind of thing to grab that adds a few seconds to `global_vars.time`.
- **Something to avoid:** a thing that wanders about and takes seconds away when you touch it.
- **Your own idea:** a hero that speeds up as the score goes up, anything.

highlight: code-editor

```check
game runs 2 seconds without errors
```

---

## You made your own grab game

That's a whole game, made from an empty one. Play it, then make it even more yours:

- A **background**: a meadow, a kitchen, space. Paint one, or pick one from the library.
- **Sounds** for a grab and for time's up.
- A **best score** that's kept between games: look at **6. End Screen** in **Game Elements 2** to see how.
- A **title screen** in a room of its own.
