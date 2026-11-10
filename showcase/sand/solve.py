"""
The level checker for Pour Decisions: can a level be finished, and in how few pours?

A level is its tubes, each a list of colours from the bottom up, and how much a
tube holds. A pour moves the top run of one colour from one tube onto another
whose top is that colour, or that is empty, as much as fits: exactly the game's
rule (can_pour and pour in game/_2sand.py; the build checks the two agree).

The fewest pours is found breadth first over every arrangement, counting two that
differ only in the order of their tubes as one. It's the par the stars are given
against. Hidden layers make no difference here: the checker sees them all.
"""
from collections import deque


def top_run(tube):
    if not tube:
        return None, 0
    c, n = tube[-1], 0
    for x in reversed(tube):
        if x != c:
            break
        n += 1
    return c, n


def pours(state, cap):
    """Every pour from this arrangement, as (from, to, how many)."""
    for i, a in enumerate(state):
        c, n = top_run(a)
        if not n:
            continue
        for j, b in enumerate(state):
            if i == j or len(b) >= cap or (b and b[-1] != c):
                continue
            # A tube that's all one colour, poured into an empty one, changes nothing.
            if not b and n == len(a):
                continue
            yield i, j, min(n, cap - len(b))


def apply(state, i, j, k):
    s = list(state)
    s[j] = s[j] + s[i][-k:]
    s[i] = s[i][:-k]
    return tuple(s)


def solved(state, cap):
    return all(not t or (len(t) == cap and len(set(t)) == 1) for t in state)


def key(state):
    return tuple(sorted(state))


def solve(tubes, cap, limit=3_000_000):
    """The fewest pours that finish it and the pours themselves, or None if it can't be finished."""
    start = tuple(tuple(t) for t in tubes)
    if solved(start, cap):
        return 0, []
    seen = {key(start): None}
    came = {}
    q = deque([start])
    while q:
        s = q.popleft()
        for i, j, k in pours(s, cap):
            n = apply(s, i, j, k)
            kn = key(n)
            if kn in seen:
                continue
            seen[kn] = True
            came[n] = (s, (i, j))
            if solved(n, cap):
                path = []
                while n in came:
                    n, mv = came[n]
                    path.append(mv)
                return len(path), path[::-1]
            if len(seen) > limit:
                raise RuntimeError("too big to check")
            q.append(n)
    return None
