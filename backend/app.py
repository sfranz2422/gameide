"""
GameIDE's server: signing in, and keeping projects, their pictures and
their history. It never runs a game — games run in the browser — and it
serves the built editor (frontend/dist) with the headers the editor needs.

It shares PyIDE's database, Google client and accounts.py, so a student is
the same `users` row in all four apps. Sign-in follows PyIDE's exactly —
Google only, `TEACHER_EMAILS` deciding who teaches, `ALLOWED_EMAIL_DOMAINS`
deciding who may sign in — and, as there, signing in only ever adds
abilities: with no Google settings the editor works fully, keeping projects
in the browser.
"""
import base64
import json
import os
import re
import secrets
import time
from html import escape
from datetime import timedelta
from pathlib import Path

from flask import Flask, Response, abort, jsonify, make_response, redirect, request, send_from_directory, session, url_for
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from werkzeug.exceptions import BadRequest

import accounts
import classes
import notes
import rewards
import tutorials
import library
import grades
import gamestore
import publishing
from gamestore import GameAsset, GameProject, GameVersion

APP_NAME = "gameide"
HERE = Path(__file__).resolve().parent
DIST = Path(os.environ.get("GAMEIDE_DIST") or HERE.parent / "frontend" / "dist")

# ---------------------------------------------------------------- database


def _database_url() -> str:
    """Render supplies DATABASE_URL; locally, a SQLite file beside this one."""
    # GAMEIDE_TEST_DATABASE_URL: the tests' throwaway database. Not
    # DATABASE_URL, which also means "this is the real server" below.
    url = os.environ.get("DATABASE_URL", "") or os.environ.get("GAMEIDE_TEST_DATABASE_URL", "")
    if not url:
        return "sqlite:///" + str(HERE / "gameide.db")
    if url.startswith("postgres://"):  # SQLAlchemy 2 wants postgresql://
        url = url.replace("postgres://", "postgresql://", 1)
    return url


# A fourth app on the same Postgres: keep its share of connections small.
# Two gunicorn workers × (3 + 2) is ten at the very most.
_url = _database_url()
engine = create_engine(
    _url,
    pool_pre_ping=True,
    **({} if _url.startswith("sqlite") else {"pool_size": 3, "max_overflow": 2}),
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

if _url.startswith("sqlite"):
    # SQLite ignores foreign keys unless asked; Postgres (Render) never does.
    # Without this, a delete that leaves rows pointing at what it deleted
    # passed every test here and was a 500 on the real site — deleting an
    # assignment was exactly that. So the tests' database refuses it too.
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _foreign_keys_on(conn, _record):
        conn.execute("PRAGMA foreign_keys=ON")
gamestore.create_all(engine)

# ---------------------------------------------------------------- the app


class PackedRequest(Flask.request_class):
    """Read a JSON body sent as {"_packed": base64(json)}.

    Render's firewall refuses request bodies that look like attacks, and a
    project is full of code: FlaskIDE's notes full of Flask routes were
    turned away before reaching the app — nothing in its logs — and the
    editor said only that it couldn't reach the server. GameIDE's client
    (frontend/src/store/api.ts) packs every JSON body from the start, so the
    firewall sees base64. A plain body is still read, for tests and curl.
    """

    def get_json(self, force=False, silent=False, cache=True):
        data = super().get_json(force=force, silent=silent, cache=cache)
        if isinstance(data, dict) and set(data) == {"_packed"}:
            try:
                data = json.loads(base64.b64decode(data["_packed"], validate=True).decode("utf-8"))
            except (ValueError, TypeError):
                if not silent:
                    raise BadRequest("That request could not be read.")
                data = None
        return data


app = Flask(__name__, static_folder=None)
app.request_class = PackedRequest
# Signed session cookies. Generated if unset so the app still boots locally,
# but then every restart signs everyone out — set it on the server.
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    # Lax, not Strict: the sign-in redirect arrives from Google and must
    # carry the cookie, or sign-in silently fails.
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=bool(os.environ.get("DATABASE_URL")),
    # The largest body is a sound (projects are checked against their own,
    # smaller limit in save_project); a little over, for the request's own bytes.
    MAX_CONTENT_LENGTH=gamestore.MAX_SOUND_BYTES + 1_000_000,
)


def _scheme():
    """Render ends TLS in front of us, so url_for sees plain http."""
    return "https" if os.environ.get("DATABASE_URL") else "http"


def _db():
    return SessionLocal()


