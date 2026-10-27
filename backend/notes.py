"""
An assignment's notes (Phase 11a): what the teacher writes, the questions in
them and the tests, shown to students in the editor's Notes tab.

  notes      markdown, kept as notes.md in Assignment.files (grades.NOTES).
             Slides are cut at lines of `---`, as in PyIDE.
  questions  ```quiz blocks, PyIDE's format exactly (quiz.py, a copy of
             PyIDE's). One try, marked at once; the points go on top of the
             teacher's score (grades.total).
  tests      ```tests blocks in GameIDE's check language (checks.py). They
             run in a browser, never here: a student's Check my work in
             theirs (feedback, which could be faked, so it counts toward no
             grade), the teacher's Check all in the teacher's, on what each
             student turned in — and that one counts.

THE NOTES GO TO STUDENTS, SO THE KEY IS TAKEN OUT AT EVERY EXIT. The one
exit is classes.project_assignment, which sends quiz.redact(notes) to the
student's editor; the key is kept in the shared quiz_questions table,
written whenever the teacher saves the notes. A new route that hands an
assignment's notes to a student must redact too, and needs a check in
test_server.py's leak checks: a missed exit leaks the answers with no
visible sign.
"""
import hashlib
import json
import re

from flask import Blueprint, abort, jsonify, make_response, request

import accounts
import grades
import quiz
import rewards
import xp
from accounts import now
from gamestore import GameProject, GameVersion

bp = Blueprint("notes", __name__)

APP_NAME = "gameide"
MAX_NOTES = 100_000
#: A long response is a few paragraphs of HTML; a short answer is a word.
LONG_RESPONSE_MAX = 20000

_db = None
_current_user = None


def init(app, session_factory, current_user):
    global _db, _current_user
    _db, _current_user = session_factory, current_user
    app.register_blueprint(bp)


def err(message, status):
    return jsonify(error=message), status


def fail(message, status):
    abort(make_response(jsonify(error=message), status))


def _need_user(db):
    user = _current_user(db)
    if user is None:
        fail("Sign in first.", 401)
    return user


def _assignment(db, slug):
    a = db.query(accounts.Assignment).filter_by(slug=str(slug or "")[:16], app=APP_NAME).first()
    if a is None:
        fail("No such assignment.", 404)
    return a


def _own_assignment(db, user, slug):
    a = _assignment(db, slug)
    if a.teacher_id != user.id:
        fail("That's not one of your assignments.", 403)
    return a


def store_quiz_keys(db, a, text):
    """Keep the answer key of every question in these notes. Writes only what
    is new or changed; a race on a new question leaves the same key."""
    found = {q["qid"]: q for q in quiz.keys(text)}
    if not found:
        return
    have = {row.qid: row for row in db.query(accounts.QuizQuestion).filter(
        accounts.QuizQuestion.assignment_id == a.id, accounts.QuizQuestion.qid.in_(list(found)))}
    for qid, q in found.items():
        fields = {"kind": q["kind"], "prompt": q["prompt"], "choices": json.dumps(q["choices"]),
                  "correct": json.dumps(q["correct"]), "answers": json.dumps(q["answers"]), "points": q["points"]}
        row = have.get(qid)
        if row is None:
            db.add(accounts.QuizQuestion(assignment_id=a.id, qid=qid, **fields))
        elif any(getattr(row, k) != v for k, v in fields.items()):
            for k, v in fields.items():
                setattr(row, k, v)
            row.updated_at = now()
    try:
        db.commit()
    except Exception:
        db.rollback()


def student_notes(a):
    """The notes as a student may have them: the key taken out."""
    return quiz.redact(grades.notes_of(a))


@bp.post("/api/assignments/<slug>/notes")
def save_notes(slug):
    db = _db()
    try:
        user = _need_user(db)
        a = _own_assignment(db, user, slug)
        text = str((request.get_json(silent=True) or {}).get("notes") or "")
        if len(text) > MAX_NOTES:
            return err("Those notes are too long (%d characters at most)." % MAX_NOTES, 413)
        files = a.file_map()
        files[grades.NOTES] = text
        a.files = json.dumps(files)
        a.updated_at = now()
        db.commit()
        store_quiz_keys(db, a, text)
        return jsonify(ok=True, possible=grades.possible(a))
    finally:
        db.close()


