---
title: Alley Brawl
level: Now You Can Make
after: el3-strike
time: 50 min
starter: empty
description: Your own beat 'em up, from an empty one: you choose who fights, who they fight, where, how a hit looks and which keys play it.
---
# Alley Brawl

You've made a strike that hits what's in front of you, a health bar, and a camera that follows. Now make a beat 'em up of **your own**, from an empty one.

It's a game where you walk along a place three screens long, up and down it as well as along it. Enemies close in from both sides and stand beside you to hit you. Hit them back until they're knocked out, and clear the place before your health runs out. **Everything else is up to you.**

- **Who fights?** A kung fu kid, a robot, a cat in boxing gloves…
- **Who do they fight?** Thugs, zombies, angry vegetables…
- **Where?** A street, a beach, a spaceship's corridor…
- **What's the hit?** A punch, a kick, a zap, a pillow…
- **Which keys?** The arrows, W A S D, and a key to hit with.
- **What does it look like?** Draw your own pictures, pick from the art library, or import your own.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names, keys and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

---

## The place

Open **Room1** and change its **Width** to **1920**: three screens long.

Make an object with **no sprite** for the ground, named for your game (*Street*, *Beach*, *Corridor*…), and drag one into the room. Give it a **Draw** event. It paints the ground across the whole room:

```python
draw_set_color("#3f3f46")
draw_rect(0, 240, room_width, 470)
draw_set_color("#71717a")
draw_rect(0, 236, room_width, 240)
```

Those colours are a grey street with a kerb. Choose your own: sand and sea, a metal floor, grass. A colour can be a name like `"green"` or a code like `"#3f3f46"`.

