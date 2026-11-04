---
title: Alarms
level: Getting Started
time: 15 min
starter: coins-start
description: How alarms work: run something later, repeat it, give every instance its own timer, and stop one.
---
# Alarms

An **alarm** is a kitchen timer that every instance carries. You set it to a number of steps, it counts down by itself, and when it reaches zero its **Alarm** event runs, once.

A game runs 60 steps a second, so 60 steps is one second and 180 is three.

Each instance has twelve alarms, `self.alarm[0]` to `self.alarm[11]`, and each one has its own event: **Alarm 0**, **Alarm 1** and so on.

---

## Something that happens once

Let's show a message for three seconds. Make a new object called **Clock** with no sprite, and drag one into the room.

Give it a **Create** event:

```python
self.show_goal = True
self.alarm[0] = 180
```

and a **Draw GUI** event:

```python
draw_set_color("white")
if self.show_goal:
    draw_text(8, 8, "Collect the coins!")
```

Now press **Add event** and add **Alarm 0**. Leave the number at 0. This is what happens when the timer runs out:

```python
self.show_goal = False
```

Press **Play**. The message goes away after three seconds, and nothing had to count anything.

highlight: add-objects

```check
object Clock exists
Clock has event alarm 0
after 4 seconds, Clock.show_goal changed
```

---

## Something that repeats

An alarm runs once and then stops. To repeat something, **set the alarm again inside its own event**, like winding the timer back up each time it rings.

Let's count seconds with a second alarm. In **Clock**'s **Create** event, add:

```python
global_vars.seconds = 0
self.alarm[1] = 60
```

Add an **Alarm 1** event:

```python
global_vars.seconds += 1
self.alarm[1] = 60
```

And at the end of **Draw GUI**:

```python
draw_text(8, 452, f"Time: {global_vars.seconds}")
```

````quiz
What would happen if you took `self.alarm[1] = 60` out of the **Alarm 1** event?
- [x] The time would reach 1 and stay there, because the alarm would never be set again
- [ ] The time would count up faster
- [ ] The game would stop with an error
````

```check
Clock has event alarm 1
after 3 seconds, global_vars.seconds >= 2
```

---

## The mistake everybody makes

Set an alarm in **Create**, or in an event that happens once, like a collision. Don't set it in **Step**.

Step runs 60 times a second. An alarm set there goes back to the full time on every step, so it counts down one step and then starts over. It never reaches zero and its event never runs, and you get no error to tell you why.

If an alarm event never seems to run, look for this first.

````quiz
This is in a **Step** event. When does **Alarm 0** run?

```py
self.alarm[0] = 60
```
- [x] Never, because the alarm starts over on every step
- [ ] After one second
- [ ] Sixty times a second
````

---

## Every instance has its own

Alarms belong to one instance, so each coin can have its own timer. Let's make the coins twinkle, each in its own time.

In **Coin**, add a **Create** event:

```python
self.alarm[0] = choose([20, 40, 60])
```

and an **Alarm 0** event:

```python
self.image_blend = choose(["white", "yellow"])
self.alarm[0] = 30
```

`choose` picks one from a list at random, so the coins start at different moments and don't all flash together.

Clock also has an **Alarm 0**, and it has nothing to do with these. An alarm's number only means something inside its own object.

highlight: add-event

```check
Coin has event alarm 0
Coin.create uses choose
game runs 2 seconds without errors
```

---

## Looking at one, and stopping one

`self.alarm[1]` is a number you can read: how many steps are left, or `-1` when it isn't running. Setting it to `-1` cancels it, so its event won't run.

Let's stop the clock with Space, so `global_vars.seconds` stops going up. Give **Clock** a **Step** event:

```python
if keyboard_check_pressed("space"):
    self.alarm[1] = -1
```

Setting an alarm to `0` doesn't run its event: only counting down to zero does. If you want something to happen right away, set it to `1`, or just do it.

Alarms also wait while the game is paused with `game_pause`, so a pause never uses up your timers.

```quiz
type: match
Match each line to what it does:
- self.alarm[0] = 60 -> runs Alarm 0 in one second
- self.alarm[0] = -1 -> cancels the alarm
- self.alarm[0] = 0 -> doesn't run anything
```

```check
Clock.step uses keyboard_check_pressed
after 3 seconds holding space, global_vars.seconds == 0
```

---

## Time on your side

You can now make things happen later, over and over, and at different times for different instances. Enemies that spawn every few seconds, a shield that wears off and a door that closes behind you are all built this way.

You'll find alarms in the **Time Limit** and **Delay Timer** lessons too, and in the docs under **alarm**.
