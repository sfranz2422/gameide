"""
Classes (Phase 10): a teacher's classes, their rosters, assignments with a
starter game, each student's copy, turning in, comments, scores, and Google
Classroom — built on the tables PyIDE made and shares, the way PyIDE,
WebIDE and FlaskIDE each do.

How it fits together:

  accounts.Course        a class, one per period (app "gameide"). Linked to
                         a Google Classroom course, which is where its
                         students come from; or not, and then the teacher
                         adds students by email.
  accounts.Enrollment    a student in a class, by email — most of a roster
                         has never signed in, and must still find the class
                         the first time they do.
  accounts.ClassItem     one line on a class's page: an assignment or a
                         group heading, in the teacher's order, maybe hidden.
  accounts.Assignment    an assignment (kind "game"), in one class only: a
                         second period doing the same work gets a copy.
  AssignmentGame         its starter game (a project the teacher owns) and
                         due date.
  AssignmentWork         a student's own copy of it — an ordinary project of
                         theirs, made the first time they open /a/<slug>.
  accounts.Submission    turning in: `snippet_slug` is "v<id>", a
                         GameVersion of their project frozen at that moment
                         (kind "turned-in"), so what the teacher marks doesn't
                         move while the student carries on. A score given to
                         work never turned in freezes one too (kind "graded"),
                         so the grade always says what it was for.
  Comment                the teacher's comments on a student's game, and
                         replies.

Who sees what (the spec: students see only their own projects; teachers
only their classes'): a class's page, to its teacher and to the students on
its roster; an assignment's results, to its teacher; a student's game, to
them and to the teacher of the assignment it is work for (`can_read`) —
read only. Every one of these is checked in backend/tests/test_server.py.

Each editor sees only its own classes (Course.app): a teacher's PyIDE
classes are never listed here, and GameIDE's never there.
"""
import json
import os
import re
import secrets
import string
from datetime import datetime, timezone
from urllib.parse import urlencode

from flask import Blueprint, abort, jsonify, make_response, redirect, request, session, url_for
from sqlalchemy import func

import accounts
import gamestore
import grades
import library
import notes
import quiz
import rewards
from accounts import now
from gamestore import AssignmentGame, AssignmentWork, ClassSettings, Comment, GameAsset, GameProject, GameVersion

bp = Blueprint("classes", __name__)

APP_NAME = "gameide"

# Set by init().
_db = None
_current_user = None
_scheme = None
_problem = None


def init(app, session_factory, current_user, scheme, problem):
    global _db, _current_user, _scheme, _problem
    _db, _current_user, _scheme, _problem = session_factory, current_user, scheme, problem
    app.register_blueprint(bp)


def err(message, status):
    return jsonify(error=message), status


def fail(message, status):
    abort(make_response(jsonify(error=message), status))


def _iso(t):
    if t is None:
        return None
    return t.isoformat() + ("Z" if t.tzinfo is None else "")


def _naive(t):
    """Datetimes compare as naive UTC: SQLite hands back naive ones, Postgres aware."""
    return t.replace(tzinfo=None) if t is not None and t.tzinfo is not None else t


def _clean(value, limit):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _need_user(db):
    user = _current_user(db)
    if user is None:
        fail("You're signed out. Sign in again.", 401)
    return user


def is_teacher(user) -> bool:
    return bool(user) and accounts.is_teacher(user.email)


def _need_teacher(db):
    user = _need_user(db)
    if not is_teacher(user):
        fail("Only a teacher can do that.", 403)
    return user


def _courses(db):
    return db.query(accounts.Course).filter(accounts.Course.app == APP_NAME)


def _enrolled(db, user, class_id) -> bool:
    return db.query(accounts.Enrollment).filter(
        accounts.Enrollment.class_id == class_id,
        func.lower(accounts.Enrollment.email) == user.email.lower()).first() is not None


def _class_for(db, user, class_id, teaching_only=False):
    """(course, teaching) for someone allowed to see this class; stops otherwise."""
    course = _courses(db).filter(accounts.Course.id == class_id).first()
    if course is not None and course.teacher_id == user.id:
        return course, True
    if course is None or teaching_only or not _enrolled(db, user, class_id):
        fail("That isn't one of your classes.", 404 if course is None else 403)
    return course, False


def _assignment(db, slug):
    a = db.query(accounts.Assignment).filter_by(slug=slug, app=APP_NAME).first()
    if a is None:
        fail("There's no assignment here. Check the link with your teacher.", 404)
    return a


def _own_assignment(db, user, slug):
    a = _assignment(db, slug)
    if a.teacher_id != user.id:
        fail("That's another teacher's assignment.", 403)
    return a


def _item_of(db, a):
    return db.query(accounts.ClassItem).filter_by(assignment_id=a.id).first()


def _game_of(db, a):
    return db.query(AssignmentGame).filter_by(assignment_id=a.id).first()


# ---------------------------------------------------------------- who may read a game

def can_read(db, user, p) -> bool:
    """Whether this person may open a project (read only, unless it's theirs):
    its owner, or the teacher of the assignment it is a student's work for.
    Not "any teacher of the student": a teacher sees the games handed in to
    their own assignments, not everything a student ever made."""
    if user is None:
        return False
    if p.owner_id == user.id:
        return True
    work = db.query(AssignmentWork).filter_by(project_id=p.id).first()
    if work is None:
        return False
    a = db.query(accounts.Assignment).filter_by(id=work.assignment_id).first()
    return a is not None and a.teacher_id == user.id


def starter_ids(db, owner_id):
    """Ids of the starter games this teacher owns, kept off their My Games."""
    rows = (db.query(AssignmentGame.starter_id)
            .join(GameProject, GameProject.id == AssignmentGame.starter_id)
            .filter(GameProject.owner_id == owner_id).all())
    return {r.starter_id for r in rows}


# ---------------------------------------------------------------- copying a game

_ID_CHARS = string.ascii_letters + string.digits


def _new_slug(db):
    while True:
        slug = "".join(secrets.choice(_ID_CHARS) for _ in range(12))
        if db.query(GameProject.id).filter_by(slug=slug).first() is None:
            return slug


def _user_bytes(db, user_id) -> int:
    projects = db.query(func.coalesce(func.sum(GameProject.size), 0)).filter(
        GameProject.owner_id == user_id, GameProject.deleted_at.is_(None)).scalar()
    assets = (db.query(func.coalesce(func.sum(GameAsset.size), 0))
              .join(GameProject, GameAsset.project_id == GameProject.id)
              .filter(GameProject.owner_id == user_id, GameProject.deleted_at.is_(None)).scalar())
    return int(projects) + int(assets)


def copy_project(db, src, owner, name, data_text=None):
    """A new project for `owner`: `src`'s game (or `data_text`, a snapshot
    of it) and copies of its files, under a new id. Copies, never shared
    rows — deleting or changing one can't touch the other. Checked against
    the owner's limits like any game of theirs, in words they can act on."""
    count = db.query(func.count(GameProject.id)).filter_by(owner_id=owner.id).filter(GameProject.deleted_at.is_(None)).scalar()
    if count >= gamestore.MAX_PROJECTS_PER_USER:
        fail(f"You have {count} games, which is the most one account can keep. Delete some you don't need.", 413)
    assets = db.query(GameAsset).filter_by(project_id=src.id).all()
    data = json.loads(data_text if data_text is not None else src.data)
    slug = _new_slug(db)
    data["id"] = slug
    data["name"] = name[:200]
    text = json.dumps(data, separators=(",", ":"))
    size = len(text.encode("utf-8"))
    if _user_bytes(db, owner.id) + size + sum(a.size for a in assets) > gamestore.MAX_USER_BYTES:
        fail("Your account is full. Delete games you don't need, then try again.", 413)
    p = GameProject(slug=slug, owner_id=owner.id, name=name[:200], data=text, size=size, version=1,
                    schema_version=int(data.get("schemaVersion") or 1))
    db.add(p)
    db.flush()
    for a in assets:
        db.add(GameAsset(project_id=p.id, asset_id=a.asset_id, content_type=a.content_type, data=a.data, size=a.size))
    return p