def current_user(db):
    uid = session.get("uid")
    return db.query(accounts.User).filter_by(id=uid).first() if uid else None


def err(message, status):
    """Every API error is a sentence the editor can show as it is."""
    return jsonify(error=message), status


def fail(message, status):
    """err(), from inside a helper: stops the request there."""
    abort(make_response(jsonify(error=message), status))


# ---------------------------------------------------------------- headers

# Cross-origin isolation: without both headers the browser gives the page no
# SharedArrayBuffer, and the editor can no longer stop a student's endless
# loop at its line — it falls back to restarting Python, with no line to
# show. Nothing fails loudly when these go missing, so they go on every
# response. "credentialless" rather than "require-corp", so pictures from
# elsewhere (Google profile photos) still load.
ISOLATION = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "credentialless",
}


@app.after_request
def _headers(response):
    for k, v in ISOLATION.items():
        response.headers.setdefault(k, v)
    # A signed-in page is never kept in the browser's cache: Chrome reopening
    # yesterday's tabs would show them without asking whether this student is
    # still signed in.
    if session.get("uid") and response.mimetype == "text/html":
        response.headers["Cache-Control"] = "no-store"
    return response


# ---------------------------------------------------------------- signing in
# As in PyIDE. Entirely optional: with no Google credentials `oauth` stays
# None, /api/me says sign-in is off, and the editor keeps projects in the
# browser.


def _announce_login_settings():
    if not accounts.login_configured():
        print("[gameide] Google sign-in: OFF (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable)")
        return
    domains = accounts.allowed_domains()
    print("[gameide] Google sign-in: ON — %s" % (
        ("only " + ", ".join("@" + d for d in domains)) if domains
        else "any Google account (ALLOWED_EMAIL_DOMAINS is empty)"))


_announce_login_settings()

