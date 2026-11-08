"""
The Python check: a showcase game stops every few minutes and asks a question.
Right, and the game goes on, with XP. Wrong, and it shows why and asks another.
Too many wrong in a row, and they're out for a while. How often, how many and how
long are each teacher's to set (CheckSettings); their students follow them.

Teachers upload the week's questions as markdown: the same ```quiz blocks as
notes (quiz.py), every self-marked kind, and an optional `explain:` line, shown
after a wrong answer. A long response is marked by hand, so it's refused: nobody
is there to mark it while the game waits. A ```python predict block is turned
into a ```quiz predict block BY THE TEACHER'S PAGE before it gets here
(pycheck/bank.ts runs it in that browser's Python). THIS SERVER NEVER RUNS
UPLOADED CODE: a block still unconverted is refused.

THE SERVER IS IN CHARGE of the rest. The key never reaches a student
(`quiz.redact`), and when the next question is due lives here, per person across
every game: if the clock lived in the page, reloading it would start the clock
again. A next question before it's due is refused, so XP can't be farmed, and an
answer is only taken for the question that was asked.

What this can't do: a student with the browser's tools could unfreeze the game
on their own page. The teacher's report shows who has played without answering.
Teachers get the same questions as practice: nothing recorded, no lockout, no XP.
"""
import json
import math
import os
import random
import re
from datetime import datetime, timedelta
from types import SimpleNamespace

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func

import accounts
import notes
import publishing
import quiz
import rewards
import xp
from gamestore import CheckAnswer, CheckBank, CheckSettings, CheckState
from publishing import classes_of, err, is_admin, is_teacher

bp = Blueprint("pycheck", __name__)

#: What a teacher who hasn't changed anything gets. A test sets the seconds low.
EVERY = int(os.environ.get("GAMEIDE_CHECK_SECONDS") or 300)
STRIKES_OUT = 3            # this many wrong in a row, and they're out
LOCK_SECONDS = int(os.environ.get("GAMEIDE_CHECK_LOCK_SECONDS") or 120)
#: How long a question that's due waits for the game to say it's a fair moment
#: (question_ok: Snowcap Scramble when you're standing, a racer between races)
#: before it's asked anyway, so no game can put questions off for ever. Long
#: enough for a race to finish. A test sets it low.
FAIR_WAIT = int(os.environ.get("GAMEIDE_CHECK_FAIR_SECONDS") or 120)
#: What a teacher may set them to: (lowest, highest), and what to call it when refusing.
#: The most playing one report from the page can claim: it reports every few seconds.
TICK_MOST = 30
LIMITS = {"everyMinutes": (1, 60, "Minutes of play between questions"), "strikesOut": (1, 10, "Wrong answers in a row"), "lockMinutes": (1, 60, "Minutes out")}
MAX_BANK = 400_000         # characters of markdown
EXPLAIN = re.compile(r"^explain\s*:\s*(.*)$", re.I)


def now():
    """Without a timezone, as the database's DateTime columns hand them back."""
    return publishing.now().replace(tzinfo=None)


# ---------------------------------------------------------------- reading a bank

def _unconverted(md, problems):
    """A predict block should have been turned into a question by the page that sent it."""
    for n, ln in enumerate(str(md).replace("\r\n", "\n").split("\n")):
        m = xp._PREDICT_OPEN.match(ln)
        if m:
            problems.append(f"Line {n + 1}: an html predict block shows a web page, and a game's check can't."
                            if m.group(2).lower() == "html" else
                            f"Line {n + 1}: this predict block hasn't been run yet. Upload it from the Python Check page.")


def _take_explain(body):
    """A block's `explain:` line, taken out (it isn't part of a quiz block), outside any code."""
    keep, explain, inner = [], "", None
    for ln in body:
        f = quiz.FENCE.match(ln)
        if f:
            inner = None if inner else f.group(1)
        m = EXPLAIN.match(ln.strip()) if inner is None and not f else None
        if m:
            explain = m.group(1).strip()
        else:
            keep.append(ln)
    return keep, explain