def _freeze(db, p, kind, label):
    """A snapshot of the project as it is now, kept for good (only "auto"
    snapshots are ever pruned). Returns the GameVersion."""
    v = GameVersion(project_id=p.id, version=p.version, kind=kind, label=label[:200], data=p.data, size=p.size)
    db.add(v)
    db.flush()
    return v


# ---------------------------------------------------------------- the class list

def _classroom_state(db, user):
    if not is_teacher(user):
        return None
    link = _classroom_link(db, user) if classroom_configured() else None
    return {"configured": classroom_configured(), "connected": link is not None,
            "email": link.google_email if link else ""}


@bp.get("/api/classes")
def list_classes():
    """The classes in a person's Classes page: a teacher's own, and the ones a
    student's email is on the roster of — in this editor only."""
    db = _db()
    try:
        user = _need_user(db)
        taught = _courses(db).filter_by(teacher_id=user.id).all()
        enrolled = (_courses(db).join(accounts.Enrollment, accounts.Enrollment.class_id == accounts.Course.id)
                    .filter(func.lower(accounts.Enrollment.email) == user.email.lower()).all())
        sizes = dict(db.query(accounts.Enrollment.class_id, func.count(accounts.Enrollment.id))
                     .filter(accounts.Enrollment.class_id.in_([c.id for c in taught] or [-1]))
                     .group_by(accounts.Enrollment.class_id).all())
        teachers = {u.id: u for u in db.query(accounts.User).filter(
            accounts.User.id.in_([c.teacher_id for c in enrolled] or [-1])).all()}
        rows = [{"id": c.id, "name": c.name, "teaching": True, "courseName": c.course_name, "students": sizes.get(c.id, 0)}
                for c in sorted(taught, key=lambda c: (c.name.lower(), c.id))]
        rows += [{"id": c.id, "name": c.name, "teaching": False,
                  "teacher": teachers[c.teacher_id].display_name() if c.teacher_id in teachers else ""}
                 for c in sorted(enrolled, key=lambda c: (c.name.lower(), c.id)) if c.teacher_id != user.id]
        return jsonify(classes=rows, teacher=is_teacher(user), classroom=_classroom_state(db, user))
    finally:
        db.close()


@bp.post("/api/classes")
def create_class():
    """A new class. Linked to a Classroom course when one is chosen, and its
    roster fetched at once, so the students find it straight away. A roster
    that fails still leaves the class made, and says why; Sync roster on its
    page tries again."""
    db = _db()
    try:
        user = _need_teacher(db)
        body = request.get_json(silent=True) or {}
        name = _clean(body.get("name"), 200)
        if not name:
            return err("Give the class a name.", 400)
        course = accounts.Course(app=APP_NAME, teacher_id=user.id, name=name)
        problem = _link_course(db, user, course, str(body.get("course") or ""))
        if problem:
            return err(problem, 400)
        db.add(course)
        db.commit()
        count, roster_error = _sync_roster(db, user, course) if course.course_id else (0, "")
        return jsonify(id=course.id, students=count, rosterError=roster_error), 201
    finally:
        db.close()


# ---------------------------------------------------------------- one class

def _work_rows(db, assignment_ids, owner_id=None):
    q = db.query(AssignmentWork).filter(AssignmentWork.assignment_id.in_(assignment_ids or [-1]))
    if owner_id is not None:
        q = q.filter(AssignmentWork.owner_id == owner_id)
    return q.all()


@bp.get("/api/classes/<int:class_id>")
def get_class(class_id):
    db = _db()
    try:
        user = _need_user(db)
        course, teaching = _class_for(db, user, class_id)
        items = db.query(accounts.ClassItem).filter_by(class_id=course.id).order_by(
            accounts.ClassItem.position, accounts.ClassItem.id).all()
        ids = [i.assignment_id for i in items if i.assignment_id]
        assignments = {a.id: a for a in db.query(accounts.Assignment).filter(accounts.Assignment.id.in_(ids or [-1])).all()}
        games = {g.assignment_id: g for g in db.query(AssignmentGame).filter(AssignmentGame.assignment_id.in_(ids or [-1])).all()}
        out = []
        if teaching:
            started = dict(db.query(AssignmentWork.assignment_id, func.count(AssignmentWork.id))
                           .filter(AssignmentWork.assignment_id.in_(ids or [-1])).group_by(AssignmentWork.assignment_id).all())
            turned = dict(db.query(accounts.Submission.assignment_id, func.count(accounts.Submission.id))
                          .filter(accounts.Submission.assignment_id.in_(ids or [-1]), accounts.Submission.times_submitted > 0)
                          .group_by(accounts.Submission.assignment_id).all())
            posted = {p.assignment_id for p in db.query(accounts.ClassroomPost).filter(
                accounts.ClassroomPost.assignment_id.in_(ids or [-1])).all()}
            for i in items:
                row = {"id": i.id, "hidden": bool(i.hidden), "description": i.description}
                a = assignments.get(i.assignment_id)
                if a is None:
                    out.append({**row, "kind": "group", "title": i.title})
                    continue
                g = games.get(a.id)
                out.append({**row, "kind": "assignment", "title": a.title, "slug": a.slug, "outOf": a.out_of,
                            "xpBonus": a.xp_bonus or 0,
                            "dueAt": _iso(g.due_at if g else None), "archived": bool(a.archived),
                            "started": started.get(a.id, 0), "turnedIn": turned.get(a.id, 0), "posted": a.id in posted})
            students = db.query(accounts.Enrollment).filter_by(class_id=course.id).order_by(accounts.Enrollment.name).all()
            # Signed in at least once: then they have a name, even when the
            # roster (typed in by email) didn't give one.
            known = {u.email.lower(): u.display_name() for u in db.query(accounts.User).filter(
                func.lower(accounts.User.email).in_([s.email.lower() for s in students] or [""])).all()}
            settings = db.query(ClassSettings).filter_by(class_id=course.id).first()
            others = _courses(db).filter(accounts.Course.teacher_id == user.id, accounts.Course.id != course.id).order_by(accounts.Course.name).all()
            return jsonify(id=course.id, name=course.name, teaching=True, calendar=course.calendar or "",
                           courseId=course.course_id,
                           courseName=course.course_name, rosterAt=_iso(course.roster_at), items=out,
                           students=[{"email": s.email, "name": s.name or known.get(s.email.lower(), ""),
                                      "signedIn": s.email.lower() in known} for s in students],
                           autoApprove=bool(settings and settings.auto_approve),
                           others=[{"id": c.id, "name": c.name} for c in others],
                           classroom=_classroom_state(db, user))
        # A student: everything not hidden or archived, with how they stand on each.
        work = {w.assignment_id: w for w in _work_rows(db, ids, user.id)}
        projects = {p.id: p for p in db.query(GameProject).filter(GameProject.id.in_([w.project_id for w in work.values()] or [-1])).all()}
        subs = {s.assignment_id: s for s in db.query(accounts.Submission).filter(
            accounts.Submission.assignment_id.in_(ids or [-1]), accounts.Submission.student_id == user.id).all()}
        totals = {aid: grades.student_total(db, assignments[aid], user.id) for aid in subs if aid in assignments}
        done = rewards.quests_done(db, user)
        unread = dict(db.query(Comment.project_id, func.count(Comment.id)).filter(
            Comment.project_id.in_(list(projects) or [-1]), Comment.author_id != user.id, Comment.seen == 0)
            .group_by(Comment.project_id).all())
        for i in items:
            if i.hidden:
                continue
            a = assignments.get(i.assignment_id)
            if a is None:
                out.append({"id": i.id, "kind": "group", "title": i.title, "description": i.description})
                continue
            if a.archived:
                continue
            g, w, s = games.get(a.id), work.get(a.id), subs.get(a.id)
            p = projects.get(w.project_id) if w else None
            out.append({"id": i.id, "kind": "assignment", "title": a.title, "slug": a.slug, "description": i.description,
                        "outOf": a.out_of, "dueAt": _iso(g.due_at if g else None),
                        "xpBonus": a.xp_bonus or 0, "questDone": a.id in done,
                        "project": p.slug if p and p.deleted_at is None else None,
                        "turnedIn": _iso(s.submitted_at) if s and s.times_submitted > 0 else None,
                        "score": totals.get(a.id), "unread": unread.get(p.id, 0) if p else 0})
        teacher = db.query(accounts.User).filter_by(id=course.teacher_id).first()
        return jsonify(id=course.id, name=course.name, teaching=False, items=out, calendar=course.calendar or "",
                       teacher=teacher.display_name() if teacher else "")
    finally:
        db.close()


