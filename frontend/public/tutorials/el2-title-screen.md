---
title: 1. Title Screen
level: Game Elements 2: Adding to the Fun
time: 12 min
starter: dodge2-0
description: A room of its own for the game's name, and a key to start playing.
---
# Title Screen

This is the dodging game from **Game Elements 1**, finished. Now you'll add to it, starting with a **title screen**: the first thing a player sees.

A game can have several **rooms**: a title, levels, a game-over screen. Each is a mode the game can be in, and `room_goto` moves between them.

---

## A room first

Press the **+** beside **Rooms** and call the new room **Title**. Then drag it **above Room1** in the list: the first room is where the game starts, and it gets the **start** badge.

Play it. The window is empty: you're in the Title room, and it has nothing in it yet.

highlight: folder-rooms

```check
room Title exists
after 1 second, room_name() == "Title"
```

---

## Something to read

Make a new object called **TitleScreen**, with no sprite, and drag one into the **Title** room. Give it a **Draw GUI** event:

```python
draw_set_color("white")
draw_set_halign("center")
draw_text(320, 160, "DODGE")
draw_text(320, 260, "Press Space to start")
```

`draw_set_halign("center")` centres the text on its x, and 320 is the middle of the window.

highlight: add-objects

```check
object TitleScreen exists
room Title has 1 TitleScreen
TitleScreen.draw gui uses draw_text
game runs 2 seconds without errors
```

---

## Start playing

Give **TitleScreen** a **Step** event:

```python
if keyboard_check_pressed("space"):
    room_goto("Room1")
```

`keyboard_check_pressed` is True only in the step the key goes down, not all the time it's held. `room_goto` changes room at the end of the step.

Play it. And when the time's up, Space now starts the game again **from the title**: `game_restart()` goes back to the first room.

highlight: code-editor

```check
TitleScreen.step uses room_goto
after 1 second holding space, room_name() == "Room1"
```

---

## Your turn: Enter too

Make the **Enter** key start the game as well as Space.

```check
after 1 second holding enter, room_name() == "Room1"
```

---

## A proper start

Your game opens on its title and waits for the player. From now on, the checks that play your game hold Space to get past the title.

Next: **2. Collecting**.