def read_bank(md):
    """A markdown file's questions, and what's wrong with it in words. A bank
    with any problem is refused whole: a typo shouldn't quietly lose a question."""
    problems, questions, seen = [], [], set()
    _unconverted(md, problems)
    n = 0
    for piece in quiz._blocks(str(md or "")):
        if piece[0] != "quiz":
            continue
        n += 1
        _, opener, body, closer = piece
        keep, explain = _take_explain(body)
        q = quiz.parse("\n".join(keep))
        first = next((l.strip() for l in keep if l.strip()), "")[:60]
        where = f'Question {n} ("{first}")'
        if q["kind"] == "long":
            problems.append(f"{where}: a long answer needs marking by hand, and the game can't wait for that.")
        elif not q["qid"]:
            problems.append(f"{where}: it isn't finished. It needs its question, its answer and enough choices.")
        elif q["qid"] not in seen:
            seen.add(q["qid"])
            shown = quiz.redact("\n".join([opener] + keep + [closer])).split("\n")
            questions.append({"qid": q["qid"], "kind": q["kind"], "prompt": q["prompt"], "choices": q["choices"],
                              "correct": q["correct"], "answers": q["answers"], "options": q["options"],
                              "points": q["points"], "explain": explain, "shown": "\n".join(shown[1:-1])})
    if not questions and not problems:
        problems.append("There are no questions in it. A question is a ```quiz block or a ```python predict block.")
    return questions, problems


def answer_text(q):
    """The right answer in words, for after a wrong one."""
    kind = q["kind"]
    if kind == "choice":
        return " or ".join(q["correct"])
    if kind in ("text", "predict"):
        return q["answers"][0]
    if kind == "blank":
        return " · ".join(a[0] for a in q["answers"])
    if kind == "match":
        return "; ".join(f"{l} → {r}" for l, r in zip(q["choices"], q["correct"]))
    if kind == "sort":
        return "; ".join(f"{i} → {g}" for i, g in zip(q["choices"], q["correct"]))
    if kind == "order":
        return "\n".join(q["correct"])
    if kind == "bug":
        return "line " + " or line ".join(q["correct"])
    return ""


# ---------------------------------------------------------------- whose bank, whose turn

def practising(user):
    return user is not None and (is_teacher(user) or is_admin(user))


def bank_for(db, user, pub=None):
    """The questions this person gets: their own if they're a teacher with some;
    else their class's teacher's; else the newest anyone has uploaded. A guest
    (not signed in) gets the bank of the teacher who published the game."""
    q = db.query(CheckBank).order_by(CheckBank.id.desc())
    if user is None:
        return (q.filter(CheckBank.teacher_id == pub.owner_id).first() if pub else None) or q.first()
    teachers = {user.id} | {c.teacher_id for c in classes_of(db, user)}
    return q.filter(CheckBank.teacher_id.in_(teachers)).first() or q.first()


class GuestState:
    """
    A guest's place in the check (someone playing without signing in, the
    teacher's choice, 2026-11-07): the same fields as CheckState, kept in their
    session cookie. Flask signs the cookie, so it can't be altered, only thrown
    away: clearing cookies starts a guest's clock and strikes afresh. That's the
    price of no account; a guest earns no XP and isn't on any report.
    """
    KEY = "check_guest"

    def __init__(self):
        d = session.get(self.KEY) or {}
        when = lambda k: datetime.fromisoformat(d[k]) if d.get(k) else None
        self.locked_until, self.ticked_at = when("locked_until"), when("ticked_at")
        self.play_left = d.get("play_left")
        self.strikes = int(d.get("strikes", 0))
        self.pending = str(d.get("pending", ""))
        self.recent = str(d.get("recent", "[]"))

    def save(self):
        iso = lambda t: t.isoformat() if t else None
        session[self.KEY] = {"play_left": self.play_left, "ticked_at": iso(self.ticked_at), "locked_until": iso(self.locked_until),
                             "strikes": self.strikes, "pending": self.pending, "recent": self.recent}


