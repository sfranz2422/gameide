---
title: 7. School Leaderboard
level: Game Elements 2: Adding to the Fun
time: 15 min
starter: dodge2-6
description: Put your score on a board beside your published game, where students at your school can try to beat it.
---
# School Leaderboard

Your game keeps your own best score. A leaderboard goes further: once your game is published, the best scores from students at your school show on each side of it.

One line of code does it. The rest is deciding what your score means.

---

## Send the score

The game is over when **EndScreen** starts, so that's when the final score is known. In **EndScreen**'s **Create** event, under the `save_set` line, add:

```python
high_score(global_vars.score)
```

The board keeps each player's best, so you don't need to check whether this score beats the last one. A worse score simply doesn't change anything.

highlight: code-editor

```quiz
Why does `high_score` go in **EndScreen**'s Create event, not in **Player**'s Step event?
- [x] The final score is known once the game is over
- [ ] `high_score` only works in a room called GameOver
- [ ] A Step event can't call a function
```

```check
EndScreen.create uses high_score
game runs 2 seconds without errors
```

---

## Say what it counts

Open **Game settings**. Under **What the score counts**, type `points`. Those words appear above your game's board, so players know what they're trying to beat.

Leave **Lowest score wins** unticked. In this game, more points is better.

highlight: game-settings

---

## Publish it

Press **Play** and finish a game. You won't see a board yet, and that's normal: nothing happens to your score while you play in the editor, because the board belongs to the published game.

So press **Publish**, give your game a title, choose **Anyone with the link**, and publish it. You need to be signed in with your school account.

Open your game's link, press Play and score some points. When the game ends, look to the left of the game. If you're in the top ten, your first name is there. On the right is your own best score and your place.

Anyone signed in with your school's email can play and get on the same board. Each time you change your game, publish it again so the link has the new version.

highlight: publish

---

## Other kinds of score

Not every game counts up. In a race or a golf game, the smallest number wins. That's what **Lowest score wins** is for.

If your score is a time, type `time` under **What the score counts** and send it in seconds. The board shows it as a clock: `high_score(65.5)` shows as `1:05.50`.

````quiz
You make a race where the player's time is in `self.seconds`. What do you need?
- [x] `high_score(self.seconds)`, with **Lowest score wins** ticked and `time` typed in Game settings
- [ ] `high_score(self.seconds)` with nothing else, because the board can tell it's a time
- [ ] `save_set("seconds", self.seconds)`, because that puts it on the board too
````

```quiz
type: match
Match each one to where it shows or keeps a score:
- save_set -> kept in this browser, for this player
- high_score -> on the board beside the published game
```

---

## On the board

Your game now has players competing with each other, and all it took was one line. Share your link and see who can beat you.

Next: **Game Elements 3: Advanced Techniques**.
