---
title: Visual Novel
level: Starter Projects
time: 30 min
starter: novel
description: A spooky story on a misty marsh, already working: pictures, characters, words and choices with two endings. Then write your own scenes.
---
# The Ferryman

This game already works. Press **Play** and read it:

- **Space** or a **click** goes on to the next line.
- When it asks **What do you do?**, click a choice (or press its number).
- There are two endings. Can you find both?

The whole story is written in one place, as **data**: a script called **story**. You'll change it, then add to it.

highlight: play

```check
game runs 3 seconds without errors
```

---

## Change the words

Open **story** from the **Scripts** folder. `SCENES` is a **dictionary**: each scene has a name (`"start"`, `"ferry"`…) and what's in it.

```python
"start": {
    "picture": "landing",
    "face": "marrow_0",
    "lines": [
        ("Marrow", "You're the one with the lantern? Good. The marsh is no place to be in the dark."),
```

Each line is **(who, words)**. Change Marrow's first words to something of your own. Keep the quotes and the comma at the end.

highlight: folder-scripts

```check
game runs 2 seconds without errors
```

---

## Another choice

Under the lines, `"choices"` is a list of **(what it says, the scene it goes to)**.

Give the start scene a third choice. It can go to any scene that's already there:

```python
"choices": [("Take the ferry", "ferry"), ("Walk the boardwalk", "reeds"), ("Run back home", "lost")],
```

Play, and pick it.

```quiz
In the choice `("Walk the boardwalk", "reeds")`, what is `"reeds"`?
- [x] The name of the scene that choice goes to
- [ ] The words on the choice's button
- [ ] The name of the character who says it
```

highlight: code-editor

```check
game runs 2 seconds without errors
```

---

## A scene of your own

Write a whole new scene, and a choice that leads to it. Follow the shape of one that's there, give it a new name, and put it inside `SCENES` with the others:

```python
"marrows_tale": {
    "picture": "ferry",
    "face": "marrow_1",
    "lines": [
        ("Marrow", "I wasn't always a ferryman, you know."),
        ("Marrow", "Once, I was the one who got lost out here."),
    ],
    "choices": [("Ask how he got home", "chapel")],
},
```

Then add a choice to another scene that goes to `"marrows_tale"`, or nobody will ever see it.

The pictures you can use are in the **Sprites** folder: **landing**, **ferry**, **reeds**, **willow**, **chapel** and **dawn**, and the faces **marrow_0**, **marrow_1**, **pip_0** and **pip_1** (two moods each).

highlight: folder-sprites

```check
game runs 2 seconds without errors
```

---

## Remember a choice

A good story remembers what you did. Let's remember whether you met Pip.

Open **Story**'s **Create** event and start the memory off before the story begins:

```python
global_vars.met_pip = False
play("start")
```

Then in the **story** script, inside `play`, just after `global_vars.scene = name`, add:

```python
    if name == "willow":
        global_vars.met_pip = True
    if name == "dawn" and global_vars.met_pip:
        say("Pip squeezes your hand, smiles, and fades into the morning light.")
```

Play twice: once meeting Pip, once without. The dawn is different.

```quiz
When does the extra line about Pip show at dawn?
- [x] Only if the story went through the `"willow"` scene first
- [ ] Every time you reach the dawn
- [ ] Only the first time you play
```

highlight: object-editor

```check
Story.create uses met_pip
game runs 2 seconds without errors
uses met_pip
```

---

## Done

You've written part of a visual novel: words, choices, a new scene, and a story that remembers.

Ideas for more:

- Your own pictures: a background is **960 × 540**, a face **160 × 200**. Add them as sprites and use their names.
- More things to remember: a coin you were given, a name you were told.
- A choice that only appears if you remember something.
- A third ending.
