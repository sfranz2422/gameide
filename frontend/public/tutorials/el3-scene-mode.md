---
title: 14. Scene Mode
level: Game Elements 3: Advanced Techniques
time: 20 min
starter: cave-5
description: Build a cutscene from cards with no typing: a speech bubble, movie bars, someone walking to a spot you click, and a caption.
---
# Scene Mode

You wrote your last cutscene line by line. This time you'll build one by picking steps from a menu and putting them in order. It's the same `scene_` Python underneath, and GameIDE writes it for you as you go.

When the player bumps into their friend, the friend is going to say something and then walk off.

---

## A scene of your own

Open **Player** and give it a **Collision with Friend** event. A new event is empty, so you can choose how to write it. Press the **Scene** tab.

Now press **+ Add a step** and choose **Say**. A card appears. In its **Words** box type `Follow me!`.

Look at the **Python** beside your card. That one card made one line, a `scene_say`.

highlight: tab-scene

```check
Player.collision with Friend is in a scene
Player.collision with Friend uses scene_say
game runs 2 seconds without errors
```

---

## A speech bubble

The dialogue box is at the bottom of the screen, a long way from whoever's talking. On your **Say** card press **More**. Set **Bubble over** to **the first Friend**.

Press **Play** and walk into your friend. The words now come from over the friend's head, and your line has gained `above=`.

Add one more step: choose **Movie bars**, which writes `scene_bars`. It lands under your **Say** card, but it should come first, so press the **▲** on its card. You can also drag a card by the dots on its left side.

highlight: scene-editor

```check
Player.collision with Friend uses above=
Player.collision with Friend uses scene_bars
game runs 2 seconds without errors
```

---

## Click where they go

A new card goes under the one you last clicked. Click your **Say** card, then add a **Move** step, which writes `scene_move`. Set **Who** to **the first Friend**.

You could type numbers in **x** and **y**. Instead, press **Pick in room**. You'll see a picture of your room. Click somewhere further along the floor. The card now has the numbers of the place you clicked.

Play it, and the friend walks there.

````quiz
What does **Pick in room** put in your Python?
- [ ] The name of the room
- [x] The plain x and y numbers of the place you clicked
- [ ] A hidden link that only works in Scene mode
````

```check
Player.collision with Friend uses scene_move
game runs 2 seconds without errors
```

---

## Acting

People turn to look at each other before they talk. Click your **Movie bars** card and add a **Face** step (`scene_face`), so it comes right after the bars. Leave **Who** as **this one (self)**, because this event belongs to the Player, and set **Toward** to **the first Friend**.

Then click your **Move** card and add a **Caption** step (`scene_caption`), with the words `Later that day...`. It shows in the middle of the screen, then fades.

```check
Player.collision with Friend uses scene_face
Player.collision with Friend uses scene_caption
game runs 2 seconds without errors
```

---

## Only once

Play it and walk into your friend. If you're still touching when the scene ends, it starts all over again, because the collision is still happening. The orange note at the top of the cards warned you about this.

Tick **Play once**, above the cards. Now look at the Python: it has two new lines at the top that use `global_vars`, and the steps are pushed in under them. You wrote that same idea by hand in the last lesson.

````quiz
Why can't you pick the **Scene** tab in a **Step** event?
- [x] A Step event runs every step, so the scene would keep starting over
- [ ] Scenes can only use one Step event in each game
- [ ] Step events can't call functions
````

```check
Player.collision with Friend uses global_vars
game runs 2 seconds without errors
```

---

## It's still Python

Read through the **Python** beside your cards. Each card is one line. Nothing here is magic, and you could type all of it yourself.

**Convert to Python** on that pane turns a scene into typed code for good, if you ever need something the cards can't do. It can't be turned back, so keep your cards until you're sure.

Use whichever suits the job: cards are quick for trying out a scene, and typing is better when a scene needs `if` statements or loops.

Next: **Starter Projects**, whole games to take apart.
