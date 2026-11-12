#!/usr/bin/env python3
"""
Writes game/_1levels.py: every level's tubes, shuffled from a seed, chosen so the
levels get harder in a steady climb. Run it again only to change the levels;
build.py re-checks every one (solve.py) and refuses a level that can't be
finished or whose par is wrong.

    python3 showcase/sand/make_levels.py
"""
import random
from pathlib import Path

from solve import solve

HERE = Path(__file__).resolve().parent
CAP = 4
LETTERS = "ROYGCBPKWN"

# (name, colours, empty tubes, hidden layers, how hard: 0 easiest of the seeds tried, 1 hardest)
PLAN = [
    ("First Pour", 2, 1, False, 0.0),
    ("Three Colours", 3, 2, False, 0.2),
    ("Tight Squeeze", 3, 1, False, 0.3),
    ("Sunset", 4, 2, False, 0.3),
    ("Dune Sea", 4, 2, False, 0.6),
    ("Mirage", 4, 1, False, 0.5),
    ("Five Jars", 5, 2, False, 0.4),
    ("Oasis", 5, 2, False, 0.7),
    ("Sandstorm", 5, 1, False, 0.6),
    ("Caravan", 6, 2, False, 0.4),
    ("Hourglass", 6, 2, False, 0.7),
    ("Camel Crossing", 6, 2, False, 0.9),
    ("Lost Ruins", 7, 2, False, 0.5),
    ("Scorpion Pass", 7, 2, False, 0.8),
    ("Tall Order", 7, 2, False, 0.95),
    ("Night Sky", 8, 2, False, 0.5),
    ("Buried", 5, 2, True, 0.5),
    ("Under the Dunes", 6, 2, True, 0.6),
    ("Tomb Dust", 7, 2, True, 0.6),
    ("Painted Canyon", 8, 2, False, 0.9),
    ("Deep Digging", 8, 2, True, 0.7),
    ("Rainbow Desert", 9, 2, False, 0.8),
    ("Nine Lives", 9, 2, True, 0.7),
    ("The Grand Sort", 10, 2, False, 0.9),
    # The second shelf (2026-11-12, the teacher's ask for more): one empty tube with
    # many colours, more of them covered, and the hardest of the seeds tried.
    ("Second Wind", 6, 1, False, 0.5),
    ("Sand Glass", 7, 2, True, 0.8),
    ("Kasbah", 7, 1, False, 0.5),
    ("Salt Flats", 8, 2, True, 0.8),
    ("Silk Road", 8, 1, False, 0.5),
    ("Starfall", 9, 2, False, 0.95),
    ("Hidden Spring", 6, 1, True, 0.8),
    ("Crowded Market", 9, 1, False, 0.5),
    ("Desert Bloom", 9, 2, True, 0.9),
    ("Ten Tall Tubes", 10, 2, False, 1.0),
    ("Whirlwind", 7, 1, True, 0.8),
    ("Golden Hour", 10, 2, True, 0.8),
    ("Mesa", 8, 1, True, 0.6),
    ("Echo Canyon", 9, 1, False, 0.9),
    ("Long Shadows", 10, 2, True, 0.95),
    ("Shifting Sands", 8, 1, False, 1.0),
    ("Sun Temple", 10, 2, True, 1.0),
    ("Quicksand", 8, 1, True, 1.0),
    ("Night Caravan", 9, 1, True, 0.6),
    ("Dust Devil", 9, 1, False, 1.0),
    ("Last Oasis", 7, 1, True, 1.0),
    ("The Deep Dig", 9, 1, True, 0.9),
    ("Mirage City", 10, 2, True, 1.0),
    ("Grand Finale", 9, 1, True, 1.0),
]
TRIES = 60
# The first shelf's levels were found among TRIES * 4 seeds each, from 1000 * n.
# Saves keep stars and points by a level's number, so those must stay exactly as
# they are: only the levels after FIRST_SHELF search further (one empty tube and
# eight or nine colours can be finished about once in a hundred deals), from
# seeds of their own.
FIRST_SHELF = 24
MORE_SEEDS = 12000


def deal(rng, colours, empty):
    layers = [LETTERS[c] for c in range(colours) for _ in range(CAP)]
    rng.shuffle(layers)
    tubes = ["".join(layers[i * CAP:(i + 1) * CAP]) for i in range(colours)] + [""] * empty
    return tubes


def fair(tubes):
    # Never a tube already done, and never three of a colour waiting on top at the start.
    return all(len(set(t)) > 1 and t[-1] != t[-2] or not t for t in tubes)


def main():
    out = []
    for n, (name, colours, empty, hidden, hard) in enumerate(PLAN):
        found = []
        first = n < FIRST_SHELF
        for seed in range(TRIES * 4 if first else MORE_SEEDS):
            rng = random.Random(1000 * n + seed if first else 1_000_000 + 100_000 * n + seed)
            tubes = deal(rng, colours, empty)
            if not fair(tubes):
                continue
            try:
                r = solve([list(t) for t in tubes], CAP)
            except RuntimeError:     # too many arrangements to be sure of its par
                continue
            if r is None:
                continue
            found.append((r[0], seed, tubes))
            if len(found) >= TRIES:
                break
        found.sort()
        par, seed, tubes = found[round(hard * (len(found) - 1))]
        out.append((name, tubes, par, hidden))
        print(f"{n + 1:2}. {name:16} {colours} colours, {empty} empty{' hidden' if hidden else '':7}  par {par}   ({found[0][0]}..{found[-1][0]})")

    lines = [
        "# script: levels",
        "# Every level. Each tube is its sand from the bottom up, one letter a layer",
        "# (COLOURS says which letter is which); \"\" is an empty tube. par is the fewest",
        "# pours that finish it, and build.py checks that it's right and that the level",
        "# can be finished at all. hidden: every layer but the top starts covered.",
        "# Made by make_levels.py; to change a level, change it here and build.",
        f"CAP = {CAP}",
        "LEVELS = [",
    ]
    for name, tubes, par, hidden in out:
        lines.append(f'    {{"name": "{name}", "par": {par}, "hidden": {hidden}, "tubes": {tubes!r}}},'.replace("'", '"'))
    lines.append("]")
    (HERE / "game" / "_1levels.py").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