A **Draw** event draws in the room, so the ground scrolls with the camera. (A **Draw GUI** event draws on the window, and doesn't.)

highlight: room-editor

```check
room Room1 is at least 1920 wide
some object has event draw
some object's draw uses draw_rect
```

---

## Your fighter

1. **Its picture.** Choose one way:
   - **Draw it:** make a new sprite and paint it in the sprite editor.
   - **The art library:** open **Library** and pick a picture.
   - **Your own file:** import a picture you made.
2. **Its object.** Make an object with that sprite, named for your game (*Player*, *Brawler*, *Kid*…), and drag one onto the ground near the left end.
3. **Its Create event:**

```python
self.facing = 1
global_vars.health = 100
```

4. **Its Step event.** Here it walks with the arrow keys: change `"right"`, `"left"`, `"down"` and `"up"` to your keys. Along the ground is quicker than up and down it:

```python
dx = keyboard_check("right") - keyboard_check("left")
dy = keyboard_check("down") - keyboard_check("up")
self.x = clamp(self.x + dx * 3, 0, room_width - 24)
self.y = clamp(self.y + dy * 2, 240, 440)
if dx != 0:
    self.facing = dx
self.depth = -self.y
```

`clamp` keeps your fighter on the ground, between 240 and 440 down the screen. `facing` remembers which way it last walked: 1 for right, -1 for left.

highlight: open-library

```check
some object has a sprite
some object's step uses clamp
holding a key moves something
```

---

## Follow your fighter

Open **Room1**'s settings and tick **Camera**. Leave it 640 by 480, the window's size. Now the window shows only part of the room: `view_width` (640) is less than `room_width`.

Then make it follow your fighter. Add a line to your fighter's **Create** event, and fill in the blank (`___`):

```python
camera_follow(self, ___)    # 1 sticks to it, 0.1 glides after it
```

The last line of your fighter's Step event, `self.depth = -self.y`, matters once there are enemies. Lower **depth** is drawn in front. Someone lower down the screen is nearer to you, so they should be drawn in front of someone further up it.

```quiz
Your fighter is at y = 400 and an enemy at y = 300, so your fighter's depth is -400 and the enemy's -300. Which is drawn in front?
- [x] Your fighter: -400 is lower, and it's nearer the bottom of the screen
- [ ] The enemy
- [ ] Whichever was made first
```

highlight: room-camera

```check
after 1 second, view_width < room_width
some object's create uses camera_follow
```

---

## Your enemies

1. **Their picture and object**, named for your game (*Thug*, *Zombie*, *Robot*…).
2. **How tough.** Give them a **Create** event, and fill in the blank:

```python
self.hp = ___          # how many hits it takes, like 3
self.cooldown = 0
```

3. **Closing in.** And a **Step** event. When your fighter is near, the enemy heads for a spot right beside them, on whichever side it's already on. Change `"Player"` to your fighter's name, and fill in the blanks:

```python
self.depth = -self.y
player = instance_nearest(self.x, self.y, "Player")
if player and abs(player.x - self.x) < ___:     # how near before it comes for you, like 400
    if self.x > player.x:
        gx = player.x + 12 + 30
    else:
        gx = player.x + 12 - 30
    gy = player.y + 12
    self.x = approach(self.x, gx, ___)          # how fast it walks along, like 1.5
    self.y = approach(self.y, gy, 1)
```

`approach(self.x, gx, 1.5)` moves `self.x` towards `gx` by 1.5 at most, and stops exactly on it.

4. **Fill the place.** Drag at least six onto the ground, spread along it, with a few on the first screen.

highlight: add-objects

```check
room Room1 has at least 8 things
some object's step uses approach
things move at 1 or more speeds
```

---

## Hit them

1. **The hit's picture and object**, named for your game (*Punch*, *Kick*, *Zap*…).
2. **It lasts a moment.** Give it a **Create** event, and fill in the blank:

```python
self.alarm[0] = ___    # how many steps it lasts, like 6
```

3. **And then it's gone.** Give it an **Alarm 0** event that destroys it. Write that one yourself.
4. **What it does.** Give it a **Collision** event with your enemy. The enemy loses a point of `hp` and is knocked back the way the hit faces. Fill in the blanks:

```python
other.hp -= 1
other.x += self.image_xscale * ___     # how far a hit knocks it back, like 24
other.flash(___, 6)                    # a colour it flashes, like "white"
self.destroy()
if other.hp <= 0:
    effect("hit", other.x, other.y)
    other.destroy()
```

5. **Throw it.** At the bottom of your fighter's **Step** event: a key of your choice makes a hit in front of your fighter, facing its way. Change `"Punch"` to your hit's name, and fill in the key:

```python
if keyboard_check_pressed(___):         # your hit key, like "z"
    p = instance_create(self.x + 12 + self.facing * 22, self.y + 12, "Punch")
    p.image_xscale = self.facing
```

```quiz
Why does the hit destroy itself as soon as it lands?
- [x] Otherwise it would touch the enemy on every step it lasts, and one hit would take several points
- [ ] So the enemy can see it
- [ ] Because the alarm doesn't work
```

highlight: add-event

```check
some object's alarm 0 uses destroy
some object's collision uses hp
some object's step uses keyboard_check_pressed
```

---

## They hit back

An enemy standing right beside you hits you, then waits before the next. Add these lines to the bottom of your enemy's **Step** event, inside the `if`, pushed in like the lines above them. Fill in the blanks:

```python
    if self.cooldown > 0:
        self.cooldown -= 1
    elif point_distance(self.x, self.y, gx, gy) < 6:
        global_vars.health -= ___       # how much a hit hurts, like 10
        player.flash("red", 10)
        self.cooldown = ___             # steps to wait before the next: 60 is a second
```

Make an object with **no sprite** for the health bar, name it (*Hud*, *Meter*…), and drag one into the room. Give it a **Draw GUI** event. Fill in the blanks:

```python
draw_set_color("dkgray")
draw_rect(10, 10, 210, 22)
draw_set_color(___)                                   # the bar's colour
draw_rect(10, 10, 10 + global_vars.health * ___, 22)  # 100 health should fill all 200 pixels
```

The check stands still and waits for an enemy to reach your fighter and hurt it, so make sure one is on the first screen.

```quiz
An enemy beside you the whole time hurts 10 a hit and waits 60 steps between hits. How long until your 100 health is gone?
- [x] About 10 seconds: 10 hits, one a second
- [ ] 1 second
- [ ] 100 seconds
```

highlight: add-objects

```check
some object's step uses cooldown
some object's draw gui uses health
after 8 seconds, global_vars.health < 100
```

---

## Knocked out, or cleared

When your health is gone, your fighter stops and a key of your choice plays again. Fill in the key, and put these lines at the **top** of your fighter's **Step** event:

```python
if global_vars.health <= 0:
    if keyboard_check_pressed(___):     # the key to play again
        room_restart()
    return
```

`return` ends the Step event there, so nothing below it runs: your fighter stops.

Then, at the bottom of your health bar's **Draw GUI** event, write the rest yourself. Tell the player how it went, in your own words:

- when `global_vars.health` is 0 or less: knocked out, and which key plays again;
- when `instance_number(…)` of your enemy is 0: the place is cleared.

highlight: code-editor

```check
some object's step uses return
some object's draw gui uses instance_number
game runs 2 seconds without errors
```

---

## You made your own beat 'em up

Play it, then make it even more yours:

- A **boss** at the end with 10 `hp` and a health bar of its own.
- A **second move** on another key: slower, but it knocks enemies twice as far.
- **Food** on the ground that gives health back.
- **Sounds** for a hit, a knock-out and getting hurt.
- **Waves**: more enemies come in from the sides once the first ones are down.