@bp.post("/api/classes/<int:class_id>")
def update_class(class_id):
    """Rename, or link to a (different) Classroom course — which fetches its roster."""
    db = _db()
    try:
        user = _need_teacher(db)
        course, _ = _class_for(db, user, class_id, teaching_only=True)
        body = request.get_json(silent=True) or {}
        if "name" in body:
            name = _clean(body.get("name"), 200)
            if not name:
                return err("Give the class a name.", 400)
            course.name = name
        relinked = False
        if "course" in body:
            problem = _link_course(db, user, course, str(body.get("course") or ""))
            if problem:
                return err(problem, 400)
            relinked = bool(course.course_id)
        db.commit()
        count, roster_error = _sync_roster(db, user, course) if relinked else (None, "")
        return jsonify(ok=True, students=count, rosterError=roster_error)
    finally:
        db.close()


#: As PyIDE's MAX_DESCRIPTION: the same column, written from either.
MAX_CALENDAR = 20000


@bp.post("/api/classes/<int:class_id>/calendar")
def save_calendar(class_id):
    """The week's calendar at the top of the class's page: the block of text
    the teacher pasted ("Monday: … Tuesday: …"), stored as typed in the
    shared `classes.calendar` and drawn by editor/calendarWeek.ts — the
    same column PyIDE's class page shows, read by the same rules.

    `also` is the teacher's other classes to post the same week to (two
    periods doing the same week). Each must be this teacher's own class in
    this editor; one that isn't refuses the whole save rather than quietly
    posting to some and not others."""
    db = _db()
    try:
        user = _need_teacher(db)
        course, _ = _class_for(db, user, class_id, teaching_only=True)
        body = request.get_json(silent=True) or {}
        text = body.get("calendar")
        if not isinstance(text, str):
            return err("That isn't a calendar.", 400)
        if len(text) > MAX_CALENDAR:
            return err("That calendar is too long.", 413)
        also = body.get("also") or []
        if not isinstance(also, list) or not all(isinstance(i, int) and not isinstance(i, bool) for i in also):
            return err("Those aren't classes.", 400)
        mine = {c.id: c for c in _courses(db).filter(accounts.Course.teacher_id == user.id).all()}
        if any(i not in mine for i in also):
            return err("One of those classes isn't yours.", 404)
        text = text.strip()
        for c in [course] + [mine[i] for i in also if i != course.id]:
            c.calendar = text
        db.commit()
        return jsonify(ok=True, calendar=text, posted=1 + len(set(also) - {course.id}))
    finally:
        db.close()


@bp.delete("/api/classes/<int:class_id>")
def delete_class(class_id):
    """The class goes; its assignments are archived, never deleted, and every
    student's game stays theirs, on their My Games — turned-in work is never
    lost by tidying up a class."""
    db = _db()
    try:
        user = _need_teacher(db)
        course, _ = _class_for(db, user, class_id, teaching_only=True)
        items = db.query(accounts.ClassItem).filter_by(class_id=course.id).all()
        ids = [i.assignment_id for i in items if i.assignment_id]
        db.query(accounts.Assignment).filter(accounts.Assignment.id.in_(ids or [-1])).update(
            {"archived": 1}, synchronize_session=False)
        # Everything pointing at the class goes first (Postgres refuses otherwise:
        # see delete_assignment). Its random events go; the XP they gave stays
        # with the students — those are their own rows.
        for table in (accounts.ClassItem, accounts.Enrollment, accounts.ClassEvent, accounts.Visit, ClassSettings):
            db.query(table).filter_by(class_id=course.id).delete(synchronize_session=False)
        db.query(accounts.Course).filter_by(id=course.id).delete(synchronize_session=False)
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


# ---------------------------------------------------------------- the roster

EMAIL = re.compile(r"^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$")


@bp.post("/api/classes/<int:class_id>/roster")
def sync_roster(class_id):
    db = _db()
    try:
        user = _need_teacher(db)
        course, _ = _class_for(db, user, class_id, teaching_only=True)
        count, problem = _sync_roster(db, user, course)
        if problem:
            return err(problem, 409 if not course.course_id else 502)
        return jsonify(ok=True, students=count)
    finally:
        db.close()


@bp.post("/api/classes/<int:class_id>/students")
def add_students(class_id):
    """Students added by email, for a class with no Classroom course. A
    linked class's roster is Classroom's — a sync replaces it, and would
    silently drop anyone typed in here — so it is refused there, in words."""
    db = _db()
    try:
        user = _need_teacher(db)
        course, _ = _class_for(db, user, class_id, teaching_only=True)
        if course.course_id:
            return err("This class's students come from Google Classroom. Add them there, then press Sync roster.", 409)
        words = re.split(r"[\s,;]+", str((request.get_json(silent=True) or {}).get("emails") or ""))
        emails = [w.strip("<>").lower() for w in words if w.strip("<>")]
        bad = [e for e in emails if not EMAIL.match(e)]
        if bad:
            return err("These aren't email addresses: " + ", ".join(bad[:5]), 400)
        have = {e.email.lower() for e in db.query(accounts.Enrollment).filter_by(class_id=course.id).all()}
        added = 0
        for e in dict.fromkeys(emails):
            if e not in have:
                db.add(accounts.Enrollment(class_id=course.id, email=e[:320], name=""))
                added += 1
        db.commit()
        return jsonify(ok=True, added=added)
    finally:
        db.close()


@bp.delete("/api/classes/<int:class_id>/students")
def remove_student(class_id):
    """Off the roster. Their games and anything they turned in stay."""
    db = _db()
    try:
        user = _need_teacher(db)
        course, _ = _class_for(db, user, class_id, teaching_only=True)
        if course.course_id:
            return err("This class's students come from Google Classroom. Remove them there, then press Sync roster.", 409)
        email = str((request.get_json(silent=True) or {}).get("email") or "").lower()
        db.query(accounts.Enrollment).filter(accounts.Enrollment.class_id == course.id,
                                             func.lower(accounts.Enrollment.email) == email).delete(synchronize_session=False)
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


# ---------------------------------------------------------------- the class's page: items

def _top(db, class_id):
    least = db.query(func.min(accounts.ClassItem.position)).filter_by(class_id=class_id).scalar()
    return (least or 0) - 1


def _parse_due(value):
    """(naive UTC datetime or None, problem). The page sends UTC
    "YYYY-MM-DDTHH:MM", made from the teacher's own clock, as PyIDE's does."""
    if not value:
        return None, None
    try:
        return datetime.strptime(str(value)[:16], "%Y-%m-%dT%H:%M"), None
    except ValueError:
        return None, "That due date isn't a date."


def _parse_points(value):
    if value in (None, ""):
        return None, None
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None, "Points must be a whole number."
    if not 1 <= n <= 1000:
        return None, "Points must be between 1 and 1000."
    return n, None


def _make_assignment(db, user, course, title, starter, out_of, due_at, position=None):
    a = accounts.Assignment(slug=accounts.new_id(db, accounts.Assignment), app=APP_NAME, teacher_id=user.id,
                            title=title, code="", files="{}", kind="game", out_of=out_of)
    db.add(a)
    db.flush()
    db.add(AssignmentGame(assignment_id=a.id, starter_id=starter.id, due_at=due_at))
    db.add(accounts.ClassItem(class_id=course.id, assignment_id=a.id,
                              position=_top(db, course.id) if position is None else position))
    return a


