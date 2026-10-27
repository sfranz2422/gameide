---
title: 8. Button Click and Tap
level: Game Elements 3: Advanced Techniques
time: 12 min
starter: space-7
description: A START button on a title screen that works with a mouse click or a tap, and lights up when you point at it.
---
# Button Click and Tap

Not everyone plays with a keyboard. A **button** works with a mouse click, and on a phone or tablet with a tap: a tap counts as a left click.

---

## A title with a button

Make a new room called **Title** and drag it **above Room1**, so the game starts there.

Make an object called **StartButton** with the **block** sprite, and drag one into **Title** at about the middle. Give it a **Create** event to make it wide:

```python
self.image_xscale = 3
```

and a **Draw** event, to draw the button with its word on it:

```python
draw_self()
draw_set_color("white")
draw_set_halign("center")
draw_set_valign("middle")
draw_text(self.x + 96, self.y + 32, "START")
```

The block is 64 pixels square; three times as wide is 192, so its middle is 96 across and 32 down from its corner.

highlight: folder-rooms

```check
room Title exists
after 1 second, room_name() == "Title"
room Title has 1 StartButton
StartButton has event draw
```

---

## Click it

Open **StartButton**, press **Add event**, and under **Mouse** choose **Left Pressed**. It runs when this instance is clicked or tapped:

```python
room_goto("Room1")
```

Play it, and click START.

highlight: add-event

```check
StartButton has event left pressed
StartButton.left pressed uses room_goto
```

---

## Light up

A button should show it's ready to be pressed. Give **StartButton** a **Step** event:

```python
if collision_point(mouse_x, mouse_y, "StartButton") == self:
    self.image_blend = "yellow"
else:
    self.image_blend = "white"
```

`mouse_x` and `mouse_y` are where the pointer is in the room. `collision_point` gives back the StartButton under that point, if there is one, and `== self` asks whether it's this one.

```check
StartButton.step uses mouse_x
game runs 2 seconds without errors
```

---

## Your turn: Enter too

Keyboard players should be able to start as well. Make pressing **Enter** go to Room1, in StartButton's Step event.

```check
after 1 second holding enter, room_name() == "Room1"
```

---

## Your space game

A title with a button, a ship that drifts, rocks that spawn and break apart, a firing delay, health bars, explosions and a pause menu. That's a real arcade game.

Next: **9. Level Maps**, and a new game: a platformer.