def _ensure_submission(db, a, student_id):
    """A row for the grade to live on, for a student who answers or checks
    before turning anything in: not an attempt (times_submitted 0), with no
    frozen version yet (snippet_slug "")."""
    sub = db.query(accounts.Submission).filter_by(assignment_id=a.id, student_id=student_id).first()
    if sub is None:
        db.add(accounts.Submission(assignment_id=a.id, student_id=student_id, snippet_slug="", times_submitted=0))
        try:
            db.commit()
        except Exception:
            db.rollback()


def _answer_reply(key, answer, **more):
    """What the student's page is told about an answer: right or wrong and
    the points, never what the right answer was."""
    if key is not None and key.kind == "long":
        out = {"kind": "long", "response": quiz.clean_html(answer.response), "graded": answer.score is not None,
               "correct": None, "points": key.points, "earned": answer.score or 0}
    else:
        part = grades.mark(key, answer.response) if key is not None else 0.0
        points = key.points if key is not None else 0
        out = {"response": answer.response, "correct": part == 1.0, "points": points, "earned": round(points * part, 2)}
    out.update(more)
    return out


def _quiz_xp(db, a, user, key, answer):
    """XP for an answer just given (PyIDE's _quiz_xp): its share of the
    question's points, then a bonus once every question has an answer, then
    the quest reward if that made full marks."""
    if not rewards.earns_xp(user):
        return 0
    got = 0
    if key.kind != "long":
        got += xp.award(db, user.id, "quiz:%d:%s" % (a.id, key.qid),
                        key.points * grades.mark(key, answer.response) * xp.XP_PER_POINT,
                        "Question in %s" % a.title, APP_NAME)
    asked = {q["qid"] for q in grades.quiz_possible(a)}
    if asked:
        have = {qid for (qid,) in db.query(accounts.QuizAnswer.qid).filter_by(assignment_id=a.id, student_id=user.id)}
        if asked <= have:
            got += xp.award(db, user.id, "all:%d" % a.id, xp.ALL_ANSWERED_XP,
                            "Answered every question in %s" % a.title, APP_NAME)
    return got + rewards.full_marks_xp(db, a, user.id)


@bp.post("/api/quiz/answer")
def quiz_answer():
    """A student's answer to one question. One try, marked at once. The
    teacher who set it is marked but not recorded (practice)."""
    db = _db()
    try:
        user = _need_user(db)
        data = request.get_json(silent=True) or {}
        a = _assignment(db, data.get("assignment"))
        qid = str(data.get("question", ""))[:16]
        response = data.get("response")
        if not isinstance(response, str) or not response.strip():
            return err("Answer the question first.", 400)

        def find():
            return db.query(accounts.QuizQuestion).filter_by(assignment_id=a.id, qid=qid).first()
        key = find()
        if key is None:
            store_quiz_keys(db, a, grades.notes_of(a))
            key = find()
        if key is None:
            return err("This question has changed since the page loaded. Reload to get the new one.", 404)
        if key.kind in ("blank", "match"):
            got = quiz.items(response)
            want = len(json.loads((key.answers if key.kind == "blank" else key.correct) or "[]"))
            if not response.lstrip().startswith("[") or len(got) != want or any(len(g) > 300 for g in got):
                return err("This question has changed since the page loaded. Reload to get the new one.", 400)
            got = [g.strip() for g in got]
            if not any(got):
                return err("Answer the question first.", 400)
            response = json.dumps(got)
        elif key.kind in ("order", "sort"):
            # The lines in the student's order, or each item's group, one per
            # line or item as the question showed them (quiz.py). An order
            # that isn't those same lines is a page out of step with the
            # question, refused like a wrong number of blanks.
            got = quiz.items(response)
            shown = json.loads(key.choices or "[]")
            if (not response.lstrip().startswith("[") or len(got) != len(shown) or any(len(g) > 300 for g in got)
                    or (key.kind == "order" and sorted(got) != sorted(shown))):
                return err("This question has changed since the page loaded. Reload to get the new one.", 400)
            if key.kind == "sort" and not all(g in json.loads(key.answers or "[]") for g in got):
                return err("Put every item in a group first.", 400)
            response = json.dumps(got)
        elif key.kind == "bug":
            response = response.strip()
            if not response.isdigit() or len(response) > 4:
                return err("Click the line with the bug first.", 400)
        elif key.kind == "long":
            if len(response) > LONG_RESPONSE_MAX * 2:
                return err("That answer is too long to turn in.", 413)
            response = quiz.clean_html(response)
            if not quiz.plain_text(response):
                return err("Answer the question first.", 400)
            if len(response) > LONG_RESPONSE_MAX:
                return err("That answer is too long to turn in.", 413)
        else:
            response = response.strip()[:2000]

        if user.id == a.teacher_id:
            return jsonify(_answer_reply(key, accounts.QuizAnswer(response=response), practice=True))
        had = db.query(accounts.QuizAnswer).filter_by(assignment_id=a.id, student_id=user.id, qid=qid).first()
        if had is not None:
            return jsonify(_answer_reply(key, had, already=had.response != response))
        if a.archived:
            return err("That assignment is closed.", 403)
        had = accounts.QuizAnswer(assignment_id=a.id, student_id=user.id, qid=qid, response=response)
        db.add(had)
        try:
            db.commit()
        except Exception:
            # Their other tab got there first: that answer is the one that counts.
            db.rollback()
            had = db.query(accounts.QuizAnswer).filter_by(assignment_id=a.id, student_id=user.id, qid=qid).first()
            if had is None:
                return err("That answer wasn't saved. Try again.", 500)
            return jsonify(_answer_reply(key, had, already=True))
        _ensure_submission(db, a, user.id)
        gained = _quiz_xp(db, a, user, key, had)
        return jsonify(_answer_reply(key, had, xp=gained))
    finally:
        db.close()


