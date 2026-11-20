---
title: Gem Guard
level: Now You Can Make
after: el3-button
time: 50 min
starter: empty
description: Your own tower defense, from an empty game: you choose what marches, what it's after, the path it takes, your towers and what they cost.
---
# Gem Guard

You've made things that spawn, shots that fly, explosions, buttons you can click, and objects that inherit from a parent. Now make a tower defense of **your own**, from an empty game.

It's a game where enemies march along a path towards your treasure. Each one that reaches it costs you a life. You spend gold to build towers beside the path, and you earn more gold for every enemy they stop. **Everything else is up to you.**

- **What marches?** Slimes, robots, ants, ghosts…
- **What are they after?** A gem, a cake, a castle, a sleeping dragon's egg…
- **Which way do they come?** You draw the path.
- **What stops them?** Cannons, wizards, sunflowers that spit seeds…
- **How hard is it?** You choose the prices, the gold, the lives and how tough everything is.
- **What does it look like?** Draw your own pictures, pick from the art library, or import your own.

Everything in this game is an **object**, and that's the point of it. When you want a new kind of enemy, you'll make one in four lines, because it inherits all the rest.

Each step tells you **what** your game needs next and shows **one way** to do it. The code is an example: change the names and numbers to fit your game. The checks don't care what you call things, only that your game does what the step asks.

---

## The path

The path is a list of corners. Enemies will walk from one to the next, and the same list will draw the path, so changing a corner changes both.

Make a **script** called **road**:

```python
ROAD = [(-20, 80), (480, 80), (480, 240), (160, 240), (160, 400), (596, 400)]
```

**The path is yours.** Those corners are an example: make your own. Each corner is `(x, y)` in the 640 × 480 room; start the first one just off the edge, so enemies walk in. Keep the name `ROAD`: the rest of the code uses it.

Make an object with **no sprite** that draws the path, named for your game (*Road*, *Path*, *River*…), and drag one into **Room1**. Its **Create** event puts it behind everything else:

```python
self.depth = 100
```

Its **Draw** event draws a thick line from each corner to the next. Choose your own colour and width:

```python
draw_set_color("#b08850")
for i in range(len(ROAD) - 1):
    a, b = ROAD[i], ROAD[i + 1]
    draw_line(a[0], a[1], b[0], b[1], 40)
```

highlight: folder-scripts

```check
uses ROAD
room Room1 has at least 1 thing
some object's draw uses draw_line
```

---

## Your enemy

1. **Its picture.** Choose one way:
   - **Draw it:** make a new sprite and paint it in the sprite editor.
   - **The art library:** open **Library** and pick a picture.
   - **Your own file:** import a picture you made.
2. **Its object.** Make an object with that sprite, named for your game (*Enemy*, *Slime*, *Robot*…). Don't put any in the room: the game will make them.
3. **Its Create event** is what makes this enemy this enemy: how far along the path it is, how fast it walks, and how tough it is.

```python
self.leg = 1
self.walk = 1.5
self.hp = 20
```

4. **Its Step event** heads for the next corner. `self.leg` says which one, and on reaching it, it goes on to the one after. Past the last corner, it's gone:

```python
if self.leg < len(ROAD):
    tx, ty = ROAD[self.leg]
    self.move_towards(tx, ty, self.walk)
    if point_distance(self.x, self.y, tx, ty) <= self.walk:
        self.leg += 1
else:
    self.destroy()
```

highlight: open-library

```check
some object has a sprite
some object's step uses move_towards
```

---

## Where enemies come from

Make an object with **no sprite** that sends them, named for your game (*Gate*, *Cave*, *Portal*…), and drag one into the room. Its **Create** event sets an alarm:

```python
self.alarm[0] = 30
```

Its **Alarm 0** event makes an enemy at the path's first corner, and sets the alarm again. Change `"Enemy"` to your enemy's name, and fill in the blank (`___`):

```python
instance_create(ROAD[0][0], ROAD[0][1], "Enemy")
self.alarm[0] = ___      # steps until the next one: 60 is a second
```

Play it. A line of enemies marches along your path, round every corner.

```quiz
You add one more corner to the end of `ROAD`. What changes?
- [x] The path is drawn with it, and the enemies walk to it, with no other change
- [ ] The path is drawn with it, but you have to teach the enemies about it
- [ ] Nothing, until you change what sends them
```

