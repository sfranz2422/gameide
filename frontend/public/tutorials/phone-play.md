---
title: Play on a Phone
level: Starter Projects
time: 15 min
starter: platformer
description: On-screen arrows and buttons, taps as clicks, and playing your published game on a phone.
---
# Play on a phone

A phone, a tablet or a touchscreen Chromebook has no keyboard to play with. This platformer only knows the keyboard: the arrows run, and **Space** jumps.

You'll give it **on-screen controls**: arrows and buttons drawn over the game. Pressing one counts as holding that key, so the game's `keyboard_check` code works without changing a line of it.

Press **Play** first and try it with the keyboard, so you know how it plays.

highlight: play

---

## Turn the controls on

Open **Player** and its **Create** event. Add this line at the end:

```python
touch_controls(True, "space", always=True)
```

- `True` shows the controls.
- `"space"` is the key the button on the right holds down. It shows as **␣**.
- `always=True` shows them even on a computer. Normally they only appear on a touchscreen, and you're testing on a computer.

Press **Play**. The arrows are bottom-left and the jump button bottom-right. Click them with the mouse: holding **▶** runs right, and **␣** jumps.

highlight: code-editor

```check
Player.create uses touch_controls
```

---

## More buttons

`touch_controls` takes up to **4** buttons. Give it a list of keys in brackets, and each one gets a button:

```python
touch_controls(True, ["space", "x"], always=True)
```

The first key's button is nearest the player's thumb. The game decides what each key does: this one doesn't use **X** yet, so its button does nothing until you write code for it.

Try a fifth button and press **Play**: the game stops with an error, because only 4 fit on the screen. Then go back to just `"space"`.

```check
game runs 2 seconds without errors
```

```quiz
Pressing the on-screen ␣ button counts as what?
- [ ] A click of the mouse
- [x] Holding down the Space key
- [ ] A tap that the game has to check for with new code
```

highlight: code-editor

---

## Only on touchscreens

Now that you've seen them, take out `always=True`, so players with a keyboard don't get buttons over their game:

```python
touch_controls(True, "space")
```

Press **Play**. On a computer the controls are gone. On a phone or a touchscreen Chromebook they appear by themselves.

To hide them again in your own games, on a title screen say, use `touch_controls(False)`.

highlight: code-editor

```check
Player.create uses touch_controls
Player.create avoids always
```

---

## A tap is a click

A tap on the game counts as a click of the **left** mouse button, so `mouse_check_pressed("left")` is true on the step a finger touches the screen. Where the finger is is `mouse_x` and `mouse_y`, just like the mouse.

Let players jump by tapping anywhere. Open **Player**'s **Step** event and find the jump line. Change it to:

```python
if on_ground and (keyboard_check_pressed("space") or mouse_check_pressed("left")):
```

The brackets matter: the player must be on the ground, and either Space or a tap will do.

Press **Play** and click the game to jump. Taps on the on-screen buttons don't count as clicks: they only hold their key.

```quiz
type: blank
A finger touching the screen counts as pressing the [[left]] mouse button, and where it touched is mouse_x and [[mouse_y]].
```

highlight: code-editor

```check
Player.step uses mouse_check_pressed
game runs 2 seconds without errors
```

---

## Play it on your phone

Press **Publish**, give your game a title and publish it. You get a link to your game. Open that link on a phone.

- Press **Play** on a phone and the game fills the screen. On Android it goes full screen and turns sideways.
- An iPhone can't do either for a web page, so the game fills the browser window and asks you to turn the phone sideways.
- A tablet keeps the page as it is, with the controls over the game.

Your touch controls appear by themselves, because a phone is a touchscreen.

highlight: publish