@bp.get("/api/quiz/<slug>/mine")
def quiz_mine(slug):
    """What this student has answered already, so those questions show locked with their result."""
    db = _db()
    try:
        user = _need_user(db)
        a = _assignment(db, slug)
        keys = {k.qid: k for k in db.query(accounts.QuizQuestion).filter_by(assignment_id=a.id)}
        return jsonify(answers={x.qid: _answer_reply(keys.get(x.qid), x) for x in db.query(accounts.QuizAnswer)
                                .filter_by(assignment_id=a.id, student_id=user.id)})
    finally:
        db.close()


@bp.post("/api/quiz/grade")
def quiz_grade():
    """The teacher's points for one student's long response; empty takes the mark back."""
    db = _db()
    try:
        user = _need_user(db)
        data = request.get_json(silent=True) or {}
        a = _own_assignment(db, user, data.get("assignment"))
        try:
            student_id = int(data.get("student"))
        except (TypeError, ValueError):
            return err("No such answer.", 404)
        qid = str(data.get("question", ""))[:16]
        key = db.query(accounts.QuizQuestion).filter_by(assignment_id=a.id, qid=qid).first()
        row = db.query(accounts.QuizAnswer).filter_by(assignment_id=a.id, student_id=student_id, qid=qid).first()
        if key is None or row is None or key.kind != "long":
            return err("No such answer.", 404)
        raw = data.get("score")
        if raw in (None, ""):
            row.score = None
        else:
            try:
                row.score = float(raw)
            except (TypeError, ValueError):
                return err("A mark is a number.", 400)
            if row.score < 0 or row.score > max(key.points, 1) * 2:
                return err("That mark is out of range.", 400)
        db.commit()
        rewards.full_marks_xp(db, a, student_id)
        return jsonify(ok=True, total=grades.student_total(db, a, student_id))
    finally:
        db.close()


# ---------------------------------------------------------------- tests

def _clean_results(raw):
    """A page's results cut down to what they should be: short labelled lines."""
    out = []
    for r in (raw if isinstance(raw, list) else [])[:200]:
        if not isinstance(r, dict):
            continue
        try:
            points = float(r.get("points") or 0)
        except (TypeError, ValueError):
            points = 0.0
        out.append({"label": str(r.get("label", ""))[:200], "ok": bool(r.get("ok")),
                    "detail": str(r.get("detail", ""))[:400], "points": max(0.0, min(points, 1000.0))})
    return out