highlight: code-editor

```check
some object's alarm 0 uses instance_create
game runs 3 seconds without errors
```

---

## A tower

1. **Its picture and object**, named for your game (*Tower*, *Cannon*, *Wizard*…). Drag one into the room beside the path, near the middle.
2. **Its numbers.** Give it a **Create** event, and fill in the blanks:

```python
self.cool = 0
self.reload = ___     # steps between shots: 30 is two a second
self.reach = ___      # how far it can see, in pixels, like 140
self.damage = ___     # how much a shot hurts, like 7
```

3. **Firing.** Its **Step** event finds the nearest enemy, and if that's in reach and the tower has cooled down, fires at it. Change `"Enemy"` and `"Shot"` to your names, and fill in the blank:

```python
self.cool -= 1
target = instance_nearest(self.x, self.y, "Enemy")
if target is not None and self.cool <= 0:
    if point_distance(self.x, self.y, target.x, target.y) < self.reach:
        shot = instance_create(self.x, self.y, "Shot")
        shot.direction = point_direction(self.x, self.y, target.x, target.y)
        shot.speed = ___          # how fast it flies, like 8
        shot.damage = self.damage
        self.cool = self.reload
```

4. **What it fires.** Make its picture and object (*Shot*, *Arrow*, *Seed*…). A shot that misses shouldn't fly for ever: give it a **Create** event that sets `self.alarm[0]`, and an **Alarm 0** event that destroys it with `self.destroy()`. Write both yourself, like the alarm that sends your enemies.

Play it. The tower fires at each enemy going past, but the shots do nothing yet.

highlight: add-objects

```check
at least 3 objects have sprites
some object's step uses instance_nearest
some object's alarm 0 uses destroy
```

---

## Stopping them

Give your shot a **Collision** event with your enemy. The enemy loses what this shot does, and the shot is used up. Fill in the blank:

```python
other.hp -= ___          # what this shot does: the tower gave it its damage
self.destroy()
```

Now the enemy has to notice. Write this yourself, at the very top of your enemy's **Step** event: when its `hp` is 0 or less, it makes an explosion where it is, with `effect("explosion", self.x, self.y)`, and destroys itself.

Play it. Enemies blow up as the tower hits them.

highlight: add-event

```check
some object's collision uses damage
some object's step uses effect
game runs 3 seconds without errors
```

---

## The treasure, gold and lives

1. **Your treasure's picture and object**, named for your game (*Gem*, *Cake*, *Castle*…). Drag one to the end of the path. Give it a **Collision** event with your enemy, so an enemy that gets there is gone, and costs you a life. Fill in the blank:

```python
global_vars.lives -= 1
___.destroy()            # the enemy that got there
```

2. **What you start with.** Make an object with **no sprite** for the score, named for your game (*Hud*, *Panel*…), and drag one into the room. Its **Create** event:

```python
global_vars.gold = ___     # gold to start with
global_vars.lives = ___    # how many enemies may get through
```

3. **On the screen.** Its **Draw GUI** event shows the gold. Fill in the colour, and show the lives too, your way:

```python
draw_set_color(___)
draw_text(10, 10, f"Gold {global_vars.gold}")
```

4. **Pay for each one stopped.** In your enemy's **Step** event, add a line under the `effect` one, pushed in the same:

```python
    global_vars.gold += self.pay
```

And in your enemy's **Create** event, write how much it pays yourself: a line that sets `self.pay`.

````quiz
What's on the screen after these lines run, if gold was 100?
```py
global_vars.gold += 10
global_vars.gold += 10
```
answer: 120
````

highlight: code-editor

```check
some object's collision uses lives
some object's draw gui uses gold
some object's draw gui uses lives
after 1 second, global_vars.gold > 0
```

---

## Building by clicking

One tower won't be enough. Make a picture and object for the places you can build (*Spot*, *Pad*, *Plot*…), 32 pixels across. Drag six into the room beside the path, where you'd like to be able to build.

A spot is a button, like the one you made before. Open it, press **Add event**, and under **Mouse** choose **Left Pressed**. If you can pay, the spot becomes a tower. A spot's **x** and **y** are its top left corner, and a tower's are its middle, so the tower goes 16 across and 16 down. Change `"Tower"` to your tower's name, and fill in the price:

```python
if global_vars.gold >= ___:       # what a tower costs
    global_vars.gold -= ___       # the same
    instance_create(self.x + 16, self.y + 16, "Tower")
    self.destroy()
```

Play it. Click a spot, and a tower appears there and starts firing. That's every tower you'll ever build: each is an instance of your tower object, with all its events.

highlight: add-event

```check
room Room1 has at least 10 things
some object has event left pressed
some object's left pressed uses instance_create
```

---

## New enemies, in four lines

Here's what objects are for. Make a new kind of enemy: an object with a picture of its own (or your enemy's), named for your game (*Runner*, *Speedy*, *Bat*…), and choose your enemy as its **Parent**. It now walks, explodes, pays and steals, without one line of that code.

Give it a **Create** event that only says what's different. Fill in its numbers:

```python
super().on_create()
self.walk = ___      # faster or slower than its parent
self.hp = ___        # tougher or weaker
self.pay = ___       # what it's worth
```

`super().on_create()` runs its parent's **Create** first, then these lines change what's different.

Now make one more kind yourself, the same way, with numbers of its own: a slow, tough one, maybe, made bigger with `self.image_xscale = self.image_yscale = 1.5`.

highlight: object-parent

Now the sender decides who to send. In its **Create** event, add how many are coming, and fill it in:

```python
self.left = ___      # how many enemies there are in all, like 30
```

And in its **Alarm 0** event, replace the `instance_create` line with this. Change the three names to your three kinds:

```python
self.left -= 1
if self.left % 5 == 0:
    kind = "Brute"
elif self.left % 3 == 0:
    kind = "Runner"
else:
    kind = "Enemy"
instance_create(ROAD[0][0], ROAD[0][1], kind)
```

Your shots hit the new kinds, and your treasure is robbed by them, with no change at all: to the game, they **are** your enemy.

```check
at least 10 objects exist
some object's create uses super
some object's alarm 0 uses kind
```

---

## Upgrades

Clicking a tower should make it better. Give your tower a **Left Pressed** event under **Mouse**. Fill in the price:

```python
if global_vars.gold >= ___:      # what an upgrade costs
    global_vars.gold -= ___      # the same
    self.damage *= 2
    self.flash("yellow")
```

Because the shot takes its damage from the tower that fires it, this is all it takes. **Make it yours:** an upgrade could reach further too, or reload sooner.

```quiz
A tower with `damage` 7 is upgraded twice. How much does each of its shots do now?
answer: 28
```

highlight: add-event

```check
some object's left pressed uses damage
game runs 2 seconds without errors
```

---

## Winning and losing

The sender should stop when everyone's been sent, or when you've lost, and send them faster as it goes. In its **Alarm 0** event, replace the last line, the one that sets the alarm again, with this, and fill in the blank:

```python
if self.left > 0 and global_vars.lives > 0:
    self.alarm[0] = ___ + self.left * 2      # the wait, shorter as fewer are left: like 20 + self.left * 2
```

You've won when nobody's left to come and nobody's still walking. Give the sender a **Step** event. Change `"Enemy"` to your enemy's name: it counts its children too.

```python
if self.left <= 0 and instance_number("Enemy") == 0:
    global_vars.won = True
```

Then write the rest yourself, in your score object:

- in its **Create** event, start `global_vars.won` as `False`;
- give it a **Step** event where a key of your choice calls `room_restart()`;
- at the bottom of its **Draw GUI** event, say how it ended, in your own words: one thing when the lives are gone, another when you've won, with the key that plays again.

Play it through. Can you hold on to every life?

highlight: code-editor

```check
after 1 second, global_vars.won == False
some object's step uses instance_number
some object's draw gui uses won
uses room_restart
```

---

## You made your own tower defense

Play it, then make it even more yours:

- **Another enemy**, in four lines: a child of your enemy that's very fast and very weak, or very slow and very tough.
- **A second kind of tower**: a child of your tower with its own numbers. A slow one with a long reach?
- **Waves**: stop the sender for a few seconds after every ten enemies.
- **Aim**: turn each tower towards what it's firing at, with `image_angle`.
- **Sounds** for a shot, an explosion and a life lost.
- **A second map**: another room with other corners.