def settings_for(db, teacher_id):
    """A teacher's timing and penalty, or the defaults: every and lock in seconds."""
    row = db.query(CheckSettings).get(teacher_id) if teacher_id else None
    if row is None:
        return {"every": EVERY, "strikes": STRIKES_OUT, "lock": LOCK_SECONDS}
    return {"every": row.every_seconds, "strikes": row.strikes_out, "lock": row.lock_seconds}


def _settings_of(db, bank):
    return settings_for(db, bank.teacher_id if bank else None)


def _state(db, user):
    if user is None:
        return GuestState()
    st = db.query(CheckState).get(user.id)
    if st is None:
        st = CheckState(user_id=user.id, strikes=0, pending="", recent="[]")
        db.add(st)
        db.flush()
    return st


def lock_left(st):
    """Seconds before they may play again; 0 if they may."""
    if st is None or st.locked_until is None or st.locked_until <= now():
        return 0
    return int((st.locked_until - now()).total_seconds()) + 1


def play_refusal(db, pub, user):
    """Why this person can't start this showcase game now, or None: (message, status)."""
    if not pub.showcase or practising(user):
        return None
    left = lock_left(GuestState() if user is None else db.query(CheckState).get(user.id))
    if left:
        return (f"Too many wrong answers. You can play again in {left} seconds.", 423)
    if bank_for(db, user, pub) is None:
        return ("This game needs Python questions, and your teacher hasn't added any yet.", 423)
    return None


def _game(db, slug):
    """The showcase game and whoever is playing it (None: a guest), or a refusal raised."""
    user = publishing._current_user(db)
    pub = publishing._pub_or_404(db, slug)
    why = publishing._viewable(db, pub, user)
    if why:
        publishing.fail(*why)
    if not pub.showcase:
        publishing.fail("This game has no Python check.", 400)
    return user, pub


def _keep(db, st):
    """Saves where they are: a signed-in person's row, or a guest's cookie."""
    if isinstance(st, GuestState):
        st.save()
    db.commit()


def _due_in(st):
    """Seconds of playing until the next question. They've always a play_left by now (start sets it)."""
    if st.pending or st.play_left is None:
        return 0
    return max(0, math.ceil(st.play_left))


