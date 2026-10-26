# Thornwood: the showcase game

A sword-and-maze platformer in the style of the old Metroid and Castlevania
games, made entirely with GameIDE's own features, to be featured on
Explore. Everything here builds it; nothing here is the game's art.

```
python3 showcase/build.py            # → showcase/out/Thornwood.zip (and project.json)
```

Then on GameIDE's front page: **Import**, choose the zip, press Play.

## The art is not in this repository

It is Anokolisa's **Legacy Fantasy** series (anokolisa.itch.io): the free
*High Forest* pack (the hero, the snail, boar and bee, the forest tiles) and
the *Wild Boar* pack (the first boss). The author's terms let it be used in
any game, changed and published inside one, but not handed out or sold as
art — so the repository holds only the code that reads it, from
`~/Downloads` by default (`--assets DIR` for elsewhere). The built zip
carries the pictures inside the game, which the terms allow. Credits are
optional; the title screen gives them anyway.

## What's here

| | |
|---|---|
| `build.py` | which picture is which sprite, the sounds (made here; the packs have none), a level map → tile layers and instances, the zip |
| `game/*.py` | every object's events, one file each, with a small header (`# sprite:`, `# parent:`…); `_1config.py` and `_2helpers.py` are the shared scripts |
| `levels/*.txt` | each level as a text map, one character per 16 px tile — the key is at the top of each file |
| `font.py` | a small pixel font drawn for the game (the text is sprites, crisp at any size) |
| `reach.py` | the route checker: can the level be finished? |

## The route checker

Every build runs `reach.py` over every level and refuses to build one that
can't be finished. It moves a box the size of the hero's with the hero's
own physics — read from `game/_1config.py`, so changing the jump re-checks
every level — through every run and jump it can find, in the order the
level is played: from the start without the relic; from the relic with its
double jump; from the key, with the gate open. It has caught a map whose
deep cave erased two planks of the only way back up.

## The playtest

`frontend/src/showcase/thornwood.test.ts` plays the built game headless, in
the real Pyodide: the hero stands, runs and jumps the heights the levels are
drawn for, the sword kills, and a small bot beats the boss and walks through
the door. It runs with the other Vitest suites when the game has been built,
and is skipped when it hasn't (on a machine without the art).