def _keep_result(db, a, student_id, kind, data):
    """Only the notes' own tests are kept, at the points the notes give them:
    a page can't add a test or claim more points than a line is worth."""
    real = {t["label"]: t["points"] for t in grades.tests_of(a)}
    results = [dict(r, points=real[r["label"]]) for r in _clean_results(data.get("results")) if r["label"] in real]
    possible = round(sum(real.values()), 2)
    earned = round(sum(r["points"] for r in results if r["ok"]), 2)
    row = db.query(accounts.TestResult).filter_by(assignment_id=a.id, student_id=student_id, kind=kind).first()
    if row is None:
        row = accounts.TestResult(assignment_id=a.id, student_id=student_id, kind=kind)
        db.add(row)
    row.earned, row.possible = earned, possible
    row.details = json.dumps(results)
    row.checked_at = now()
    try:
        db.commit()
    except Exception:
        db.rollback()
    return row


def _label_key(label):
    return hashlib.sha1(label.encode("utf-8")).hexdigest()[:12]


@bp.post("/api/tests/self")
def tests_self():
    """A student's own Check my work: kept for the teacher to see, counting
    toward no grade. Each test it finds passing pays SELF_TEST_XP, once per
    test ever — so the most a faked check can take is that times the tests."""
    db = _db()
    try:
        user = _need_user(db)
        data = request.get_json(silent=True) or {}
        a = _assignment(db, data.get("assignment"))
        if not rewards.earns_xp(user) or user.id == a.teacher_id:
            return jsonify(ok=True, practice=True)
        _ensure_submission(db, a, user.id)
        row = _keep_result(db, a, user.id, "self", data)
        got = 0
        for r in json.loads(row.details or "[]"):
            if r.get("ok"):
                got += xp.award(db, user.id, "selftest:%d:%s" % (a.id, _label_key(r["label"])), xp.SELF_TEST_XP,
                                ("Passed a test in %s: %s" % (a.title, r["label"]))[:200], APP_NAME)
        return jsonify(ok=True, earned=row.earned, possible=row.possible, xp=got)
    finally:
        db.close()


@bp.get("/api/assignments/<slug>/tests/work")
def tests_work(slug):
    """What the teacher's Check all runs: each student's frozen version — the
    one they turned in, or the one a score froze — by project and version,
    which the teacher's browser opens read only."""
    db = _db()
    try:
        user = _need_user(db)
        a = _own_assignment(db, user, slug)
        rows = (db.query(accounts.Submission, accounts.User)
                .join(accounts.User, accounts.Submission.student_id == accounts.User.id)
                .filter(accounts.Submission.assignment_id == a.id).all())
        work = []
        for sub, student in rows:
            if not (sub.snippet_slug.startswith("v") and sub.snippet_slug[1:].isdigit()):
                continue
            v = db.query(GameVersion).filter_by(id=int(sub.snippet_slug[1:])).first()
            p = db.query(GameProject).filter_by(id=v.project_id).first() if v else None
            if p is not None:
                work.append({"student": student.id, "name": student.display_name(), "project": p.slug, "version": v.id})
        work.sort(key=lambda w: w["name"].lower())
        return jsonify(work=work, tests=grades.tests_of(a))
    finally:
        db.close()


@bp.post("/api/assignments/<slug>/tests/verify")
def tests_verify(slug):
    """One student's result from the teacher's Check all. Counts toward the
    grade; pays XP_PER_POINT a point for each test passing, once per test."""
    db = _db()
    try:
        user = _need_user(db)
        a = _own_assignment(db, user, slug)
        data = request.get_json(silent=True) or {}
        try:
            student_id = int(data.get("student"))
        except (TypeError, ValueError):
            return err("No such student.", 404)
        if db.query(accounts.Submission).filter_by(assignment_id=a.id, student_id=student_id).first() is None:
            return err("They haven't turned anything in.", 404)
        row = _keep_result(db, a, student_id, "verified", data)
        student = db.query(accounts.User).filter_by(id=student_id).first()
        got = 0
        if rewards.earns_xp(student):
            for r in json.loads(row.details or "[]"):
                if r.get("ok") and r.get("points"):
                    got += xp.award(db, student_id, "test:%d:%s" % (a.id, _label_key(r["label"])),
                                    r["points"] * xp.XP_PER_POINT,
                                    ("Test passed in %s: %s" % (a.title, r["label"]))[:200], APP_NAME)
        got += rewards.full_marks_xp(db, a, student_id)
        return jsonify(ok=True, earned=row.earned, possible=row.possible, xp=got,
                       total=grades.student_total(db, a, student_id))
    finally:
        db.close()