@bp.post("/api/classes/<int:class_id>/assignments")
def new_assignment(class_id):
    """An assignment from one of the teacher's games: its starter is a copy of
    that game (AssignmentGame says why a copy). It goes on top of the page."""
    db = _db()
    try:
        user = _need_teacher(db)
        course, _ = _class_for(db, user, class_id, teaching_only=True)
        body = request.get_json(silent=True) or {}
        title = _clean(body.get("title"), 200)
        if not title:
            return err("Give the assignment a title.", 400)
        src = db.query(GameProject).filter_by(slug=str(body.get("project") or "")).first()
        if src is None or src.owner_id != user.id or src.deleted_at is not None:
            return err("Choose one of your games to start from.", 400)
        out_of, problem = _parse_points(body.get("outOf"))
        due_at, problem2 = _parse_due(body.get("dueAt"))
        if problem or problem2:
            return err(problem or problem2, 400)
        starter = copy_project(db, src, user, f"{title} (starter)")
        a = _make_assignment(db, user, course, title, starter, out_of, due_at)
        db.commit()
        # A tutorial assigned to the class: linked to it in the library
        # (library.py), which writes it in as the assignment's notes and keeps
        # it in step from then on — the library is the only place notes change.
        slug = str(body.get("tutorial") or "")
        if slug:
            item = (db.query(accounts.LibraryItem)
                    .filter_by(slug=slug[:16], app=APP_NAME, teacher_id=user.id, kind="tutorial", archived=0).first())
            if item is None:
                return err("That tutorial isn't in your library.", 404)
            library.link(db, item, a)
        return jsonify(slug=a.slug, starter=starter.slug), 201
    finally:
        db.close()


@bp.post("/api/classes/<int:class_id>/groups")
def new_group(class_id):
    """A heading on the page. It means nothing to grading — a way to lay the
    page out, which is all the teacher asked of it."""
    db = _db()
    try:
        user = _need_teacher(db)
        course, _ = _class_for(db, user, class_id, teaching_only=True)
        title = _clean((request.get_json(silent=True) or {}).get("title"), 200)
        if not title:
            return err("Give the group a heading.", 400)
        item = accounts.ClassItem(class_id=course.id, title=title, position=_top(db, course.id))
        db.add(item)
        db.commit()
        return jsonify(id=item.id), 201
    finally:
        db.close()


def _own_item(db, user, class_id, item_id):
    course, _ = _class_for(db, user, class_id, teaching_only=True)
    item = db.query(accounts.ClassItem).filter_by(id=item_id, class_id=course.id).first()
    if item is None:
        fail("That isn't on this class's page.", 404)
    return course, item


@bp.post("/api/classes/<int:class_id>/items/<int:item_id>")
def update_item(class_id, item_id):
    db = _db()
    try:
        user = _need_teacher(db)
        _, item = _own_item(db, user, class_id, item_id)
        body = request.get_json(silent=True) or {}
        if "hidden" in body:
            item.hidden = 1 if body["hidden"] else 0
        if "description" in body:
            item.description = str(body.get("description") or "")[:4000]
        if "title" in body and not item.assignment_id:
            title = _clean(body.get("title"), 200)
            if not title:
                return err("Give the group a heading.", 400)
            item.title = title
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.delete("/api/classes/<int:class_id>/items/<int:item_id>")
def delete_item(class_id, item_id):
    """Group headings only: an assignment is deleted (or archived) as itself."""
    db = _db()
    try:
        user = _need_teacher(db)
        _, item = _own_item(db, user, class_id, item_id)
        if item.assignment_id:
            return err("Delete or archive the assignment itself.", 400)
        db.delete(item)
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/classes/<int:class_id>/order")
def reorder(class_id):
    """The page's order, as the ids of its items top to bottom."""
    db = _db()
    try:
        user = _need_teacher(db)
        course, _ = _class_for(db, user, class_id, teaching_only=True)
        order = (request.get_json(silent=True) or {}).get("items") or []
        items = {i.id: i for i in db.query(accounts.ClassItem).filter_by(class_id=course.id).all()}
        if sorted(order) != sorted(items):
            return err("The page changed while you were moving things. Reload it and try again.", 409)
        for n, iid in enumerate(order):
            items[iid].position = n
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


# ---------------------------------------------------------------- an assignment

def _student_label(u, enrolled_name=""):
    return (enrolled_name or (u.display_name() if u else "")).strip()


@bp.get("/api/assignments/<slug>")
def assignment_results(slug):
    """The teacher's view of one assignment: everyone on the class's roster,
    and anyone else who opened it, with their game, when they last changed
    it, what they turned in, their score and the comments."""
    db = _db()
    try:
        user = _need_teacher(db)
        a = _own_assignment(db, user, slug)
        # Its tutorial, from the library (library.py) — the only place notes
        # are edited; notes from before it are taken in first.
        library.import_existing(db, user)
        db.refresh(a)
        box = library.tutorial_box(db, user, a)
        tut = box["tutorial"]
        tutorial = ({"slug": tut.slug, "title": tut.title, "others": box["tutorial_others"], "origin": tut.origin}
                    if tut is not None else None)
        item, g = _item_of(db, a), _game_of(db, a)
        course = db.query(accounts.Course).filter_by(id=item.class_id).first() if item else None
        roster = db.query(accounts.Enrollment).filter_by(class_id=course.id).all() if course else []
        works = _work_rows(db, [a.id])
        projects = {p.id: p for p in db.query(GameProject).filter(GameProject.id.in_([w.project_id for w in works] or [-1])).all()}
        subs = {s.student_id: s for s in db.query(accounts.Submission).filter_by(assignment_id=a.id).all()}
        emails = [r.email.lower() for r in roster]
        users = db.query(accounts.User).filter(
            (func.lower(accounts.User.email).in_(emails or [""]))
            | accounts.User.id.in_([w.owner_id for w in works] + list(subs) or [-1])).all()
        by_email = {u.email.lower(): u for u in users}
        by_id = {u.id: u for u in users}
        work_by_owner = {w.owner_id: w for w in works}
        # The notes' part of each grade: questions answered, tests checked.
        quiz_got = grades.quiz_earned(db, a.id)
        earned = grades.earned(db, a.id)
        results = {}
        for t in db.query(accounts.TestResult).filter_by(assignment_id=a.id):
            results[(t.student_id, t.kind)] = t
        keys = {k.qid: k for k in db.query(accounts.QuizQuestion).filter_by(assignment_id=a.id)}
        longs = {}
        for ans in db.query(accounts.QuizAnswer).filter_by(assignment_id=a.id):
            k = keys.get(ans.qid)
            if k is not None and k.kind == "long":
                # Cleaned again as it is shown: it is drawn as markup (quiz.clean_html).
                longs.setdefault(ans.student_id, []).append({"question": ans.qid, "prompt": k.prompt, "points": k.points,
                                                             "response": quiz.clean_html(ans.response), "score": ans.score})

        def test_out(sid, kind, s):
            t = results.get((sid, kind))
            if t is None:
                return None
            # A teacher's check older than the last turn-in is of work since replaced.
            stale = kind == "verified" and s is not None and s.times_submitted > 0 and _naive(t.checked_at) < _naive(s.submitted_at)
            return {"earned": t.earned, "possible": t.possible, "at": _iso(t.checked_at), "stale": stale,
                    "details": json.loads(t.details or "[]")}

        counts = {}
        for c in db.query(Comment).filter(Comment.project_id.in_(list(projects) or [-1])).all():
            n = counts.setdefault(c.project_id, [0, 0])
            n[0] += 1
            if c.author_id != user.id and not c.seen:
                n[1] += 1

        def row(u, email, name, on_roster):
            w = work_by_owner.get(u.id) if u else None
            p = projects.get(w.project_id) if w else None
            s = subs.get(u.id) if u else None
            version = int(s.snippet_slug[1:]) if s and s.snippet_slug.startswith("v") and s.snippet_slug[1:].isdigit() else None
            n = counts.get(p.id, [0, 0]) if p else [0, 0]
            total = grades.total(s.score if s else None, earned.get(u.id)) if u else None
            tut = gamestore.tutorial_of(p.data) if p else None
            return {"quiz": quiz_got.get(u.id) if u else None, "total": total,
                    "tutorial": {"step": tut.get("step", 0), "steps": tut.get("steps", 0)} if tut else None,
                    "testsSelf": test_out(u.id, "self", s) if u else None,
                    "testsVerified": test_out(u.id, "verified", s) if u else None,
                    "longs": longs.get(u.id, []) if u else [],"student": u.id if u else None, "name": _student_label(u, name) or email.split("@")[0], "email": email,
                    "onRoster": on_roster, "project": p.slug if p else None, "deleted": bool(p and p.deleted_at),
                    "updated": _iso(p.updated_at) if p else None,
                    "turnedIn": _iso(s.submitted_at) if s and s.times_submitted > 0 else None,
                    "times": s.times_submitted if s else 0, "version": version,
                    "score": s.score if s else None, "synced": s is not None and total is not None and total == s.score_synced,
                    "comments": n[0], "unread": n[1]}

        rows, seen = [], set()
        for r in roster:
            u = by_email.get(r.email.lower())
            rows.append(row(u, r.email.lower(), r.name, True))
            if u:
                seen.add(u.id)
        for uid in list(work_by_owner) + list(subs):
            if uid not in seen and uid in by_id:
                seen.add(uid)
                rows.append(row(by_id[uid], by_id[uid].email.lower(), "", False))
        rows.sort(key=lambda r: (not r["onRoster"], r["name"].lower()))
        starter = db.query(GameProject).filter_by(id=g.starter_id).first() if g else None
        post = db.query(accounts.ClassroomPost).filter_by(assignment_id=a.id).first()
        return jsonify(slug=a.slug, title=a.title, outOf=a.out_of, dueAt=_iso(g.due_at if g else None),
                       xpBonus=a.xp_bonus or 0, notes=grades.notes_of(a), possible=grades.possible(a),
                       tutorial=tutorial, tutorialChoices=box["tutorial_choices"],
                       questions=len(grades.quiz_possible(a)), tests=grades.tests_of(a),
                       archived=bool(a.archived), hidden=bool(item and item.hidden),
                       classId=course.id if course else None, className=course.name if course else "",
                       courseId=course.course_id if course else "",
                       starter=starter.slug if starter else None, rows=rows,
                       posted={"url": post.url, "courseName": post.course_name} if post else None,
                       classroom=_classroom_state(db, user))
    finally:
        db.close()