oauth = None
if accounts.login_configured():
    from authlib.integrations.flask_client import OAuth

    oauth = OAuth(app)
    oauth.register(
        name="google",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

_redirect_logged = [False]


def _problem(reason, status):
    """A plain page for a sign-in that went wrong: a sentence and a way back."""
    body = (
        "<!doctype html><meta charset=utf-8><title>Sign-in problem</title>"
        "<body style='font:16px system-ui;padding:40px;max-width:560px'>"
        f"<h2>That didn't work</h2><p>{reason}</p><p><a href='/'>Back to GameIDE</a></p>"
    )
    return Response(body, status=status, mimetype="text/html")


def _safe_next(nxt: str) -> str:
    """Only somewhere on this site — never an address that leads off it."""
    return nxt if nxt.startswith("/") and not nxt.startswith("//") else ""


@app.get("/login")
def login():
    if not oauth:
        abort(404)
    session["after_login"] = _safe_next(request.args.get("next", ""))
    target = url_for("auth_callback", _external=True, _scheme=_scheme())
    # Google's redirect_uri_mismatch page never says which address it
    # objected to; this is the one to paste into the Cloud Console.
    if not _redirect_logged[0]:
        _redirect_logged[0] = True
        print(f"[{APP_NAME}] redirect URI sent to Google: {target}", flush=True)
    try:
        # select_account: always offer the account chooser, or a teacher's
        # laptop signs in as whichever personal Gmail is the default.
        return oauth.google.authorize_redirect(target, prompt="select_account")
    except Exception:
        return _problem("Couldn't reach Google just now. Try again in a moment.", 503)


def _sign_in(db, sub, email, info):
    """The users row for this Google account, made or updated, and the session."""
    user = db.query(accounts.User).filter_by(google_sub=sub).first()
    if user is None:
        user = accounts.User(google_sub=sub, email=email, name=info.get("name") or "")
        db.add(user)
    else:
        user.email = email  # a school can rename a mailbox
        user.name = info.get("name") or user.name
        user.last_seen = accounts.now()
    user.first_name = (info.get("given_name") or user.first_name or "")[:80]
    user.last_name = (info.get("family_name") or user.last_name or "")[:80]
    db.commit()
    session.clear()
    session["uid"] = user.id
    session["teacher"] = accounts.is_teacher(user.email)
    session["act"] = int(time.time())
    return user


@app.get("/auth/callback")
def auth_callback():
    if not oauth:
        abort(404)
    try:
        token = oauth.google.authorize_access_token()
    except Exception:
        return _problem("That sign-in didn't complete.", 400)
    info = token.get("userinfo") or {}
    sub = info.get("sub")
    email = (info.get("email") or "").strip()
    # Checked here, from the verified token — never from the browser.
    if not sub or not email or not info.get("email_verified"):
        return _problem("Google didn't confirm that address.", 400)
    if not accounts.email_allowed(email):
        wanted = " or ".join("@" + d for d in accounts.allowed_domains())
        return _problem(f"You signed in as {email}, but this site only accepts {wanted} addresses.", 403)
    nxt = session.get("after_login", "")
    db = _db()
    try:
        _sign_in(db, sub, email, info)
    finally:
        db.close()
    return redirect(nxt or "/")


@app.get("/logout")
def logout():
    session.clear()
    return redirect(_safe_next(request.args.get("next", "")) or "/")


# For trying the signed-in editor, and for its tests, without Google: only
# when GAMEIDE_DEV_LOGIN=1 and never with a DATABASE_URL (which only the
# real server has). Both, so a stray variable on Render can't open it.
DEV_LOGIN = os.environ.get("GAMEIDE_DEV_LOGIN") == "1" and not os.environ.get("DATABASE_URL")


@app.get("/dev/login")
def dev_login():
    if not DEV_LOGIN:
        abort(404)
    email = request.args.get("email", "student@example.com")
    db = _db()
    try:
        _sign_in(db, "dev-" + email, email, {"name": email.split("@")[0].title()})
    finally:
        db.close()
    return redirect(_safe_next(request.args.get("next", "")) or "/")


# ---------------------------------------------------------------- idle students
# As in PyIDE: a student is signed out after two idle hours, because school
# laptops are shared and Chrome reopens yesterday's tabs. Teachers never are.
# Polls (any GET to /api/) are not activity, or an open tab would keep
# itself signed in forever; a save or the page's beat (POSTs) is.

STUDENT_IDLE_SECONDS = 2 * 60 * 60
#: Working time, toward a run's XP (rewards.xp_run), counts each gap between
#: bits of activity for at most this — a little over the page's 5-minute
#: beat — so a student who went to lunch comes back with one step's worth,
#: not the hour they were away. As in PyIDE.
BUSY_STEP_SECONDS = 6 * 60


def _counts_as_activity() -> bool:
    return not (request.method == "GET" and request.path.startswith("/api/"))


@app.before_request
def _sign_out_idle_student():
    uid = session.get("uid")
    if not uid or session.get("teacher"):
        return
    t = int(time.time())
    last = session.get("act")
    if last is not None and t - last > STUDENT_IDLE_SECONDS:
        session.clear()
        # Opening the page: sign in again and come back, rather than be shown
        # it signed out and carry on saving into the browser without noticing.
        if (request.method == "GET" and not request.path.startswith("/api/")
                and request.headers.get("Sec-Fetch-Dest", "document") == "document"
                and "text/html" in request.headers.get("Accept", "") and oauth):
            return redirect(url_for("login", next=request.full_path.rstrip("?")))
        return
    if last is None or (_counts_as_activity() and t - last >= 60):
        if last is not None:
            session["busy"] = session.get("busy", 0) + min(t - last, BUSY_STEP_SECONDS)
        session["act"] = t


@app.get("/api/alive")
def alive_check():
    """Still signed in? A GET, so asking is not activity."""
    return jsonify(signed_in=bool(session.get("uid")))


@app.post("/api/alive")
def alive():
    """The page's "still here" while a student works. Being a POST, it has
    already moved the idle clock by the time it gets here."""
    return jsonify(signed_in=bool(session.get("uid")))


@app.get("/api/me")
def me():
    db = _db()
    try:
        user = current_user(db)
        return jsonify(
            login_enabled=bool(oauth) or DEV_LOGIN,
            dev_login=DEV_LOGIN,
            user=None if not user else {
                "id": user.id,
                "name": user.display_name(),
                "email": user.email,
                "teacher": accounts.is_teacher(user.email),
                "admin": publishing.is_admin(user),
            },
            idle_seconds=0 if (not user or accounts.is_teacher(user.email)) else STUDENT_IDLE_SECONDS,
        )
    finally:
        db.close()


# ---------------------------------------------------------------- projects


def _need_user(db):
    user = current_user(db)
    if user is None:
        fail("You're signed out. Sign in again to save to your account.", 401)
    return user


def _own_project(db, user, slug, include_deleted=False):
    p = db.query(GameProject).filter_by(slug=slug).first()
    if p is None or (p.deleted_at is not None and not include_deleted):
        fail("There is no project here.", 404)
    if p.owner_id != user.id:
        fail("That project belongs to someone else.", 403)
    return p


def _readable_project(db, user, slug):
    """A project this person may READ: their own, or — for a teacher — a
    student's work for one of their assignments (classes.can_read). Every
    write still goes through _own_project, so reading never becomes a way
    to change someone's game."""
    p = db.query(GameProject).filter_by(slug=slug).first()
    if p is None or (p.deleted_at is not None and p.owner_id == user.id):
        fail("There is no project here.", 404)
    if not classes.can_read(db, user, p):
        fail("That project belongs to someone else.", 403)
    return p


def _mb(n):
    return f"{n / 1_000_000:.1f} MB"


def _user_bytes(db, user_id) -> int:
    projects = db.query(func.coalesce(func.sum(GameProject.size), 0)).filter(
        GameProject.owner_id == user_id, GameProject.deleted_at.is_(None)).scalar()
    assets = (db.query(func.coalesce(func.sum(GameAsset.size), 0))
              .join(GameProject, GameAsset.project_id == GameProject.id)
              .filter(GameProject.owner_id == user_id, GameProject.deleted_at.is_(None)).scalar())
    return int(projects) + int(assets)


def _snapshot(db, p, kind, label=""):
    db.add(GameVersion(project_id=p.id, version=p.version, kind=kind, label=label[:200], data=p.data, size=p.size))


def _prune(db, p):
    """Keep the newest automatic snapshots (and hand-made ones) up to their limits."""
    for kind, keep in (("auto", gamestore.KEEP_AUTO_SNAPSHOTS), ("manual", gamestore.KEEP_MANUAL_SNAPSHOTS)):
        old = (db.query(GameVersion.id).filter_by(project_id=p.id, kind=kind)
               .order_by(GameVersion.created_at.desc(), GameVersion.id.desc()).offset(keep).all())
        if old:
            db.query(GameVersion).filter(GameVersion.id.in_([o.id for o in old])).delete(synchronize_session=False)


def _summary(p, published=None):
    """One game on the "My games" page: its name, size, picture and whether it's published."""
    return {"id": p.slug, "name": p.name, "modified": p.updated_at.isoformat() + "Z" if p.updated_at.tzinfo is None
            else p.updated_at.isoformat(), "version": p.version, "size": p.size, "icon": gamestore.icon_asset(p.data),
            "published": published, "tutorial": gamestore.tutorial_of(p.data)}


@app.get("/api/projects")
def list_projects():
    db = _db()
    try:
        user = _need_user(db)
        # Not the starters of the teacher's assignments: those are opened from
        # the class's page, and here they'd look like stray copies.
        starters = classes.starter_ids(db, user.id)
        rows = [p for p in (db.query(GameProject).filter_by(owner_id=user.id).filter(GameProject.deleted_at.is_(None))
                            .order_by(GameProject.updated_at.desc()).all()) if p.id not in starters]
        pubs = {g.project_id: ("taken down" if g.taken_down else g.visibility)
                for g in db.query(gamestore.Published).filter(gamestore.Published.project_id.in_([p.id for p in rows] or [-1])).all()}
        return jsonify(projects=[_summary(p, pubs.get(p.id)) for p in rows], used=_user_bytes(db, user.id),
                       limit=gamestore.MAX_USER_BYTES)
    finally:
        db.close()


@app.get("/api/projects/<slug>")
def get_project(slug):
    db = _db()
    try:
        user = _need_user(db)
        p = _readable_project(db, user, slug)
        return jsonify(data=json.loads(p.data), version=p.version, readOnly=p.owner_id != user.id)
    finally:
        db.close()


@app.put("/api/projects/<slug>")
def save_project(slug):
    """Save the whole project. Body: {data: <project>, base: <version it was
    loaded at, or 0 for new>}. Answers {version, replaced}."""
    db = _db()
    try:
        user = _need_user(db)
        body = request.get_json(silent=True) or {}
        data = body.get("data")
        base = body.get("base")
        if not isinstance(data, dict) or data.get("format") != "gameide-project" or data.get("id") != slug:
            return err("That isn't a GameIDE project.", 400)
        text = json.dumps(data, separators=(",", ":"))
        size = len(text.encode("utf-8"))
        if size > gamestore.MAX_PROJECT_BYTES:
            return err(f"This project is too big to save ({_mb(size)}; the limit is "
                       f"{_mb(gamestore.MAX_PROJECT_BYTES)}). Big room layouts are the usual cause.", 413)
        name = str(data.get("name") or "Untitled")[:200]
        p = db.query(GameProject).filter_by(slug=slug).first()
        replaced = False
        if p is None:
            count = db.query(func.count(GameProject.id)).filter_by(owner_id=user.id).filter(
                GameProject.deleted_at.is_(None)).scalar()
            if count >= gamestore.MAX_PROJECTS_PER_USER:
                return err(f"You have {count} games, which is the most one account can keep. "
                           "Delete some you don't need.", 413)
            p = GameProject(slug=slug, owner_id=user.id, name=name, data=text, size=size, version=1,
                            schema_version=int(data.get("schemaVersion") or 1))
            db.add(p)
            db.flush()
        else:
            if p.owner_id != user.id:
                # The id is someone else's: the browser makes a new one and tries again.
                return err("That project id is taken.", 409)
            if p.deleted_at is not None:
                p.deleted_at = None  # saving a deleted project from an open tab brings it back
            if _user_bytes(db, user.id) - p.size + size > gamestore.MAX_USER_BYTES:
                return err(f"Your account is full ({_mb(gamestore.MAX_USER_BYTES)}). "
                           "Delete games you don't need, then save again.", 413)
            if base != p.version:
                # Another tab or computer saved since this one loaded. Keep
                # what it saved before replacing it: nothing is lost, and
                # History shows where it went.
                _snapshot(db, p, "replaced", "Replaced by a save from another tab or computer")
                replaced = True
            elif text != p.data:
                last_auto = (db.query(func.max(GameVersion.created_at))
                             .filter_by(project_id=p.id).filter(GameVersion.kind.in_(["auto", "manual"])).scalar())
                stamp = accounts.now()
                if last_auto is None or (stamp.replace(tzinfo=None) - (last_auto.replace(tzinfo=None))) > timedelta(
                        seconds=gamestore.AUTO_SNAPSHOT_SECONDS):
                    _snapshot(db, p, "auto")
            if text != p.data or replaced:
                p.data = text
                p.size = size
                p.name = name
                p.schema_version = int(data.get("schemaVersion") or 1)
                p.version += 1
                p.updated_at = accounts.now()
        _prune(db, p)
        db.commit()
        return jsonify(version=p.version, replaced=replaced)
    finally:
        db.close()


@app.delete("/api/projects/<slug>")
def delete_project(slug):
    db = _db()
    try:
        user = _need_user(db)
        p = _own_project(db, user, slug)
        p.deleted_at = accounts.now()
        db.commit()
        return jsonify(ok=True)
    finally:
        db.close()


# ---------------------------------------------------------------- assets


@app.put("/api/projects/<slug>/assets/<asset_id>")
def put_asset(slug, asset_id):
    """The raw bytes of one picture, sound or font. An asset never changes,
    so sending the same id again (a retry after a dropped connection) is
    accepted, not an error — but it can't replace different bytes already
    stored. What a file is comes from its first bytes, never its name."""
    db = _db()
    try:
        user = _need_user(db)
        p = _own_project(db, user, slug)
        if not (1 <= len(asset_id) <= 32 and asset_id.isalnum()):
            return err("That isn't an asset id.", 400)
        data = request.get_data(cache=False)
        kind, limit = gamestore.sniff_asset(data)
        if kind is None:
            return err("That file isn't a picture (PNG, JPEG, GIF, WebP), a sound (MP3, OGG, WAV) or a font (TTF, OTF, WOFF).", 415)
        what = "sound" if kind.startswith("audio/") else "font" if kind.startswith("font/") else "picture"
        if len(data) > limit:
            return err(f"That {what} is too big ({_mb(len(data))}; the limit is {_mb(limit)}).", 413)
        existing = db.query(GameAsset).filter_by(project_id=p.id, asset_id=asset_id).first()
        if existing:
            return jsonify(ok=True) if existing.data == data else err("That asset id is already used.", 409)
        used = db.query(func.coalesce(func.sum(GameAsset.size), 0)).filter_by(project_id=p.id).scalar()
        if used + len(data) > gamestore.MAX_PROJECT_ASSET_BYTES:
            return err(f"This game's pictures, sounds and fonts add up to more than {_mb(gamestore.MAX_PROJECT_ASSET_BYTES)}.", 413)
        if _user_bytes(db, user.id) + len(data) > gamestore.MAX_USER_BYTES:
            return err(f"Your account is full ({_mb(gamestore.MAX_USER_BYTES)}).", 413)
        db.add(GameAsset(project_id=p.id, asset_id=asset_id, content_type=kind, data=data, size=len(data)))
        db.commit()
        return jsonify(ok=True), 201
    finally:
        db.close()


@app.get("/api/projects/<slug>/assets/<asset_id>")
def get_asset(slug, asset_id):
    db = _db()
    try:
        user = _need_user(db)
        p = _readable_project(db, user, slug)
        a = db.query(GameAsset).filter_by(project_id=p.id, asset_id=asset_id).first()
        if a is None:
            return err("That asset isn't here.", 404)
        r = Response(a.data, mimetype=a.content_type)
        # Private: it is the student's. Immutable: an asset id never changes.
        r.headers["Cache-Control"] = "private, max-age=31536000, immutable"
        return r
    finally:
        db.close()


# ---------------------------------------------------------------- history


def _version_row(v):
    return {"id": v.id, "version": v.version, "kind": v.kind, "label": v.label, "size": v.size,
            "created": v.created_at.isoformat() + ("Z" if v.created_at.tzinfo is None else "")}


@app.get("/api/projects/<slug>/versions")
def list_versions(slug):
    db = _db()
    try:
        user = _need_user(db)
        p = _own_project(db, user, slug)
        rows = (db.query(GameVersion).filter_by(project_id=p.id)
                .order_by(GameVersion.created_at.desc(), GameVersion.id.desc()).all())
        return jsonify(versions=[_version_row(v) for v in rows])
    finally:
        db.close()


@app.post("/api/projects/<slug>/versions")
def make_version(slug):
    """Save a version: a snapshot of the project as it is now, kept for good."""
    db = _db()
    try:
        user = _need_user(db)
        p = _own_project(db, user, slug)
        label = str((request.get_json(silent=True) or {}).get("label") or "")
        _snapshot(db, p, "manual", label)
        _prune(db, p)
        db.commit()
        return jsonify(ok=True), 201
    finally:
        db.close()


@app.get("/api/projects/<slug>/versions/<int:vid>")
def get_version(slug, vid):
    db = _db()
    try:
        user = _need_user(db)
        p = _readable_project(db, user, slug)
        v = db.query(GameVersion).filter_by(project_id=p.id, id=vid).first()
        if v is None:
            return err("That version isn't here.", 404)
        return jsonify(data=json.loads(v.data), **_version_row(v))
    finally:
        db.close()


@app.post("/api/projects/<slug>/versions/<int:vid>/restore")
def restore_version(slug, vid):
    """Go back to an older version. What is there now is kept first, so a
    restore is never a step that can't be taken back."""
    db = _db()
    try:
        user = _need_user(db)
        p = _own_project(db, user, slug)
        v = db.query(GameVersion).filter_by(project_id=p.id, id=vid).first()
        if v is None:
            return err("That version isn't here.", 404)
        _snapshot(db, p, "restore", f"Before going back to the version from {v.created_at:%b %d %H:%M}")
        data = json.loads(v.data)
        data["id"] = p.slug  # a snapshot is always of this project, but be sure
        text = json.dumps(data, separators=(",", ":"))
        p.data, p.size, p.name = text, len(text.encode("utf-8")), str(data.get("name") or p.name)[:200]
        p.version += 1
        p.updated_at = accounts.now()
        _prune(db, p)
        db.commit()
        return jsonify(data=data, version=p.version)
    finally:
        db.close()


# ---------------------------------------------------------------- the editor itself


@app.get("/healthz")
def healthz():
    return "ok"


@app.get("/")
def index():
    if not (DIST / "index.html").exists():
        return Response("The editor hasn't been built. Run `npm run build` in frontend/.", 503, mimetype="text/plain")
    r = send_from_directory(DIST, "index.html")
    # Never cached: it names the hashed bundles, and a stale one would load
    # yesterday's editor after a deploy.
    r.headers["Cache-Control"] = "no-cache"
    return r


@app.get("/assets/<path:name>")
def built_assets(name):
    r = send_from_directory(DIST / "assets", name)
    r.headers["Cache-Control"] = "public, max-age=31536000, immutable"  # names are content hashes
    return r


@app.get("/pyodide/<path:name>")
def pyodide_files(name):
    r = send_from_directory(DIST / "pyodide", name, mimetype="application/wasm" if name.endswith(".wasm") else None)
    # Not hashed, but they change only when the Pyodide version does; a day's
    # cache keeps Play fast without pinning an old Python for long.
    r.headers["Cache-Control"] = "public, max-age=86400"
    return r


@app.get("/play/<slug>")
def play_page(slug):
    """A published game's page: the player (play.html), with <base href="/">
    so its relative paths (built for exported games, which may sit in any
    folder) resolve from the site's root here, and the game's title for
    links shared in chats. Whether this viewer may play it is the API's to
    say (publishing._viewable); the page itself gives nothing away."""
    if not re.fullmatch(r"[\w-]{1,16}", slug):
        abort(404)
    path = DIST / "play.html"
    if not path.exists():
        return Response("The player hasn't been built. Run `npm run build` in frontend/.", 503, mimetype="text/plain")
    html = path.read_text()
    title = "A GameIDE game"
    db = _db()
    try:
        pub = db.query(gamestore.Published).filter_by(slug=slug).first()
        if pub and pub.visibility != "class" and not pub.taken_down:
            title = f"{pub.title} — GameIDE"
    finally:
        db.close()
    head = (f'<base href="/">\n    <link rel="manifest" href="/play/{slug}/manifest.webmanifest">\n'
            f'    <meta property="og:title" content="{escape(title)}">')
    html = html.replace("<head>", "<head>\n    " + head, 1).replace("<title>GameIDE game</title>", f"<title>{escape(title)}</title>", 1)
    r = Response(html, mimetype="text/html")
    r.headers["Cache-Control"] = "no-cache"
    return r


@app.get("/play/<slug>/manifest.webmanifest")
def play_manifest(slug):
    """What makes a published game installable as an app (Install on its
    page): its own window and icon. Not offline: the game's worker loads
    Python past any service worker (tried in Chrome; its requests never
    reach one), so it needs the network to start — see PROGRESS.md."""
    db = _db()
    try:
        pub = db.query(gamestore.Published).filter_by(slug=slug).first()
        if pub is None or publishing._viewable(db, pub, current_user(db)):
            abort(404)
        title = pub.title
    finally:
        db.close()
    manifest = {
        "name": title,
        "short_name": title[:12],
        "start_url": f"/play/{slug}",
        "scope": f"/play/{slug}",
        "display": "standalone",
        "background_color": "#000000",
        "theme_color": "#1b2433",
        "icons": [{"src": f"/icons/icon-{n}.png", "sizes": f"{n}x{n}", "type": "image/png"} for n in (192, 512)],
    }
    r = jsonify(manifest)
    r.mimetype = "application/manifest+json"
    return r


@app.get("/home/<path:name>")
def home_pictures(name):
    """The front page's pictures (screenshots of GameIDE, public/home/)."""
    r = send_from_directory(DIST / "home", name)
    r.headers["Cache-Control"] = "public, max-age=86400"
    return r


@app.get("/favicon.svg")
@app.get("/favicon-32.png")
@app.get("/apple-touch-icon.png")
def favicon():
    """GameIDE's mark (frontend/scripts/make_logo.py)."""
    r = send_from_directory(DIST, request.path.lstrip("/"))
    r.headers["Cache-Control"] = "public, max-age=86400"
    return r


@app.get("/tutorials/<path:name>")
def tutorial_files(name):
    """The built-in tutorials (public/tutorials/): their list and markdown. The
    editor fetches them itself — on a static host as much as here."""
    r = send_from_directory(DIST / "tutorials", name)
    r.headers["Cache-Control"] = "no-cache"
    return r


@app.get("/library/<path:name>")
def art_library(name):
    """The free art library's pictures (public/library/kenney/, CC0; src/library/library.ts).
    Without this route the editor's Free art library found none of its
    pictures on the real site — only the test server, which serves every
    public/ file itself, ever showed them."""
    r = send_from_directory(DIST / "library", name)
    r.headers["Cache-Control"] = "public, max-age=86400"
    return r


@app.get("/starters/<path:name>")
def starter_pictures(name):
    """The Starter Projects' pictures (public/starters/; store/starterProjects.ts).
    Like /library: without this route, Start on those tutorials did nothing on
    the real site (the starter's pictures 404'd), while the test server, which
    serves every public/ file, showed it working."""
    r = send_from_directory(DIST / "starters", name)
    r.headers["Cache-Control"] = "public, max-age=86400"
    return r


@app.get("/avatars/<path:name>")
def avatar_pictures(name):
    """The avatars a student picks from (xp.AVATARS; public/avatars/, the same pictures as PyIDE's)."""
    r = send_from_directory(DIST / "avatars", name)
    r.headers["Cache-Control"] = "public, max-age=86400"
    return r


@app.get("/icons/<path:name>")
def icons(name):
    r = send_from_directory(DIST / "icons", name)
    r.headers["Cache-Control"] = "public, max-age=86400"
    return r


@app.get("/play.html")
@app.get("/player-files.json")
def player_files():
    """What the HTML5 export copies (store/html5.ts): the player page and its file list."""
    name = request.path.lstrip("/")
    r = send_from_directory(DIST, name)
    r.headers["Cache-Control"] = "no-cache"
    return r


@app.get("/blockly-media/<path:name>")
def blockly_media(name):
    # The blocks editor's cursors, icons and sounds (copied in by the build);
    # see vite.config.ts for why they aren't fetched from Google.
    r = send_from_directory(DIST / "blockly-media", name)
    r.headers["Cache-Control"] = "public, max-age=86400"
    return r


# Publishing, playing, Explore and moderation (publishing.py).
publishing.init(app, _db, current_user)
# Classes, assignments, turning in, comments and Google Classroom (classes.py).
classes.init(app, _db, current_user, _scheme, _problem)
# XP, levels, leaderboards, avatars, the token shop and random events (rewards.py).
rewards.init(app, _db, current_user)
# An assignment's notes, its questions and its tests (notes.py).
notes.init(app, _db, current_user)
# Tutorials: built-in and teachers' own, shared, and their XP (tutorials.py).
tutorials.init(app, _db, current_user, lambda: DIST)


# The tutorial library (library.py, the same file as PyIDE's, WebIDE's and
# FlaskIDE's): every tutorial a teacher has, linked to any number of
# assignments, and the only place their text is edited. Its page here is
# React's (#/library); its editor is PresMaker (templates/presmaker.html,
# made by tools/sync_presmaker.py), drawn with PyIDE's notes.js.

def _write_notes(db, a, text):
    files = a.file_map()
    if text.strip():
        files[grades.NOTES] = text
    else:
        files.pop(grades.NOTES, None)
    a.files = json.dumps(files)
    a.updated_at = accounts.now()
    db.commit()
    notes.store_quiz_keys(db, a, text)


_BUILTINS = {}


def _known(text):
    """Notes that ARE a built-in tutorial word for word (an assignment made
    from one): {origin, title}, so the library links it to the teacher's row
    for that built-in rather than a copy of its text."""
    d = tutorials._builtin_dir()
    stamp = sum(f.stat().st_mtime for f in d.glob("*.md")) if d.exists() else 0
    if _BUILTINS.get("stamp") != stamp:
        _BUILTINS.clear()
        _BUILTINS["stamp"] = stamp
        for f in d.glob("*.md"):
            md = f.read_text(encoding="utf-8")
            # "(copy)": the teacher's row sits beside the built-in in the library,
            # which is listed as well, and the two mustn't look like one.
            _BUILTINS[md] = {"origin": "builtin:" + f.stem, "title": tutorials.meta(md)["title"] + " (copy)"}
    return _BUILTINS.get(text)


library.init(
    app,
    app_name=APP_NAME,
    session=_db,
    current_user=current_user,
    is_teacher=lambda user: accounts.is_teacher(user.email),
    is_admin=tutorials._is_admin,
    notes_of=grades.notes_of,
    write_notes=_write_notes,
    known=_known,
    visibilities=tutorials.VISIBILITIES,
    page_url="/#/library",
    assignment_url=lambda a: "/#/assignment/" + a.slug,
    page=lambda db, user: {"brand": "GameIDE", "logo": "🎮", "ns": "PyIDE", "theme_key": "gameide.theme",
                           "home_url": "/#/classes", "help_url": "/#/help", "max_tutorial": library.MAX_TUTORIAL,
                           # Its tutorials gate steps with ```check lines (GameIDE's own words),
                           # and point at the editor with highlight: lines.
                           "pm_tests": "lines", "pm_tests_fence": "check", "pm_adapter": "gameide", "no_pictures": True,
                           "pm_test_examples": ["object Player exists", "Player has event step", "Player.step uses move_and_collide",
                                                "room Room1 has at least 5 Coin", "game runs 2 seconds without errors",
                                                "after 1 second holding right, Player.x increased"]},
)


@app.get("/static/<path:filename>", endpoint="static")
def static_files(filename):
    """The tutorial editor's files (PresMaker, and PyIDE's notes.js it draws
    with), from the build's static/ (frontend/public/static)."""
    r = send_from_directory(DIST / "static", filename)
    r.headers["Cache-Control"] = "public, max-age=3600"
    return r


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", "5001")), debug=True)
