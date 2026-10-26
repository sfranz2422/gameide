"""
Tutorials (Phase 11b): the built-in ones the editor ships with, the ones
teachers write, sharing them, and the XP for working through one.

A tutorial is markdown — a header, then one step per `---` slide, each with
```check blocks (frontend/src/tutorials/tutorial.ts). It runs in the
editor's Notes tab, step by step, Next locked until a step's checks pass.
Where a student has got to is kept in their game's own JSON (`tutorial`:
{key, step, steps, title}), so it saves offline and signed out like any
change, and the library reads progress from the games themselves.

Keys name where a tutorial's markdown is:
  builtin:<name>    frontend/public/tutorials/<name>.md
  t:<slug>          a teacher's, in gameide_tutorials
  a:<slug>          an assignment made from one: its notes are the tutorial

Assigned to a class, a tutorial is an ordinary assignment whose notes are
the tutorial (classes.new_assignment, `notes`): marking, Check all (its
```check blocks count as tests — grades.tests_of), results and Classroom
work unchanged.
"""
import json
import os
import re
from pathlib import Path

from flask import Blueprint, abort, jsonify, make_response, request
from sqlalchemy import func

import accounts
import checks
import grades
import rewards
import xp
from accounts import now
from gamestore import AssignmentWork, Tutorial

bp = Blueprint("tutorials", __name__)

APP_NAME = "gameide"
MAX_TUTORIAL = 100_000
VISIBILITIES = ("private", "classes", "site")

_db = None
_current_user = None
_dist = None


def init(app, session_factory, current_user, dist):
    global _db, _current_user, _dist
    _db, _current_user, _dist = session_factory, current_user, dist
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


def _is_teacher(user):
    return bool(user) and accounts.is_teacher(user.email)


def _is_admin(user):
    return bool(user) and user.email.lower() in [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]


# ---------------------------------------------------------------- the format (as tutorial.ts reads it)

HEADER = re.compile(r"^\s*---[ \t]*\n(.*?)\n---[ \t]*(?:\n|$)", re.S)
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
RULE = re.compile(r"^ {0,3}-{3,}\s*$")


def split_header(md):
    """({field: value}, body) — the header's fields, and the steps after it."""
    text = str(md or "").replace("\r\n", "\n").replace("\r", "\n")
    m = HEADER.match(text)
    fields = {}
    if m:
        for line in m.group(1).split("\n"):
            f = re.match(r"^([a-z]+)\s*:\s*(.*)$", line.strip(), re.I)
            if f:
                fields[f.group(1).lower()] = f.group(2).strip()
    return fields, (text[m.end():] if m else text)


def _slides(md):
    """notes/quiz.ts slides(), in Python: cut at --- lines outside code, [] for none."""
    out, cur, fence, cuts = [], [], None, 0
    for ln in md.split("\n"):
        f = FENCE.match(ln)
        if f:
            if fence is None:
                fence = f.group(1)
            elif f.group(1)[0] == fence[0] and len(f.group(1)) >= len(fence):
                fence = None
        elif fence is None and RULE.match(ln):
            out.append(cur)
            cur, cuts = [], cuts + 1
            continue
        cur.append(ln)
    out.append(cur)
    if not cuts:
        return []
    return [s for s in ("\n".join(x).strip("\n").strip() for x in out) if s.strip()]


def steps_of(md):
    """The tutorial's steps, as the editor counts them."""
    _, body = split_header(md)
    cut = _slides(body)
    return cut if cut else ([body.strip()] if body.strip() else [])


def is_tutorial(md):
    fields, _ = split_header(md)
    return bool(fields.get("title")) and bool(HEADER.match(str(md or "").replace("\r\n", "\n")))


def meta(md):
    fields, _ = split_header(md)
    return {"title": fields.get("title") or "Untitled tutorial", "level": fields.get("level") or "Getting Started",
            "time": fields.get("time", ""), "starter": fields.get("starter") or "empty",
            "description": fields.get("description", ""), "steps": len(steps_of(md))}