@bp.post("/api/assignments/<slug>")
def update_assignment(slug):
    """Title, points, due date, archived."""
    db = _db()
    try:
        user = _need_teacher(db)
        a = _own_assignment(db, user, slug)
        body = request.get_json(silent=True) or {}
        if "title" in body:
            title = _clean(body.get("title"), 200)
            if not title:
                return err("Give the assignment a title.", 400)
            a.title = title
        if "outOf" in body:
            out_of, problem = _parse_points(body.get("outOf"))
            if problem:
                return err(problem, 400)
            a.out_of = out_of
        if "dueAt" in body:
            due_at, problem = _parse_due(body.get("dueAt"))
            if problem:
                return err(problem, 400)
            g = _game_of(db, a)
            if g:
                g.due_at = due_at
        if "archived" in body:
            a.archived = 1 if body["archived"] else 0
        a.updated_at = now()
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.delete("/api/assignments/<slug>")
def delete_assignment(slug):
    """Only while nobody has turned anything in — after that it can be
    archived, never deleted, so turned-in work is never lost. Students'
    games stay theirs either way; only the starter goes."""
    db = _db()
    try:
        user = _need_teacher(db)
        a = _own_assignment(db, user, slug)
        if db.query(accounts.Submission).filter_by(assignment_id=a.id).first() is not None:
            return err("Students have turned this in, so it can't be deleted. Archive it instead.", 409)
        g = _game_of(db, a)
        if g:
            starter = db.query(GameProject).filter_by(id=g.starter_id).first()
            if starter:
                starter.deleted_at = now()
        # Every row that points at the assignment goes first, each by its own
        # DELETE: Postgres refuses to delete an assignment anything still
        # refers to, and SQLAlchemy can't order deletes between tables it has
        # no relationship for. Missing one was a 500 on Render (and passed
        # here until the tests' SQLite was made to enforce foreign keys too).
        # Students' games are AssignmentWork's projects: theirs, kept.
        for table in (AssignmentWork, AssignmentGame, accounts.ClassItem, accounts.ClassroomPost, accounts.QuizAnswer,
                      accounts.QuizQuestion, accounts.TestResult, accounts.Draft, accounts.LiveSession):
            db.query(table).filter_by(assignment_id=a.id).delete(synchronize_session=False)
        db.query(accounts.Assignment).filter_by(id=a.id).delete(synchronize_session=False)
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/assignments/<slug>/copy")
def copy_assignment(slug):
    """The same assignment for another of the teacher's classes — a copy, with
    its own link and results (one class per assignment). Nothing of any
    student's comes with it."""
    db = _db()
    try:
        user = _need_teacher(db)
        a = _own_assignment(db, user, slug)
        target = _courses(db).filter(accounts.Course.id == int((request.get_json(silent=True) or {}).get("class") or 0)).first()
        if target is None or target.teacher_id != user.id:
            return err("Choose one of your classes.", 400)
        g = _game_of(db, a)
        src = db.query(GameProject).filter_by(id=g.starter_id).first() if g else None
        if src is None:
            return err("This assignment has no starter game to copy.", 409)
        starter = copy_project(db, src, user, src.name)
        b = _make_assignment(db, user, target, a.title, starter, a.out_of, g.due_at)
        db.commit()
        return jsonify(slug=b.slug), 201
    finally:
        db.close()


@bp.post("/api/assignments/<slug>/start")
def start_assignment(slug):
    """Opening an assignment's link. A student gets their own copy of the
    starter the first time, and the same game every time after — even if
    they renamed it. The teacher who set it gets the starter itself, to
    change. Hidden assignments can't be started (a game already started
    still opens: it's theirs); archived ones can't either."""
    db = _db()
    try:
        user = _need_user(db)
        a = _assignment(db, slug)
        g = _game_of(db, a)
        if g is None:
            return err("This assignment has no game to start from.", 409)
        if a.teacher_id == user.id:
            starter = db.query(GameProject).filter_by(id=g.starter_id).first()
            return jsonify(project=starter.slug, starter=True)
        work = db.query(AssignmentWork).filter_by(assignment_id=a.id, owner_id=user.id).first()
        if work is not None:
            p = db.query(GameProject).filter_by(id=work.project_id).first()
            if p.deleted_at is not None:
                p.deleted_at = None  # deleted from My Games by mistake: the assignment brings it back
                db.commit()
            return jsonify(project=p.slug, starter=False)
        item = _item_of(db, a)
        if a.archived or (item and item.hidden):
            return err("This assignment isn't open. Ask your teacher.", 403)
        starter = db.query(GameProject).filter_by(id=g.starter_id).first()
        p = copy_project(db, starter, user, a.title)
        db.add(AssignmentWork(assignment_id=a.id, owner_id=user.id, project_id=p.id))
        db.commit()
        return jsonify(project=p.slug, starter=False), 201
    finally:
        db.close()


def _work_for(db, user, p):
    """(assignment, work) when this project is the user's own work for an assignment, else (None, None)."""
    work = db.query(AssignmentWork).filter_by(project_id=p.id).first()
    if work is None or work.owner_id != user.id:
        return None, None
    return db.query(accounts.Assignment).filter_by(id=work.assignment_id).first(), work


def _own_game(db, user, slug):
    p = db.query(GameProject).filter_by(slug=slug).first()
    if p is None or p.deleted_at is not None or p.owner_id != user.id:
        fail("There is no game of yours here.", 404)
    return p


