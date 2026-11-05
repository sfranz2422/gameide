---
title: Crates and Balls
level: Getting Started
time: 20 min
starter: levels-5
description: Physics: crates that fall and stack on your tiles with one line of code, a hero who shoves them, and a ball that knocks the tower down.
---
# Crates and balls

In **Walking on Tiles** you gave your hero gravity with your own code. For crates, balls and rocks there's a quicker way: **physics**. One line, and GameIDE makes a thing fall, land on your solid tiles, stack up, tip over and roll.

---

## A crate

Press the **+** beside **Sprites**, choose **Free art library…**, then **Pixel Platformer**, and scroll down to the **Tiles** sheet. Click the brown crate with a plank across it: in the second row, the seventh picture across. Press **Add as a sprite (1 frame)**.

Under **Sprites**, rename the new sprite **crate**: double-click its name, type **crate**, and press Enter.

highlight: add-sprites

```check
sprite crate exists
```

---

## A Crate object

Press the **+** beside **Objects**, name it **Crate**, and choose **crate** as its **Sprite**. Add a **Create** event, and type:

```python
self.physics = True
```

That's the whole crate. `physics` hands it to GameIDE's physics, which pulls it down every frame, stops it on solid tiles and other crates, and lets it tip over if it lands badly.

highlight: add-objects

```check
object Crate exists
Crate has sprite
Crate.create uses physics
```

---

## A tower

Open **Room1**. In the box at the top of the room, choose **Instances**, the layer objects go on. Pick the **Place** tool, choose **Crate** beside it, and click **five** times in a column, one crate above another, a little to the right of the platform. Leave gaps between them: they'll fall into a stack.

Press **Play**. The crates drop, land on your grass, and stack up. Jump on them: they're in the way of `move_and_collide`, just like the ground.

```quiz
Your Crate has no gravity code, no `vy` and no `move_and_collide`. Why does it fall?
- [x] `self.physics = True` hands it to physics, which pulls it down every frame
- [ ] Everything in a room falls on its own
- [ ] It's standing on a solid tile
```

highlight: room-canvas

```check
room Room1 has at least 5 Crate
game runs 2 seconds without errors
```

---

## Shove them

Your hero isn't a physics object, so it doesn't push crates on its own: it just stops at them. Teach it to shove. Place **one more** crate on the ground on its own, between the hero and the tower.

Then open **Player**'s Step event, and add these lines just under `move_and_collide(move * 3, 0)`:

```python
crate = instance_place(self.x + move, self.y, "Crate")
if crate:
    crate.push(move * 0.5, 0)
```

`instance_place` looks one pixel ahead, the way you're walking, and gives back the crate there, if there is one. `push` gives it a shove, and physics does the rest: it slides, slows down, and bumps into what's in its way.

```quiz
Your hero walks and jumps with its own code. Why not give it `self.physics = True` too?
- [x] Physics would tip it over and roll it, and a hero you steer should stay upright and stop when you let go
- [ ] Physics objects can't stand on solid tiles
- [ ] Only one object in a game can use physics
```

```check
room Room1 has at least 6 Crate
Player.step uses instance_place
Player.step uses push
game runs 2 seconds without errors
```

---

## A ball

Open the art library again, and the **Tiles** sheet. Click the round gold coin near the bottom (the eighth row) and press **Add as a sprite (1 frame)**. Rename it **ball**.

On the sprite's page, set **Mask kind** to **Circle**. Physics uses the mask as the thing's shape: a circle rolls, and a box would slide and tumble.

highlight: add-sprites

```check
sprite ball exists
```

---

## Knock it down

Make an object **Ball** with the **ball** sprite, and give it a **Create** event:

```python
self.physics = True
self.hspeed = 6
self.bounce = 0.5
self.weight = 3
```

`hspeed` throws it to the right as the game starts. `bounce` is how bouncy it is, from 0 to 1. `weight` makes it three times as heavy as a crate, so it knocks them flying instead of bouncing off.

Place one **Ball** in the room with the **Place** tool, at the **left end of your platform**. It rolls along the platform, drops off the end, and needs that run-up to hit your tower hard.

```quiz
What would happen with `self.weight = 0.2` instead?
- [ ] The ball would fall more slowly
- [x] The ball would be lighter than a crate, and bounce off the tower more than knock it down
- [ ] The ball would float away
```

highlight: add-objects

```check
object Ball exists
Ball has sprite
Ball.create uses hspeed
room Room1 has at least 1 Ball
after 2 seconds, Ball.x increased
```

---

## Play it

Press **Play** and watch the ball roll off the platform and knock your tower down. Then shove the crates around, and climb on them.

highlight: play

```check
game runs 3 seconds without errors
```

---

## Done

Two kinds of moving things in one game: a hero moved by your own code, and crates and a ball moved by physics.

Things to try:
- `self.fixed = True` in a crate's Create event: physics never moves it, but things still land on it and bounce off.
- `physics_gravity(0, 0.1)` in the Player's Create event: gravity like the Moon's, for every physics object.
- A bigger `bounce`, up to 1, on the ball.