# ---------------------------------------------------------------- where tutorials are

def _builtin_dir():
    """The built-in tutorials: in the build (dist/tutorials), or in the source
    when there's no build (the tests, and a server run without one)."""
    built = Path(_dist() if callable(_dist) else _dist) / "tutorials"
    return built if built.exists() else Path(__file__).resolve().parent.parent / "frontend" / "public" / "tutorials"


def builtin(name):
    if not re.fullmatch(r"[a-z0-9-]{1,40}", name or ""):
        return None
    f = _builtin_dir() / (name + ".md")
    return f.read_text(encoding="utf-8") if f.exists() else None


def _teachers_of(db, user):
    """Ids of the teachers of the GameIDE classes this person is on the roster of."""
    rows = (db.query(accounts.Course.teacher_id)
            .join(accounts.Enrollment, accounts.Enrollment.class_id == accounts.Course.id)
            .filter(accounts.Course.app == APP_NAME, func.lower(accounts.Enrollment.email) == user.email.lower()))
    return {r.teacher_id for r in rows}


def _can_see(db, user, t):
    if t.visibility == "site":
        return True
    if user is None:
        return False
    if t.owner_id == user.id or _is_admin(user):
        return True
    return t.visibility == "classes" and t.owner_id in _teachers_of(db, user)


def markdown_for(db, user, key):
    """A tutorial's markdown by key, if this person may follow it; else None."""
    kind, _, rest = str(key or "").partition(":")
    if kind == "builtin":
        return builtin(rest)
    if kind == "t":
        t = db.query(Tutorial).filter_by(slug=rest[:16]).first()
        return t.markdown if t is not None and _can_see(db, user, t) else None
    if kind == "a" and user is not None:
        a = db.query(accounts.Assignment).filter_by(slug=rest[:16], app=APP_NAME).first()
        if a is None:
            return None
        mine = db.query(AssignmentWork).filter_by(assignment_id=a.id, owner_id=user.id).first() is not None
        return grades.notes_of(a) if mine or a.teacher_id == user.id else None
    return None


def _out(db, t, user):
    owner = db.query(accounts.User).filter_by(id=t.owner_id).first()
    return {"slug": t.slug, "key": "t:" + t.slug, **meta(t.markdown), "visibility": t.visibility,
            "owner": owner.display_name() if owner else "", "mine": user is not None and t.owner_id == user.id,
            "updated": t.updated_at.isoformat() + ("Z" if t.updated_at.tzinfo is None else "")}


# ---------------------------------------------------------------- routes

@bp.get("/api/tutorials")
def list_tutorials():
    """Tutorials beyond the built-in ones: a teacher's own, and those shared
    with this person — their teachers' "classes" ones, and every "site" one."""
    db = _db()
    try:
        user = _current_user(db)
        rows = db.query(Tutorial).filter(Tutorial.visibility == "site").all()
        if user is not None:
            rows += db.query(Tutorial).filter(Tutorial.owner_id == user.id).all()
            teachers = _teachers_of(db, user)
            if teachers:
                rows += db.query(Tutorial).filter(Tutorial.visibility == "classes", Tutorial.owner_id.in_(teachers)).all()
        seen, out = set(), []
        for t in sorted(rows, key=lambda t: t.title.lower()):
            if t.id not in seen:
                seen.add(t.id)
                out.append(_out(db, t, user))
        return jsonify(tutorials=out, teacher=_is_teacher(user), admin=_is_admin(user))
    finally:
        db.close()


@bp.get("/api/tutorials/<slug>")
def get_tutorial(slug):
    db = _db()
    try:
        user = _current_user(db)
        t = db.query(Tutorial).filter_by(slug=slug[:16]).first()
        if t is None or not _can_see(db, user, t):
            return err("There's no tutorial here.", 404)
        return jsonify(markdown=t.markdown, **_out(db, t, user))
    finally:
        db.close()