@bp.get("/api/projects/<slug>/assignment")
def project_assignment(slug):
    """For the editor: whether the open game is the student's work for an
    assignment — then it offers Turn in — and how that stands."""
    db = _db()
    try:
        user = _need_user(db)
        p = db.query(GameProject).filter_by(slug=slug).first()
        if p is None or not can_read(db, user, p):
            return err("There is no game here.", 404)
        a, _ = _work_for(db, user, p)
        if a is None:
            # The teacher, looking at a student's work or editing the starter:
            # the notes whole, key and all, and nothing to turn in.
            work = db.query(AssignmentWork).filter_by(project_id=p.id).first()
            starter = db.query(AssignmentGame).filter_by(starter_id=p.id).first()
            aid = work.assignment_id if work else starter.assignment_id if starter else None
            t = db.query(accounts.Assignment).filter_by(id=aid).first() if aid else None
            if t is not None and t.teacher_id == user.id:
                return jsonify(assignment={"slug": t.slug, "title": t.title, "teacher": True, "notes": grades.notes_of(t)})
            return jsonify(assignment=None)
        s = db.query(accounts.Submission).filter_by(assignment_id=a.id, student_id=user.id).first()
        g = _game_of(db, a)
        unread = db.query(func.count(Comment.id)).filter(Comment.project_id == p.id, Comment.author_id != user.id,
                                                         Comment.seen == 0).scalar()
        # THE ONE EXIT for an assignment's notes to a student: redacted
        # (notes.py says why; test_server.py's leak checks open it).
        return jsonify(assignment={"slug": a.slug, "title": a.title, "dueAt": _iso(g.due_at if g else None),
                                   "notes": notes.student_notes(a),
                                   "turnedIn": _iso(s.submitted_at) if s and s.times_submitted > 0 else None,
                                   "changedSince": bool(s and s.times_submitted > 0 and _naive(p.updated_at) > _naive(s.submitted_at)),
                                   "unread": int(unread)})
    finally:
        db.close()


@bp.post("/api/projects/<slug>/turn-in")
def turn_in(slug):
    """Turn in: the game as the server has it now, frozen (the page saves
    first). Turning in again freezes a new copy and keeps the teacher's
    comments and score."""
    db = _db()
    try:
        user = _need_user(db)
        p = _own_game(db, user, slug)
        a, _ = _work_for(db, user, p)
        if a is None:
            return err("This game isn't an assignment, so there's nothing to turn it in to.", 400)
        if a.archived:
            return err("This assignment is closed. Ask your teacher.", 403)
        v = _freeze(db, p, "turned-in", "Turned in")
        s = db.query(accounts.Submission).filter_by(assignment_id=a.id, student_id=user.id).first()
        if s is None:
            s = accounts.Submission(assignment_id=a.id, student_id=user.id, snippet_slug=f"v{v.id}", times_submitted=0)
            db.add(s)
        s.snippet_slug = f"v{v.id}"
        s.submitted_at = now()
        s.times_submitted = (s.times_submitted or 0) + 1
        db.commit()
        return jsonify(ok=True, turnedIn=_iso(s.submitted_at), times=s.times_submitted)
    finally:
        db.close()


@bp.post("/api/assignments/<slug>/score")
def give_score(slug):
    """A score for one student, or null to clear it. Work never turned in is
    frozen now (kind "graded"), so a score always points at what it was for."""
    db = _db()
    try:
        user = _need_teacher(db)
        a = _own_assignment(db, user, slug)
        body = request.get_json(silent=True) or {}
        sid = body.get("student")
        score = body.get("score")
        if score is not None:
            try:
                score = float(score)
            except (TypeError, ValueError):
                return err("A score is a number.", 400)
            if score < 0 or (a.out_of and score > a.out_of * 2):
                return err("That score is out of range.", 400)
        s = db.query(accounts.Submission).filter_by(assignment_id=a.id, student_id=sid).first()
        if s is None or not s.snippet_slug:
            # Never turned in (perhaps only answered questions): freeze the
            # game now, so the score always points at what it was for.
            work = db.query(AssignmentWork).filter_by(assignment_id=a.id, owner_id=sid).first()
            if work is None:
                return err("That student hasn't started this assignment.", 400)
            p = db.query(GameProject).filter_by(id=work.project_id).first()
            v = _freeze(db, p, "graded", "Scored by your teacher")
            if s is None:
                s = accounts.Submission(assignment_id=a.id, student_id=sid, snippet_slug=f"v{v.id}", times_submitted=0)
                db.add(s)
            s.snippet_slug = f"v{v.id}"
        s.score = score
        db.commit()
        # Full marks pays the quest reward, once — after the score is
        # committed, so nothing in paying it can lose the score.
        paid = rewards.full_marks_xp(db, a, sid)
        total = grades.student_total(db, a, sid)
        return jsonify(ok=True, total=total, synced=total is not None and total == s.score_synced, questPaid=paid)
    finally:
        db.close()


# ---------------------------------------------------------------- comments

def _readable(db, user, slug):
    p = db.query(GameProject).filter_by(slug=slug).first()
    if p is None or not can_read(db, user, p):
        fail("There is no game here.", 404)
    return p


@bp.get("/api/projects/<slug>/comments")
def get_comments(slug):
    """The comments on a game, oldest first. Reading them marks the other
    side's as seen."""
    db = _db()
    try:
        user = _need_user(db)
        p = _readable(db, user, slug)
        rows = db.query(Comment).filter_by(project_id=p.id).order_by(Comment.created_at, Comment.id).all()
        names = {u.id: u.display_name() for u in db.query(accounts.User).filter(
            accounts.User.id.in_({c.author_id for c in rows} or {-1})).all()}
        out = [{"id": c.id, "text": c.text, "author": names.get(c.author_id, ""), "mine": c.author_id == user.id,
                "teacher": c.author_id != p.owner_id, "at": _iso(c.created_at)} for c in rows]
        changed = False
        for c in rows:
            if c.author_id != user.id and not c.seen:
                c.seen, changed = 1, True
        if changed:
            db.commit()
        return jsonify(comments=out)
    finally:
        db.close()


@bp.post("/api/projects/<slug>/comments")
def add_comment(slug):
    """The teacher of the assignment comments; its student replies. Nobody else can."""
    db = _db()
    try:
        user = _need_user(db)
        p = _readable(db, user, slug)
        if p.owner_id == user.id and db.query(AssignmentWork).filter_by(project_id=p.id).first() is None:
            return err("Comments are for games that are an assignment.", 400)
        text = str((request.get_json(silent=True) or {}).get("text") or "").strip()[:2000]
        if not text:
            return err("Write something first.", 400)
        c = Comment(project_id=p.id, author_id=user.id, text=text)
        db.add(c)
        db.commit()
        return jsonify(id=c.id), 201
    finally:
        db.close()


@bp.post("/api/projects/<slug>/duplicate")
def duplicate(slug):
    """A teacher's own copy of a student's game, to show the class (or of a
    turned-in version, `version`). The student's game isn't touched, and
    the copy is the teacher's to change."""
    db = _db()
    try:
        user = _need_teacher(db)
        p = _readable(db, user, slug)
        if p.owner_id == user.id:
            return err("That's already your game. Use Clone on My Games.", 400)
        vid = (request.get_json(silent=True) or {}).get("version")
        text = None
        if vid:
            v = db.query(GameVersion).filter_by(id=int(vid), project_id=p.id).first()
            if v is None:
                return err("That version isn't here.", 404)
            text = v.data
        owner = db.query(accounts.User).filter_by(id=p.owner_id).first()
        name = str(json.loads(text).get("name") or p.name) if text else p.name
        copy = copy_project(db, p, user, f"{name} (from {owner.display_name() if owner else 'a student'})", text)
        db.commit()
        return jsonify(project=copy.slug), 201
    finally:
        db.close()


# ---------------------------------------------------------------- links

@bp.get("/a/<slug>")
def assignment_link(slug):
    """The link a teacher hands out (and posts to Classroom). The editor is
    one page with hash routes, so this sends the browser to its own."""
    if not re.fullmatch(r"[\w-]{1,16}", slug):
        abort(404)
    return redirect("/#/a/" + slug)


# ---------------------------------------------------------------- Google Classroom
# PyIDE's connection, rosters, posting and grade sync, for GameIDE's classes.
# A teacher connects once in each editor: ClassroomLink is per app, because a
# refresh token belongs to the OAuth client that got it (accounts.py says
# more). GameIDE's /classroom/callback has to be on the Google client's list
# of redirect addresses, as PyIDE's, WebIDE's and FlaskIDE's are.

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
CLASSROOM_API = "https://classroom.googleapis.com/v1"

