# script: code
# The Python puzzles. The aliens, the janitor and the principal all run
# their gadgets on Python, so getting past them means reading a little of
# it: a program on a screen, and three answers to pick from. A wrong
# answer is never a dead end: Robin says why it's wrong and you try again.
# The right one says why it's right, so whoever guessed still learns it.
#
#   title    what the screen is
#   code     the program, line by line (47 characters at most, and only
#            characters the pixel font has)
#   error    what Python said when it ran (shown in red), if it crashed
#   ask      the question under the program
#   answers  (what you pick, right?, what Robin says about it)
#
# build.py runs every one in real Python before the game is made — each
# answer, swapped in the way `check` says — and refuses to build if the
# right answer isn't the one Python agrees with:
#   setup    Python run before the code (the gadget's own functions)
#   fix      the line an answer replaces; without it the answer is what
#            input() returns, or what the program must print
#   goal     what the program prints when it worked; without it, the
#            answer itself

PUZZLES = {
    "intercom": {
        "title": "INTERCOM",
        "code": ['# Principal only!',
                 'staff = ["Hoover", "Gus", "Glorbin"]',
                 'boss = staff[0]',
                 'name = input("Who is speaking? ")',
                 'if name == boss:',
                 '    mic_on()'],
        "ask": "Who is speaking?",
        "answers": [
            ("Hoover", True, "Python counts from 0, so staff[0] is the first name: Hoover. Ahem. I am Principal Hoover."),
            ("Gus", False, "Gus is staff[1]. Python starts counting at 0, so [1] is the SECOND name."),
            ("Glorbin", False, "Glorbin is last: staff[2], or staff[-1]. The intercom wants staff[0]."),
        ],
        "check": {"setup": "def mic_on():\n    print('OK')", "goal": "OK"},
    },
    "freezer": {
        "title": "FREEZER KEYPAD - sticky note",
        "code": ["# Earth numbers are hard. -G",
                 "code = 0",
                 "for n in range(1, 5):",
                 "    code = code * 10 + n",
                 "print(code)"],
        "ask": "What do I type on the keypad?",
        "answers": [
            ("1234", True, "range(1, 5) gives 1, 2, 3, 4, and each one slides the digits left: 1, 12, 123, 1234."),
            ("12345", False, "Beep! range(1, 5) stops BEFORE 5. It only gives 1, 2, 3, 4."),
            ("10", False, "Beep! 10 would be adding them up. code * 10 slides the digits left first."),
        ],
        "check": {},
    },
    "analyzer": {
        "title": "GUS'S ANALYZER",
        "code": ['reading = input("Weirdness level: ")',
                 'if reading > 9000:',
                 '    print("NOT FROM EARTH!")'],
        "error": "TypeError: '>' not supported: str and int",
        "ask": "Which line fixes line 2?",
        "answers": [
            ("if int(reading) > 9000:", True, "input() always gives back a string. int() turns it into a number you can compare."),
            ("if len(reading) > 9000:", False, "len() counts letters. '9001' is only 4 long. It'd never be more than 9000."),
            ("if reading + 1 > 9000:", False, "Same crash. reading is still a string, and you can't add 1 to a string."),
        ],
        "check": {"setup": "def input(prompt=''):\n    return '9001'", "fix": 1, "goal": "NOT FROM EARTH!"},
    },
    "antenna": {
        "title": "BEAM CONTROL (translated)",
        "code": ["sector = 3",
                 "sector = sector + 4",
                 "sector = sector * 2",
                 "beam_to(sector)"],
        "ask": "Which sector is the ship in?",
        "answers": [
            ("14", True, "Each line uses sector as it is NOW: 3, then 3 + 4 is 7, then 7 * 2 is 14."),
            ("11", False, "Zap! A pigeon vanishes. 11 is 3 + 4 * 2, but these are separate lines: the + happens first."),
            ("2", False, "Zap! Nothing there. sector * 2 doubles what sector already holds. It doesn't make it 2."),
        ],
        "check": {"setup": "def beam_to(s):\n    print(s)"},
    },
    "machine": {
        "title": "SLEEPY SAUCE RECIPE",
        "code": ['recipe = ["meat", "gravy", "sleepy dust"]',
                 '# add an ingredient here',
                 'pump(recipe)'],
        "ask": "What do I type in?",
        "answers": [
            ('recipe.append("hot sauce")', True, "append() adds to the end of the list. The recipe is now four things, and one of them BURNS."),
            ('recipe[3] = "hot sauce"', False, "IndexError! The list only goes up to recipe[2]. You can't set a spot that isn't there yet."),
            ('recipe + "hot sauce"', False, "TypeError! You can only add a list to a list. And it wouldn't change recipe anyway."),
        ],
        "check": {"setup": "def pump(r):\n    print('OK' if r[-1] == 'hot sauce' and len(r) == 4 else 'no')", "fix": 1, "goal": "OK"},
    },
}


def puzzle(pid, solved):
    """Shows a puzzle and asks it. solved() queues what happens when it's right."""
    then(lambda: STATE.update(code=pid))
    menu(lambda: puzzle_options(pid, solved))


def puzzle_options(pid, solved):
    out = []
    for words, right, why in PUZZLES[pid]["answers"]:
        if right:
            out.append((words, lambda why=why: (say_line("robin", why), sound("pickup"),
                                                then(lambda: STATE.update(code=None)), solved())))
        else:
            out.append((words, lambda why=why: (sound("nope"), say_line("robin", why),
                                                menu(lambda: puzzle_options(pid, solved)))))
    out.append(("Never mind.", lambda: STATE.update(code=None)))
    return out
