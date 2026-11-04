---
title: 13. Cutscenes
level: Game Elements 3: Advanced Techniques
time: 25 min
starter: cave-4
description: A little movie at the start of your level: people talk and walk, the camera looks around, and the player can skip it.
---
# Cutscenes

A **cutscene** is a short movie inside your game. The player stops playing and watches: people talk, someone walks in, the camera shows what's ahead.

GameIDE has a set of functions for this, all starting `scene_`. Each one lines up one step, and the steps play in order, one after another. You write the movie from top to bottom, like a script.

---

## People talking

We'll play the scene when the level starts. In **Level**'s **Create** event, the map is built first. At the very end, not pushed in, add:

```python
hero = instances("Player")[0]
friend = instances("Friend")[0]
scene_say("Where is everybody?", "Hero")
scene_say("Over here! Come and see.", "Friend")
```

Play it. The words appear in a box, and Space, Enter or a click goes on. While the scene plays the whole game holds still, so your arrow keys do nothing and the slimes wait.

Notice these lines don't happen when Python reads them. Create finishes at once, and the steps play afterwards, each waiting for the one before.

highlight: code-editor

```check
Level.create uses scene_say
after 1 second holding right, Player.x stayed the same
```

---

## Walking over

Now the hero walks to the friend. Under the two `scene_say` lines, add:

```python
scene_move(hero, friend.x - 40, hero.y, 60)
```

That means: move `hero` to this x and y, taking 60 steps, which is one second. The hero's picture animates as it goes.

A move goes in a straight line and ignores walls, gravity and everything else. You're the director, so it's up to you to pick a sensible place.

````quiz
What happens with these two lines?

```py
scene_move(hero, 300, 200, 60)
scene_say("Made it!", "Hero")
```
- [x] The hero walks for a second, and then the words appear
- [ ] The words appear while the hero walks
- [ ] The words appear first, because `scene_say` is quicker
````

```check
Level.create uses scene_move
game runs 2 seconds without errors
```

---

## Walking together

Each step waits for the one before, so two moves one after the other would have them take turns. `wait=False` tells the next step not to wait, so they go together. Add:

```python
scene_say("Come on, follow me.", "Friend")
scene_move(hero, 200, hero.y, 90, wait=False)
scene_move(friend, 240, friend.y, 90)
```

The camera is still following the player during a scene, so it comes along.

```check
Level.create uses wait=False
game runs 2 seconds without errors
```

---

## Show what's ahead

`scene_camera` glides the view over to a place in the room, and `scene_wait` holds it there. Add:

```python
scene_say("There's treasure at the far end.", "Friend")
scene_camera(1600, 200, 90)
scene_wait(60)
```

When the scene ends, the camera goes back to following the player by itself. You don't have to bring it back.

`scene_wait(60)` is a pause of one second. Pauses matter more than you'd think: without them, everything feels rushed.

```check
Level.create uses scene_camera
Level.create uses scene_wait
game runs 2 seconds without errors
```

---

## A fade and a shake

A fade from black makes a better start. Right after the line that sets `friend`, above the first `scene_say`, add:

```python
screen_fade(1, 0)
scene_fade(0, 45)
```

`screen_fade(1, 0)` makes the screen black at once, and `scene_fade(0, 45)` is a step that fades it back in.

And at the very end, add some trouble:

```python
scene_shake(6, 30)
scene_say("What was that?!", "Hero")
```

```check
Level.create uses scene_fade
Level.create uses scene_shake
game runs 2 seconds without errors
```

---

## Anything else

For anything without its own `scene_` function, write a function of your own and let `scene_do` call it at the right moment. Above the first `scene_say`, add:

```python
def friend_scared():
    friend.image_blend = "yellow"
```

Then, right after your `scene_shake` line:

```python
scene_do(friend_scared)
```

There's no `()` after the name. With them, Python would call your function now, while lining up the steps. Without them, you're handing the function over to be called later.

````quiz
Why is there no `()` in `scene_do(friend_scared)`?
- [x] The function should run when the scene gets there, not now
- [ ] Functions passed to `scene_do` can't have brackets in their names
- [ ] It makes the function run faster
````

```check
Level.create uses scene_do
game runs 2 seconds without errors
```

---

## Only the first time

Touch a slime and the room restarts, so the movie plays all over again. That gets old quickly.

Wrap the whole scene in an `if`. Put these two lines above `hero = ...`, and push everything from `hero = ...` down to the end in by one level:

```python
if not hasattr(global_vars, "seen_intro"):
    global_vars.seen_intro = True
```

`global_vars` lasts through a room restart, so the second time round `seen_intro` is already there and the scene is left out.

The player can always press **Esc** to skip a scene, and the screen says so while one plays. Everything still ends up where it would have: the hero and friend are in their places, and your function has been called.

```check
Level.create uses seen_intro
game runs 2 seconds without errors
```

---

## That's a wrap

You can tell a story now. There are a few more steps to try: `scene_ask` asks a question, `scene_zoom` moves the camera in, `scene_sound` plays a sound, and `scene_room` moves on to another room. They're all in the docs under **Cutscenes**, and in the blocks too.

Every game you'll ever play is made of pieces like these. Now make your own.

Next: **Starter Projects**, whole games to take apart.
