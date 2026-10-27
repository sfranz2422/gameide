---
title: 3. Projectile
level: Game Elements 2: Adding to the Fun
time: 15 min
starter: dodge2-2
description: Fire bullets while Space is held, tidy them away off screen, and knock enemies back.
---
# Projectile

A **projectile** is anything that's fired: a bullet, an arrow, a fireball. Each one is a new instance, made while the game runs and destroyed when it's done.

---

## Fire!

The game has a **bullet** sprite ready. Make an object called **Bullet** with it, and give it a **Create** event:

```python
self.hspeed = 10
```

Don't put any bullets in the room: the player makes them. In **Player**'s **Create** event, add:

```python
self.cooldown = 0
```

And at the end of **Player**'s **Step** event:

```python
if self.cooldown > 0:
    self.cooldown -= 1
if keyboard_check("space") and self.cooldown == 0:
    instance_create(self.x + 24, self.y + 12, "Bullet")
    self.cooldown = 15
```

`instance_create(x, y, "Bullet")` makes a new bullet at the player's right edge. The **cooldown** counts down 15 steps between shots, so holding Space fires four bullets a second instead of sixty.

highlight: add-objects

```check
object Bullet exists
Player.step uses instance_create
after 1 second holding space, instance_number("Bullet") >= 1
```

---

## Tidy up

Every bullet flies off the right of the screen and keeps going forever. Hundreds of them would slow the game down. Give **Bullet** an **Outside Room** event:

```python
self.destroy()
```

It runs once, when the bullet leaves the room.

```check
Bullet has event outside room
after 3 seconds holding space, instance_number("Bullet") <= 5
```

---

## Hit something

Give **Bullet** a **Collision with Enemy** event:

```python
self.destroy()
other.x = room_width + 12
global_vars.score += 1
global_vars.best = max(global_vars.best, global_vars.score)
```

The bullet's gone, and the enemy is knocked back to the right.

```check
Bullet has event collision with Enemy
Bullet.collision with Enemy uses destroy
after 8 seconds holding space, global_vars.best >= 1
```

---

## Your turn: the A button

Make the gamepad's **A** button fire too. You'll need brackets round the `or`, so the cooldown still counts for both: `(keyboard_check("space") or gamepad_check("a")) and self.cooldown == 0`.

```check
Player.step uses gamepad_check("a")
game runs 2 seconds without errors
```

---

## Ready, aim

Bullets are made while the game runs, fly, hit things and get tidied away: the life of every projectile.

Next: **4. Increasing Difficulty**.
