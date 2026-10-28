---
title: Point-and-Click Adventure
level: Starter Projects
time: 35 min
starter: pointclick
description: Robin the reporter's newsroom and hallway, already working: click to walk, look at things, pick them up, open doors. Then build the next room.
---
# The Newsroom

This game already works. Press **Play** and try it:

- **Click** the floor and Robin walks there.
- **Click** something (the computer, the board, the door) and Robin walks over and does something with it.
- Pick up the **camera**, then try the **cafeteria door** in the hallway.
- Click your things at the bottom to hear what they are.
- Hold **Tab** to see every clickable thing, as yellow boxes.

highlight: play

```check
game runs 3 seconds without errors
```

---

## How a thing works

Every yellow box is a **Spot**. Open the **Newsroom** room from the **Rooms** folder: you can see them there.

Choose the **Select** tool and click the box over the **computer**. On the right, the **Instance** tab shows its **Creation code**: the lines that make this one Spot different from the others.

```python
self.name = "computer"
self.text = "The school computer. It takes four minutes to open a picture of a cat."
```

Change `self.text` to something Robin would say about the computer. Play, and click it.

highlight: room-canvas

```check
after 1 second, not any(s.text.startswith("The school computer") for s in instances("Spot"))
```

---

## Something new to look at

The bookshelf on the right has no Spot yet. Give it one:

1. Choose **Spot** in the list on the left, pick **Place**, and click on the bookshelf's top-left corner.
2. A Spot is 32 pixels square. In the **Instance** tab, set **Scale x** and **Scale y** to stretch it over the whole shelf (about **1.4** across and **2.8** down).
3. In its Creation code, give it a name and words:

```python
self.name = "bookshelf"
self.text = "Old yearbooks, and a dictionary nobody has opened since 1998."
```

Hold **Tab** while playing to check the box covers the shelf.

highlight: room-canvas

```check
room Newsroom has at least 6 Spot
after 1 second, any(s.name == "bookshelf" for s in instances("Spot"))
```

---

## A key to find

A Spot with `self.item` is picked up: it goes into your things and disappears from the room. The picture shown at the bottom is the **sprite** with the item's name.

1. Make a new sprite called **key** (+ beside **Sprites**), and draw a key. Keep it small: **66 × 38** fits the bar.
2. Put a new Spot in the **Hallway**, over the bulletin board left of the cafeteria door (it has no Spot yet), with:

```python
self.name = "bulletin board"
self.text = "A key, taped behind a lost-cat poster!"
self.item = "key"
```

highlight: folder-sprites

```check
sprite key exists
room Hallway has at least 8 Spot
uses "key"
```

---

## A locked door

`self.needs` is the item a Spot wants before it does anything, and `self.locked` is what Robin says without it. The cafeteria door already works this way: it needs the camera.

Lock the **office door** in the Hallway with your key. Add to its Creation code:

```python
self.needs = "key"
self.locked = "Locked. The principal never locks his door. Suspicious."
```

Play: the door says one thing without the key, and another with it.

```check
game runs 2 seconds without errors
```

---

## A new room: the Cafeteria

The cafeteria door leads nowhere yet. Build the room behind it:

1. **+** beside **Rooms**, and call it **Cafeteria**. In its **Room** tab, make it **640 × 400**.
2. In **Layers**, choose the **Background** layer and set its picture to **pic_cafeteria**.
3. Place a **Robin**, a **Game**, and a few **Spots** over the things in the picture: the food, the milk cartons, the tables.
4. Robin needs to know where the floor is. Open the **adventure** script and add the Cafeteria to `FLOOR`:

```python
FLOOR = {
    "Newsroom": (180, 238, 630, 284),
    "Hallway": (10, 224, 630, 284),
    "Cafeteria": (10, 230, 380, 284),
}
```

5. Last, in the Hallway, open the cafeteria door's Creation code and add `self.goto = "Cafeteria"`.

Every room needs a way back: give the Cafeteria a Spot with `self.goto = "Hallway"`.

highlight: folder-rooms

```check
room Cafeteria exists
room Cafeteria has at least 1 Robin
room Cafeteria has at least 1 Game
after 1 second, "Cafeteria" in FLOOR
```

---

## Done

You've built onto a real adventure game: things to look at, to pick up, a locked door, and a new room.

Ideas for more:

- More rooms: draw your own, 640 × 288, with the panel underneath.
- Use one item to get another: a Spot that `needs` the key and gives you an `item`.
- A person to talk to: a Spot whose text is what they say, with `say(…, "Ms. Glorbin")`.
- An ending: when you have everything, `say` the headline and `game_restart()`.