#: As PyIDE asks: listing classes, rosters (with emails, to match a student
#: here to one there), and posting and grading coursework. openid and email
#: say WHICH Google account granted it.
CLASSROOM_SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students",
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
    "https://www.googleapis.com/auth/classroom.profile.emails",
]


def classroom_configured():
    return bool(os.environ.get("GOOGLE_CLIENT_ID") and os.environ.get("GOOGLE_CLIENT_SECRET"))


# The only three doors to Google. Each never raises, and the tests replace
# them, so nothing in the test suite ever reaches the network.

def _google_post(url, data):
    import requests
    try:
        r = requests.post(url, data=data, timeout=15)
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, {}
    except Exception:
        return 0, {}


def _google_get(url, access_token, params=None):
    import requests
    try:
        r = requests.get(url, params=params or {}, timeout=15, headers={"Authorization": "Bearer " + access_token})
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, {}
    except Exception:
        return 0, {}


def _google_api(method, url, access_token, body=None, params=None):
    import requests
    try:
        r = requests.request(method, url, json=body, params=params or {}, timeout=20,
                             headers={"Authorization": "Bearer " + access_token})
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, {}
    except Exception:
        return 0, {}


def _google_message(data, fallback):
    e = data.get("error") if isinstance(data, dict) else None
    if isinstance(e, dict) and e.get("message"):
        return e["message"]
    return fallback


def _google_list(url, access_token, key, params=None):
    """Every page of a Classroom list: (items, status). A second page silently
    dropped would be students silently left off the roster."""
    items, token, params = [], None, dict(params or {}, pageSize=100)
    for _ in range(50):
        if token:
            params["pageToken"] = token
        status, data = _google_get(url, access_token, params)
        if status != 200:
            return items, status
        items.extend(data.get(key, []))
        token = data.get("nextPageToken")
        if not token:
            break
    return items, 200


