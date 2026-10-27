---
title: 5. Health Bars
level: Game Elements 3: Advanced Techniques
time: 15 min
starter: space-4
description: Health as a number, a bar drawn from it that changes colour, one that floats over the ship, and healing.
---
# Health Bars

A **stat bar** shows a number as a picture: health, energy, a level's progress. A bar is just a rectangle whose width comes from the number.

---

## Health

In **Ship**'s **Create** event, add:

```python
self.hp = 100
```

In the **Collision with Rock** event, inside the `if`, take some off, and start again when it's gone:

```python
    self.hp -= 25
    if self.hp <= 0:
        room_restart()
```

highlight: code-editor

```check
Ship.create uses hp
Ship.collision with Rock uses hp
after 1 second, instances("Ship")[0].hp <= 100
```

---

## The bar

In **Ship**'s **Draw GUI** event, under the speeds, add:

```python
draw_set_color("dkgray")
draw_rect(10, 56, 210, 68)
draw_set_color("lime")
draw_rect(10, 56, 10 + self.hp * 2, 68)
```

`draw_rect(x1, y1, x2, y2)` fills the box between two corners. The grey one is the whole bar, 200 wide. The green one is `self.hp * 2` wide: 200 at full health, 0 at none.

```check
Ship.draw gui uses draw_rect
game runs 2 seconds without errors
```

---

## Colours that warn

Replace the `draw_set_color("lime")` line with a colour that depends on the health:

```python
if self.hp > 50:
    draw_set_color("lime")
elif self.hp > 25:
    draw_set_color("orange")
else:
    draw_set_color("red")
```

```check
Ship.draw gui uses elif
game runs 2 seconds without errors
```

---

## Over the ship

A bar can follow the ship too. Give **Ship** a **Draw** event. Drawing it yourself replaces the sprite, so `draw_self()` draws the ship first:

```python
draw_self()
draw_set_color("red")
draw_rect(self.x - 12, self.y - 22, self.x - 12 + self.hp * 0.24, self.y - 19)
```

A Draw event draws **in the room**, so the bar's position comes from the ship's x and y. Draw GUI draws on the window, so its bar stays in the corner.

```check
Ship has event draw
Ship.draw uses draw_self
game runs 2 seconds without errors
```

---

## Your turn: heal

Make the ship heal slowly: add `0.02` to `self.hp` every step, but never let it go over 100. `min` gives back the smaller of two numbers.

```check
Ship.step uses min
game runs 2 seconds without errors
```

---

## Health you can see

Health is a number; the bars are pictures of it, drawn fresh every frame.

Next: **6. Explosions**.
