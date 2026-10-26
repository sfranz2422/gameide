"""
What a student's grade on an assignment is made of, in one place: the
teacher's score, plus the points of the questions in the notes they
answered (marked against the key as it is now, never stored), plus the
points of the tests the TEACHER's Check all found passing. PyIDE's rule
(its app.py, _earned and _total), so a grade means the same in every editor.

Every total goes through `total` — the results page, the student's class
page, Google Classroom's Sync, and full marks for a quest.

The notes are the assignment's ".md" files in `Assignment.files` (PyIDE's
place for them); GameIDE keeps one, notes.md.
"""
import json

import accounts
import checks
import quiz

NOTES = "notes.md"


def notes_of(a):
    return a.file_map().get(NOTES, "") if a is not None else ""


def quiz_possible(a):
    """The questions in the notes as saved."""
    seen = {}
    for q in quiz.file_keys(a.file_map()):
        seen.setdefault(q["qid"], q)
    return list(seen.values())


def tests_of(a):
    """The notes' tests: ```tests blocks, and a tutorial's ```check blocks —
    an assigned tutorial's steps are what Check all checks, and count."""
    seen, out = set(), []
    for t in checks.tests(notes_of(a)) + checks.tests(notes_of(a), "check"):
        if t["label"] not in seen:
            seen.add(t["label"])
            out.append(t)
    return out


def possible(a):
    """What the notes alone are worth: every question's and test's points."""
    return round(sum(q["points"] for q in quiz_possible(a)) + sum(t["points"] for t in tests_of(a)), 2)


def mark(key, response):
    """How much of an answer is right, 0 to 1 (quiz.fraction)."""
    return quiz.fraction(key.kind, json.loads(key.correct or "[]"), json.loads(key.answers or "[]"), response)


def earned_one(key, answer):
    """One answer's points. A long response's are the teacher's mark, 0 until given."""
    if key is None:
        return 0.0
    if key.kind == "long":
        return answer.score or 0.0
    return round(key.points * mark(key, answer.response), 2)


def quiz_earned(db, assignment_id):
    keys = {k.qid: k for k in db.query(accounts.QuizQuestion).filter_by(assignment_id=assignment_id)}
    earned = {}
    for a in db.query(accounts.QuizAnswer).filter_by(assignment_id=assignment_id):
        earned[a.student_id] = round(earned.get(a.student_id, 0.0) + earned_one(keys.get(a.qid), a), 2)
    return earned


def tests_earned(db, assignment_id):
    return {r.student_id: r.earned for r in db.query(accounts.TestResult).filter_by(
        assignment_id=assignment_id, kind="verified")}


def earned(db, assignment_id):
    """{student id: points the notes give} — questions plus checked tests."""
    out = dict(quiz_earned(db, assignment_id))
    for sid, pts in tests_earned(db, assignment_id).items():
        out[sid] = round(out.get(sid, 0.0) + pts, 2)
    return out


def total(score, got):
    """The grade: score plus the notes' points. None only when there is neither."""
    if score is None and got is None:
        return None
    return round((score or 0) + (got or 0), 2)


def student_total(db, a, student_id):
    sub = db.query(accounts.Submission).filter_by(assignment_id=a.id, student_id=student_id).first()
    return total(sub.score if sub else None, earned(db, a.id).get(student_id))


def has_full_marks(db, a, student_id):
    """The grade reaching the points; or, with no points set, every point the
    notes offer earned. Neither — no points, no questions, no tests — has no
    full marks to get."""
    if a.out_of:
        t = student_total(db, a, student_id)
        return t is not None and t >= a.out_of
    most = possible(a)
    got = earned(db, a.id).get(student_id)
    return most > 0 and got is not None and got >= most - 0.001