def _ask(st, bank):
    """A question for them: the pending one, or one they haven't had lately."""
    questions = json.loads(bank.questions)
    q = next((x for x in questions if x["qid"] == st.pending), None)
    if q is None:
        recent = json.loads(st.recent or "[]")
        last = recent[-1] if recent else ""
        fresh = [x for x in questions if x["qid"] not in recent] or [x for x in questions if x["qid"] != last] or questions
        q = random.choice(fresh)
        st.pending = q["qid"]
        # Remember half the bank's worth, so a small bank still goes round.
        st.recent = json.dumps((recent + [q["qid"]])[-max(1, len(questions) // 2):])
    return {"block": q["shown"], "kind": q["kind"]}


# ---------------------------------------------------------------- playing

@bp.post("/api/play/<slug>/check/start")
def start(slug):
    """Where this person is, as the page starts a game."""
    db = publishing._db()
    try:
        user, pub = _game(db, slug)
        st = _state(db, user)
        cfg = _settings_of(db, bank_for(db, user, pub))
        if st.play_left is None:
            st.play_left = cfg["every"]
        out = {"every": cfg["every"], "dueIn": _due_in(st), "locked": 0 if practising(user) else lock_left(st),
               "practice": practising(user), "strikes": st.strikes, "fairWait": FAIR_WAIT, "guest": user is None}
        _keep(db, st)
        return jsonify(out)
    finally:
        db.close()


@bp.post("/api/play/<slug>/check/tick")
def tick(slug):
    """
    The page saying how long they've been PLAYING since it last said (a key, the
    mouse, a touch or a pad in the last half minute, the game running and on
    show): only that counts toward the next question, not sitting on a menu.
    Never more than has really passed, nor TICK_MOST at once. A page could stop
    sending these and put questions off; the report shows who plays unanswered.
    """
    db = publishing._db()
    try:
        user, pub = _game(db, slug)
        st = _state(db, user)
        try:
            claimed = max(0.0, min(float((request.get_json(silent=True) or {}).get("seconds") or 0), TICK_MOST))
        except (TypeError, ValueError):
            return err("How many seconds is a number.", 400)
        t = now()
        if st.ticked_at is not None:
            claimed = min(claimed, max(0.0, (t - st.ticked_at).total_seconds()) + 1)
        st.ticked_at = t
        if st.play_left is None:
            st.play_left = _settings_of(db, bank_for(db, user, pub))["every"]
        if not st.pending and not lock_left(st):
            st.play_left = max(0.0, st.play_left - claimed)
        out = {"dueIn": _due_in(st)}
        _keep(db, st)
        return jsonify(out)
    finally:
        db.close()


@bp.post("/api/play/<slug>/check/next")
def next_question(slug):
    db = publishing._db()
    try:
        user, pub = _game(db, slug)
        st = _state(db, user)
        if lock_left(st) and not practising(user):
            return err("You're out for now.", 423)
        # A little leeway: the page's clock and this one started a moment apart.
        if not st.pending and st.play_left is not None and st.play_left > 3:
            return err("It isn't time for a question yet.", 409)
        bank = bank_for(db, user, pub)
        if bank is None:
            return err("There are no questions yet.", 404)
        q = _ask(st, bank)
        _keep(db, st)
        return jsonify(q)
    finally:
        db.close()


@bp.post("/api/play/<slug>/check/answer")
def answer(slug):
    db = publishing._db()
    try:
        user, pub = _game(db, slug)
        st = _state(db, user)
        bank = bank_for(db, user, pub)
        q = next((x for x in json.loads(bank.questions) if x["qid"] == st.pending), None) if bank else None
        if q is None:
            return err("That question has gone. Ask for the next one.", 409)
        response = str((request.get_json(silent=True) or {}).get("response") or "")
        key = SimpleNamespace(kind=q["kind"], answers=json.dumps(q["answers"]), correct=json.dumps(q["correct"]), choices=json.dumps(q["choices"]))
        response, bad = notes._clean_response(key, response)
        if bad:
            return bad
        if not response:
            return err("Answer the question first.", 400)
        cfg = _settings_of(db, bank)
        right = quiz.fraction(q["kind"], q["correct"], q["answers"], response) == 1.0
        practice = practising(user)
        st.pending = ""
        out = {"response": response, "correct": right, "points": q["points"], "earned": q["points"] if right else 0}
        if q["kind"] == "predict":
            out["output"] = q["answers"][0]
        if not practice and user is not None:
            db.add(CheckAnswer(user_id=user.id, bank_id=bank.id, slug=pub.slug, qid=q["qid"], correct=1 if right else 0, created_at=now()))
        if right:
            st.strikes = 0
            st.play_left = cfg["every"]
        else:
            st.strikes = 0 if practice else st.strikes + 1
            out.update(rightAnswer=answer_text(q), explain=q["explain"], strikes=st.strikes, strikesOut=cfg["strikes"])
            if st.strikes >= cfg["strikes"]:
                st.strikes = 0
                st.locked_until = now() + timedelta(seconds=cfg["lock"])
                st.play_left = cfg["every"]
                out["locked"] = cfg["lock"]
        _keep(db, st)
        # Once per question, whichever week it comes round: the unique source sees to that.
        if right and not practice and user is not None and rewards.earns_xp(user):
            got = xp.award(db, user.id, "check:" + q["qid"], q["points"] * xp.XP_PER_POINT, "Python check in " + pub.title, rewards.APP_NAME)
            if got:
                out["xp"] = got
        return jsonify(out)
    finally:
        db.close()


# ---------------------------------------------------------------- the teacher's page

def _teacher(db):
    user = publishing._need_user(db)
    if not practising(user):
        publishing.fail("That's for teachers.", 403)
    return user


def _bank_summary(bank):
    if bank is None:
        return None
    questions = json.loads(bank.questions)
    kinds = {}
    for q in questions:
        kinds[q["kind"]] = kinds.get(q["kind"], 0) + 1
    return {"name": bank.name, "uploaded": bank.created_at.isoformat() + "Z", "count": len(questions), "kinds": kinds, "source": bank.source,
            "questions": [{"kind": q["kind"], "prompt": q["prompt"], "answer": answer_text(q), "explain": q["explain"]} for q in questions]}


def _settings_reply(db, user):
    cfg = settings_for(db, user.id)
    return {"everyMinutes": cfg["every"] / 60, "strikesOut": cfg["strikes"], "lockMinutes": cfg["lock"] / 60}


@bp.post("/api/check/settings")
def post_settings():
    """Changes whichever of the timing and penalty were sent. Students follow from
    their next question: one already on its way isn't moved."""
    db = publishing._db()
    try:
        user = _teacher(db)
        body = request.get_json(silent=True) or {}
        cfg = settings_for(db, user.id)
        for name, (low, high, words) in LIMITS.items():
            if name not in body:
                continue
            v = body[name]
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not low <= v <= high:
                return err(f"{words} must be a number from {low} to {high}.", 400)
        if "everyMinutes" in body:
            cfg["every"] = round(body["everyMinutes"] * 60)
        if "strikesOut" in body:
            cfg["strikes"] = int(body["strikesOut"])
        if "lockMinutes" in body:
            cfg["lock"] = round(body["lockMinutes"] * 60)
        row = db.query(CheckSettings).get(user.id)
        if row is None:
            row = CheckSettings(teacher_id=user.id)
            db.add(row)
        row.every_seconds, row.strikes_out, row.lock_seconds = cfg["every"], cfg["strikes"], cfg["lock"]
        db.commit()
        return jsonify(settings=_settings_reply(db, user))
    finally:
        db.close()


@bp.get("/api/check/bank")
def get_bank():
    db = publishing._db()
    try:
        user = _teacher(db)
        mine = db.query(CheckBank).filter_by(teacher_id=user.id).order_by(CheckBank.id.desc()).first()
        return jsonify(bank=_bank_summary(mine), settings=_settings_reply(db, user))
    finally:
        db.close()


@bp.post("/api/check/bank")
def post_bank():
    """Reads a new bank. With `save`, and nothing wrong with it, it's the bank from now on."""
    db = publishing._db()
    try:
        user = _teacher(db)
        body = request.get_json(silent=True) or {}
        md = str(body.get("markdown") or "")
        if len(md) > MAX_BANK:
            return err("That file is too long for a week's questions.", 413)
        questions, problems = read_bank(md)
        out = {"problems": problems, "count": len(questions)}
        if problems or not body.get("save"):
            return jsonify(out)
        source = str(body.get("source") or md)
        if len(source) > MAX_BANK:
            return err("That file is too long for a week's questions.", 413)
        bank = CheckBank(teacher_id=user.id, name=str(body.get("name") or "This week's questions")[:120], source=source, markdown=md,
                         questions=json.dumps(questions), created_at=now())
        db.add(bank)
        db.commit()
        out["bank"] = _bank_summary(bank)
        return jsonify(out)
    finally:
        db.close()


@bp.get("/api/check/report")
def report():
    """Each student's answers to this teacher's current bank."""
    db = publishing._db()
    try:
        user = _teacher(db)
        bank = db.query(CheckBank).filter_by(teacher_id=user.id).order_by(CheckBank.id.desc()).first()
        if bank is None:
            return jsonify(students=[])
        rows = (db.query(CheckAnswer.user_id, func.count(CheckAnswer.id), func.sum(CheckAnswer.correct), func.max(CheckAnswer.created_at))
                .filter_by(bank_id=bank.id).group_by(CheckAnswer.user_id).all())
        people = {u.id: u for u in db.query(accounts.User).filter(accounts.User.id.in_([r[0] for r in rows] or [-1]))}
        students = [{"name": people[r[0]].name, "answered": r[1], "right": int(r[2] or 0), "last": r[3].isoformat() + "Z"} for r in rows if r[0] in people]
        return jsonify(students=sorted(students, key=lambda s: s["name"]))
    finally:
        db.close()