def _clean(db, user, body, t=None):
    """(fields, problem) for a tutorial a teacher sent."""
    md = str(body.get("markdown") or "")
    if len(md) > MAX_TUTORIAL:
        return None, "That tutorial is too long (%d characters at most)." % MAX_TUTORIAL
    if not is_tutorial(md):
        return None, "A tutorial starts with a header: a line of ---, then title: and the rest, then another ---."
    vis = str(body.get("visibility") or (t.visibility if t else "private"))
    if vis not in VISIBILITIES:
        return None, "Choose who can see it."
    if vis == "site" and not _is_admin(user) and not (t is not None and t.visibility == "site"):
        return None, "Only an admin can publish a tutorial for everyone."
    m = meta(md)
    return {"markdown": md, "visibility": vis, "title": m["title"][:200], "level": m["level"][:60]}, ""


@bp.post("/api/tutorials")
def new_tutorial():
    db = _db()
    try:
        user = _need_user(db)
        if not _is_teacher(user):
            return err("Only a teacher can write a tutorial.", 403)
        fields, problem = _clean(db, user, request.get_json(silent=True) or {})
        if problem:
            return err(problem, 400)
        t = Tutorial(slug=accounts.new_id(db, Tutorial), owner_id=user.id, **fields)
        db.add(t)
        db.commit()
        return jsonify(slug=t.slug), 201
    finally:
        db.close()


def _own(db, user, slug):
    t = db.query(Tutorial).filter_by(slug=slug[:16]).first()
    if t is None:
        fail("There's no tutorial here.", 404)
    if t.owner_id != user.id and not _is_admin(user):
        fail("That's someone else's tutorial.", 403)
    return t


@bp.post("/api/tutorials/<slug>")
def update_tutorial(slug):
    db = _db()
    try:
        user = _need_user(db)
        t = _own(db, user, slug)
        fields, problem = _clean(db, user, request.get_json(silent=True) or {}, t)
        if problem:
            return err(problem, 400)
        for k, v in fields.items():
            setattr(t, k, v)
        t.updated_at = now()
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.delete("/api/tutorials/<slug>")
def delete_tutorial(slug):
    """Students' games keep their progress; the tutorial just can't be opened any more."""
    db = _db()
    try:
        user = _need_user(db)
        db.delete(_own(db, user, slug))
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


@bp.post("/api/tutorials/step")
def step_done():
    """A student passed a step's checks (or reached the end). The checks run
    in their browser, so this trusts the page — and pays accordingly: a
    little XP once per step that has checks, ever, and a bonus once for
    finishing. A faked claim takes at most that, for tutorials they can open."""
    db = _db()
    try:
        user = _need_user(db)
        body = request.get_json(silent=True) or {}
        key = str(body.get("key") or "")[:60]
        md = markdown_for(db, user, key)
        if md is None:
            return err("There's no tutorial here.", 404)
        steps = steps_of(md)
        try:
            n = int(body.get("step"))
        except (TypeError, ValueError):
            return err("No such step.", 400)
        if not 0 <= n < len(steps):
            return err("No such step.", 400)
        if not rewards.earns_xp(user):
            return jsonify(xp=0)
        title = meta(md)["title"]
        got = 0
        if checks.blocks(steps[n], "check"):
            got += xp.award(db, user.id, "tutstep:%s:%d" % (key, n), xp.SELF_TEST_XP,
                            ("Tutorial step: %s, step %d" % (title, n + 1))[:200], APP_NAME)
        if n == len(steps) - 1:
            got += xp.award(db, user.id, "tutdone:%s" % key, xp.ALL_ANSWERED_XP,
                            ("Finished the tutorial %s" % title)[:200], APP_NAME)
        return jsonify(xp=got)
    finally:
        db.close()