def _token_box():
    """Encrypts stored refresh tokens with a key from SECRET_KEY, which is in
    Render's environment and not the database (see ClassroomLink)."""
    import base64
    import hashlib
    from cryptography.fernet import Fernet
    from flask import current_app
    digest = hashlib.sha256(("classroom-token:" + current_app.secret_key).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _classroom_link(db, user):
    return db.query(accounts.ClassroomLink).filter_by(user_id=user.id, app=APP_NAME).first()


def _classroom_token(db, user):
    """A fresh access token, or (None, why). A refresh token Google no longer
    honours, or one that can't be decrypted (SECRET_KEY changed), is deleted,
    so the page goes back to offering Connect instead of failing the same
    way forever."""
    link = _classroom_link(db, user)
    if link is None:
        return None, "Connect Google Classroom first."
    try:
        refresh = _token_box().decrypt(link.refresh_token.encode()).decode()
    except Exception:
        db.delete(link)
        db.commit()
        return None, "Your Classroom connection needs renewing. Connect it again."
    status, data = _google_post(GOOGLE_TOKEN_URL, {
        "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        "refresh_token": refresh,
        "grant_type": "refresh_token",
    })
    if status == 200 and data.get("access_token"):
        return data["access_token"], ""
    if data.get("error") == "invalid_grant":
        db.delete(link)
        db.commit()
        return None, "Google no longer accepts GameIDE's connection to your Classroom. Connect it again."
    return None, "Couldn't reach Google just now. Try again in a moment."


def _callback_url():
    return url_for("classes.classroom_callback", _external=True, _scheme=_scheme())


def _classroom_teacher(db):
    if not classroom_configured():
        abort(404)
    user = _current_user(db)
    if user is None:
        return None, redirect("/login?next=/%23/classes")
    if not is_teacher(user):
        abort(404)
    return user, None


@bp.get("/classroom/connect")
def classroom_connect():
    db = _db()
    try:
        user, bounce = _classroom_teacher(db)
        if bounce:
            return bounce
        # Ties Google's reply to this browser: without it, a crafted link
        # could finish a connect in a teacher's session with someone else's
        # Google account.
        state = secrets.token_urlsafe(24)
        session["classroom_state"] = state
        return redirect(GOOGLE_AUTH_URL + "?" + urlencode({
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
            "redirect_uri": _callback_url(),
            "response_type": "code",
            "scope": " ".join(CLASSROOM_SCOPES),
            # offline + consent: a refresh token every time, so a reconnect
            # never stores nothing.
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "login_hint": user.email,
            "state": state,
        }))
    finally:
        db.close()


CLASSROOM_ERRORS = {
    "access_denied": "You didn't allow GameIDE to use your Classroom, so nothing was connected.",
    "admin_policy_enforced": "Your school's Google admin doesn't allow this app to use Google Classroom. "
                             "Ask your IT department to allow it.",
}


@bp.get("/classroom/callback")
def classroom_callback():
    db = _db()
    try:
        user, bounce = _classroom_teacher(db)
        if bounce:
            return bounce
        expected = session.pop("classroom_state", None)
        if not expected or request.args.get("state") != expected:
            return _problem("That Classroom connection didn't come from this page. Start it again from Classes.", 400)
        error = request.args.get("error")
        if error:
            return _problem(CLASSROOM_ERRORS.get(error, "Google didn't connect your Classroom (%s)." % error), 400)
        status, data = _google_post(GOOGLE_TOKEN_URL, {
            "code": request.args.get("code", ""),
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
            "redirect_uri": _callback_url(),
            "grant_type": "authorization_code",
        })
        access, refresh = data.get("access_token"), data.get("refresh_token")
        if status != 200 or not access or not refresh:
            return _problem("Google didn't finish connecting your Classroom. Try again.", 400)

        def give_back():
            _google_post(GOOGLE_REVOKE_URL, {"token": refresh})

        # A box unticked on Google's screen would fail later, at the moment
        # grades are sent, with an error nobody could trace back here.
        granted = set((data.get("scope") or "").split())
        if [s for s in CLASSROOM_SCOPES if s.startswith("https://") and s not in granted]:
            give_back()
            return _problem("GameIDE needs every Classroom permission on that screen to bring in your classes and "
                            "send grades. Connect again and leave all the boxes ticked.", 400)
        # The school account, not a personal one picked by mistake.
        status, info = _google_get(GOOGLE_USERINFO_URL, access)
        google_email = (info.get("email") or "").strip()
        if status != 200 or google_email.lower() != user.email.lower():
            give_back()
            return _problem("You connected %s, but you're signed in to GameIDE as %s. Connect again and choose %s."
                            % (google_email or "a different Google account", user.email, user.email), 400)
        link = _classroom_link(db, user)
        if link is None:
            link = accounts.ClassroomLink(user_id=user.id, app=APP_NAME, refresh_token="")
            db.add(link)
        link.refresh_token = _token_box().encrypt(refresh.encode()).decode()
        link.google_email = google_email
        link.connected_at = now()
        db.commit()
        return redirect("/#/classes")
    finally:
        db.close()


@bp.post("/classroom/disconnect")
def classroom_disconnect():
    db = _db()
    try:
        user = _need_teacher(db)
        link = _classroom_link(db, user)
        if link is not None:
            # Revoked at Google as well as forgotten here.
            try:
                _google_post(GOOGLE_REVOKE_URL, {"token": _token_box().decrypt(link.refresh_token.encode()).decode()})
            except Exception:
                pass
            db.delete(link)
            db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.get("/api/classroom/courses")
def classroom_courses():
    """The teacher's active Classroom classes, to bring one in."""
    db = _db()
    try:
        user = _need_teacher(db)
        if not classroom_configured():
            return err("Google Classroom isn't set up on this site.", 404)
        access, why = _classroom_token(db, user)
        if access is None:
            return err(why, 409)
        courses, status = _google_list(CLASSROOM_API + "/courses", access, "courses",
                                       {"teacherId": "me", "courseStates": "ACTIVE"})
        if status != 200:
            return err("Google wouldn't list your classes.", 502)
        brought = {c.course_id for c in _courses(db).filter_by(teacher_id=user.id).all() if c.course_id}
        return jsonify(courses=[{"id": c.get("id", ""), "name": c.get("name", ""), "section": c.get("section", ""),
                                 "here": c.get("id") in brought} for c in courses])
    finally:
        db.close()


def _link_course(db, user, course, course_id):
    """Link a class to a Classroom course, asking Google its name — which is
    also the proof this teacher teaches it. "" unlinks. Returns a problem or ""."""
    if not course_id:
        course.course_id, course.course_name = "", ""
        return ""
    if not re.fullmatch(r"[0-9]{1,30}", course_id):
        return "Choose a Google Classroom class."
    access, why = _classroom_token(db, user)
    if access is None:
        return why
    status, got = _google_get("%s/courses/%s" % (CLASSROOM_API, course_id), access)
    if status != 200:
        return _google_message(got, "Google couldn't find that class.")
    name = got.get("name") or ""
    if got.get("section"):
        name += " — " + got["section"]
    course.course_id, course.course_name = course_id, name[:200]
    return ""


def _sync_roster(db, user, course):
    """The class's students, from its Classroom course: (count, problem). The
    roster replaces what was kept — a student who left leaves with the next
    sync. Their games and turned-in work are untouched."""
    if not course.course_id:
        return None, "This class isn't linked to a Google Classroom class."
    access, why = _classroom_token(db, user)
    if access is None:
        return None, why
    roster, status = _google_list("%s/courses/%s/students" % (CLASSROOM_API, course.course_id), access, "students")
    if status != 200:
        return None, "Google wouldn't list the students in that class."
    found = {}
    for st in roster:
        profile = st.get("profile") or {}
        email = (profile.get("emailAddress") or "").strip().lower()
        if email:
            found[email[:320]] = ((profile.get("name") or {}).get("fullName") or "")[:200]
    kept = {e.email.lower(): e for e in db.query(accounts.Enrollment).filter_by(class_id=course.id)}
    for email, row in kept.items():
        if email not in found:
            db.delete(row)
    for email, name in found.items():
        if email in kept:
            kept[email].name = name
        else:
            db.add(accounts.Enrollment(class_id=course.id, email=email, name=name))
    course.roster_at = now()
    db.commit()
    return len(found), ""


@bp.post("/api/assignments/<slug>/classroom/post")
def classroom_post(slug):
    """Create the assignment in its class's Classroom course. Google lets an
    app grade only coursework the app made, so Sync needs this first. The
    coursework carries the /a/<slug> link, so a student opening it from
    Classroom lands in their own copy. `draft` makes it a Classroom draft,
    assigned there whenever the teacher is ready. The due date is the
    assignment's own."""
    db = _db()
    try:
        user = _need_teacher(db)
        a = _own_assignment(db, user, slug)
        item = _item_of(db, a)
        course = db.query(accounts.Course).filter_by(id=item.class_id).first() if item else None
        if course is None or not course.course_id:
            return err("Link this class to a Google Classroom class first.", 400)
        if not a.out_of:
            return err("Set what it's out of first — Classroom only takes grades on work with points.", 400)
        access, why = _classroom_token(db, user)
        if access is None:
            return err(why, 409)
        already = db.query(accounts.ClassroomPost).filter_by(assignment_id=a.id, course_id=course.course_id).first()
        if already:
            status, _ = _google_get("%s/courses/%s/courseWork/%s" % (CLASSROOM_API, course.course_id, already.work_id), access)
            if status != 404:
                return err("It's already posted to %s." % (already.course_name or "that class"), 409)
            _forget_post(db, a, already)  # deleted in Classroom since: post it fresh
        g = _game_of(db, a)
        due = {}
        if g and g.due_at:
            when = g.due_at
            if when <= datetime.now(timezone.utc).replace(tzinfo=None):
                return err("Its due date has already passed. Change it first.", 400)
            due = {"dueDate": {"year": when.year, "month": when.month, "day": when.day},
                   "dueTime": {"hours": when.hour, "minutes": when.minute}}
        link = url_for("classes.assignment_link", slug=a.slug, _external=True, _scheme=_scheme())
        status, work = _google_api("POST", "%s/courses/%s/courseWork" % (CLASSROOM_API, course.course_id), access, body={
            "title": a.title,
            "description": "Open it in GameIDE and sign in with your school account. Press Turn in there when you're done.",
            "materials": [{"link": {"url": link}}],
            "workType": "ASSIGNMENT",
            "state": "DRAFT" if (request.get_json(silent=True) or {}).get("draft") is True else "PUBLISHED",
            "maxPoints": a.out_of,
            **due,
        })
        if status != 200 or not work.get("id"):
            return err(_google_message(work, "Google wouldn't create the assignment."), 502)
        post = accounts.ClassroomPost(assignment_id=a.id, course_id=course.course_id, course_name=course.course_name[:200],
                                      work_id=str(work["id"])[:32], url=(work.get("alternateLink") or "")[:300])
        db.add(post)
        a.updated_at = now()
        db.commit()
        return jsonify(ok=True, url=post.url)
    finally:
        db.close()


def _forget_post(db, a, post):
    """The Classroom coursework is gone: forget it here, and mark every score
    not yet sent, since a new post is new coursework with none of them."""
    db.delete(post)
    db.query(accounts.Submission).filter_by(assignment_id=a.id).update({"score_synced": None}, synchronize_session=False)
    db.commit()


@bp.post("/api/assignments/<slug>/classroom/sync")
def classroom_sync(slug):
    """Every score to Classroom as a DRAFT grade — the teacher returns them
    there. Students are matched by email; one who can't be matched is named
    in the reply rather than skipped in silence."""
    db = _db()
    try:
        user = _need_teacher(db)
        a = _own_assignment(db, user, slug)
        post = db.query(accounts.ClassroomPost).filter_by(assignment_id=a.id).first()
        if post is None:
            return err("Post it to Google Classroom first.", 400)
        access, why = _classroom_token(db, user)
        if access is None:
            return err(why, 409)
        base = "%s/courses/%s" % (CLASSROOM_API, post.course_id)
        status, work = _google_get("%s/courseWork/%s" % (base, post.work_id), access)
        if status == 404:
            _forget_post(db, a, post)
            return err("That assignment is gone from Google Classroom. Post it again.", 409)
        if status != 200:
            return err("Google wouldn't say how the assignment stands in Classroom.", 502)
        if work.get("state") == "DRAFT":
            return err("It's still a draft in Classroom. Assign it there first, then sync.", 409)
        roster, status = _google_list(base + "/students", access, "students")
        subs, status2 = _google_list("%s/courseWork/%s/studentSubmissions" % (base, post.work_id), access, "studentSubmissions")
        if status != 200 or status2 != 200:
            return err("Google wouldn't list the class's students and their work.", 502)
        by_user = {s.get("userId"): s.get("id") for s in subs}
        ids = {}
        for st in roster:
            email = ((st.get("profile") or {}).get("emailAddress") or "").lower()
            if email:
                ids[email] = by_user.get(st.get("userId"))
        rows = (db.query(accounts.Submission, accounts.User)
                .join(accounts.User, accounts.Submission.student_id == accounts.User.id)
                .filter(accounts.Submission.assignment_id == a.id).all())
        # The grade is the score plus the notes' points (grades.total): a
        # student with no score yet but questions answered still has one.
        earned = grades.earned(db, a.id)
        sent, unmatched, failed = 0, [], []
        for sub, student in rows:
            grade = grades.total(sub.score, earned.get(student.id))
            if grade is None:
                continue
            cid = ids.get(student.email.lower())
            if not cid:
                unmatched.append(student.display_name())
                continue
            status, data = _google_api("PATCH", "%s/courseWork/%s/studentSubmissions/%s" % (base, post.work_id, cid),
                                       access, body={"draftGrade": grade}, params={"updateMask": "draftGrade"})
            if status == 200:
                sub.score_synced = grade
                sent += 1
            else:
                failed.append("%s (%s)" % (student.display_name(), _google_message(data, "refused")))
        db.commit()
        return jsonify(ok=True, sent=sent, unmatched=unmatched, failed=failed)
    finally:
        db.close()
