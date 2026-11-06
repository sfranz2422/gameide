"""
GameIDE's own tables, in the database it shares with PyIDE, WebIDE and
FlaskIDE.

They are declared on `accounts.Base`, so `accounts.create_all()` makes them
along with the shared tables — but only in this app, because only this app
imports this module. That is the point: accounts.py, which must stay
byte-identical in all four repos, needed no change for GameIDE's projects,
and the other three apps never see these tables. Every name starts with
`gameide_` so nothing can collide with theirs.

    gameide_projects   one row per project: the JSON, and who owns it
    gameide_assets     its pictures (and, later, sounds), as bytes
    gameide_versions   snapshots of the JSON, for version history

Pictures live in Postgres rather than on a disk for the reason PyIDE's
`images` table does: Render's disk is wiped on every deploy, and a database
row is backed up with everything else.
"""
import json

from sqlalchemy import BigInteger, Column, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint

import accounts
from accounts import Base, now

# ---------------------------------------------------------------- limits
# Generous for a class game, small enough that one student can't fill the
# shared database. The error each produces names the limit in words.

MAX_PROJECT_BYTES = 2_000_000          # the JSON: objects, events, rooms
MAX_ASSET_BYTES = 2_000_000            # one picture or font
MAX_SOUND_BYTES = 8_000_000            # one sound: a few minutes of music as MP3
MAX_PROJECT_ASSET_BYTES = 40_000_000   # all of one project's pictures, sounds and fonts
MAX_USER_BYTES = 200_000_000           # everything one person stores
MAX_PROJECTS_PER_USER = 300
AUTO_SNAPSHOT_SECONDS = 10 * 60        # an automatic version at most this often
KEEP_AUTO_SNAPSHOTS = 40               # per project; ones made by hand are kept
KEEP_MANUAL_SNAPSHOTS = 100

# Real image files only, judged by their first bytes — never by the name or
# the type the browser claimed, either of which a student can make up.
IMAGE_MAGIC = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


def sniff_image(data: bytes):
    """The image type these bytes really are, or None."""
    for magic, kind in IMAGE_MAGIC:
        if data.startswith(magic):
            return kind
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def sniff_sound(data: bytes):
    """The audio type these bytes really are (MP3, OGG, WAV), or None."""
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio/wav"
    if data.startswith(b"OggS"):
        return "audio/ogg"
    # MP3: an ID3 tag first, or straight into a frame (11 sync bits set).
    if data.startswith(b"ID3") or (len(data) > 1 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0):
        return "audio/mpeg"
    return None


FONT_MAGIC = [
    (b"\x00\x01\x00\x00", "font/ttf"),
    (b"true", "font/ttf"),
    (b"OTTO", "font/otf"),
    (b"wOFF", "font/woff"),
    (b"wOF2", "font/woff2"),
]


def sniff_font(data: bytes):
    for magic, kind in FONT_MAGIC:
        if data.startswith(magic):
            return kind
    return None


def sniff_asset(data: bytes):
    """What an uploaded asset really is — a picture, a sound or a font — and its size limit; (None, 0) if none of them."""
    kind = sniff_image(data) or sniff_font(data)
    if kind:
        return kind, MAX_ASSET_BYTES
    kind = sniff_sound(data)
    return (kind, MAX_SOUND_BYTES) if kind else (None, 0)


class GameProject(Base):
    """A student's (or teacher's) game.

    `slug` is the project's own id — the one inside its JSON, made by the
    browser — so a project made while offline, or signed out, keeps its id
    when it reaches the server. Ids are random and long, but a slug already
    owned by someone else is refused (the browser then picks a new one):
    knowing a project's id must never be a way to write to it.

    `version` goes up by one on every save. A save says which version it
    started from; if that is not the current one, another tab or computer
    saved in between, and the row being replaced is kept as a snapshot
    before it is overwritten — so two tabs can never quietly destroy each
    other's work, only make history longer.
    """
    __tablename__ = "gameide_projects"

    id = Column(Integer, primary_key=True)
    slug = Column(String(32), unique=True, index=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    name = Column(String(200), nullable=False, default="")
    data = Column(Text, nullable=False)
    schema_version = Column(Integer, nullable=False, default=1)
    version = Column(Integer, nullable=False, default=1)
    size = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=now)
    updated_at = Column(DateTime, nullable=False, default=now)
    #: Set instead of deleting: a student who deletes the wrong game can be
    #: helped. Every query for "their projects" leaves these out.
    deleted_at = Column(DateTime, nullable=True)


class GameAsset(Base):
    """One picture belonging to a project. Assets never change once
    uploaded (a new picture gets a new id), so they are served with a
    year's cache and an asset id can't be overwritten."""
    __tablename__ = "gameide_assets"
    __table_args__ = (UniqueConstraint("project_id", "asset_id", name="uq_gameide_asset"),)

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("gameide_projects.id"), index=True, nullable=False)
    asset_id = Column(String(32), nullable=False)
    content_type = Column(String(40), nullable=False)
    data = Column(LargeBinary, nullable=False)
    size = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=now)


class GameVersion(Base):
    """A snapshot of a project's JSON.

    kind: "manual" (Save a version), "auto" (every AUTO_SNAPSHOT_SECONDS of
    saving), "replaced" (another tab's save overwrote it), "restore" (made
    just before going back to an older version). Only "auto" ones are pruned.
    """
    __tablename__ = "gameide_versions"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("gameide_projects.id"), index=True, nullable=False)
    version = Column(Integer, nullable=False)
    kind = Column(String(16), nullable=False, default="auto")
    label = Column(String(200), nullable=False, default="")
    data = Column(Text, nullable=False)
    size = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=now)


# ---------------------------------------------------------------- publishing

TAGS = ["platformer", "puzzle", "shooter", "adventure", "racing", "arcade", "story", "sport", "music", "other"]
MAX_PUBLISHED_PER_USER = 50
MAX_THUMBNAIL_BYTES = 300_000


class Published(Base):
    """A game published for others to play, at /play/<slug>.

    A snapshot: the project's JSON and copies of its files as they were when
    published, so a student can keep working without the version people are
    playing changing under them (Publish again updates it). One per project.

    visibility: "unlisted" (anyone with the link), "class" (members of
    class_id, its teacher, admins) or "public" (on Explore, once `status` is
    "approved"; until then it plays like unlisted). `taken_down` is a teacher
    or admin removing it: then only its owner and moderators can open it.
    """
    __tablename__ = "gameide_published"

    id = Column(Integer, primary_key=True)
    slug = Column(String(16), unique=True, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("gameide_projects.id"), unique=True, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(String(80), nullable=False)
    description = Column(Text, nullable=False, default="")
    #: What the page shows as the author: a first name or a name they chose — never an email.
    author = Column(String(30), nullable=False)
    tags = Column(String(200), nullable=False, default="")
    allow_remix = Column(Integer, nullable=False, default=1)
    #: A showcase game: play only (no remix), for signed-in people, and it stops
    #: for a Python question every few minutes (pycheck.py). Only a teacher can set it.
    showcase = Column(Integer, nullable=False, default=0)
    visibility = Column(String(12), nullable=False, default="unlisted")
    class_id = Column(Integer, nullable=True, index=True)
    #: For public games: "pending", "approved" or "rejected". "" otherwise.
    status = Column(String(12), nullable=False, default="")
    featured = Column(Integer, nullable=False, default=0)
    taken_down = Column(Integer, nullable=False, default=0)
    takedown_note = Column(String(300), nullable=False, default="")
    plays = Column(Integer, nullable=False, default=0)
    likes = Column(Integer, nullable=False, default=0)
    data = Column(Text, nullable=False)
    thumbnail = Column(LargeBinary, nullable=True)
    #: The published game this was remixed from (its slug, title and author, kept even if it goes).
    remix_of = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=now)
    updated_at = Column(DateTime, nullable=False, default=now)


class CheckBank(Base):
    """A teacher's week of Python check questions: the markdown they uploaded,
    answers and all, so never sent to a student as it is (pycheck.py). The
    newest row is the bank in use. Older ones stay: answers point at them."""
    __tablename__ = "gameide_check_banks"

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    name = Column(String(120), nullable=False, default="")
    #: What the teacher wrote, to edit again; `markdown` is that with each
    #: ```python predict block turned into a question by their page.
    source = Column(Text, nullable=False, default="")
    markdown = Column(Text, nullable=False, default="")
    #: The questions as read at upload, keys included.
    questions = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, nullable=False)


class CheckSettings(Base):
    """A teacher's timing and penalty for the Python check. Their students follow them."""
    __tablename__ = "gameide_check_settings"

    teacher_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    every_seconds = Column(Integer, nullable=False)
    strikes_out = Column(Integer, nullable=False)
    lock_seconds = Column(Integer, nullable=False)


class CheckState(Base):
    """Where one person is with the Python check, across every showcase game:
    otherwise reloading, or going to another game, would start the clock again."""
    __tablename__ = "gameide_check_state"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    due_at = Column(DateTime, nullable=True)
    #: The question they were asked and haven't answered: asked again until they do.
    pending = Column(String(12), nullable=False, default="")
    strikes = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    #: Questions asked lately, so the same one doesn't come straight back.
    recent = Column(Text, nullable=False, default="[]")


class CheckAnswer(Base):
    """One answer to a Python check question: what the teacher's report counts."""
    __tablename__ = "gameide_check_answers"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    bank_id = Column(Integer, ForeignKey("gameide_check_banks.id"), index=True, nullable=False)
    slug = Column(String(16), nullable=False, default="")
    qid = Column(String(12), nullable=False, default="")
    correct = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False)


class PublishedAsset(Base):
    """A copy of one of a published game's files (see Published)."""
    __tablename__ = "gameide_published_assets"
    __table_args__ = (UniqueConstraint("published_id", "asset_id", name="uq_gameide_published_asset"),)

    id = Column(Integer, primary_key=True)
    published_id = Column(Integer, ForeignKey("gameide_published.id"), index=True, nullable=False)
    asset_id = Column(String(32), nullable=False)
    content_type = Column(String(40), nullable=False)
    data = Column(LargeBinary, nullable=False)
    size = Column(Integer, nullable=False, default=0)


class Like(Base):
    __tablename__ = "gameide_likes"
    __table_args__ = (UniqueConstraint("published_id", "user_id", name="uq_gameide_like"),)

    id = Column(Integer, primary_key=True)
    published_id = Column(Integer, ForeignKey("gameide_published.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class HighScore(Base):
    """A student's best score in one published game: what the play page's boards show (publishing.py)."""
    __tablename__ = "gameide_high_scores"
    __table_args__ = (UniqueConstraint("published_id", "user_id", name="uq_gameide_high_score"),)

    id = Column(Integer, primary_key=True)
    published_id = Column(Integer, ForeignKey("gameide_published.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    score = Column(BigInteger, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=now)



# ---------------------------------------------------------------- multiplayer rooms (multiplayer.py)
# A room lives as long as someone is in it, and a while after (multiplayer.py
# deletes the idle ones), so these tables stay small. Times are epoch seconds
# (time.time()): a sync compares them several times a second, and floats need
# no timezone.

class NetRoom(Base):
    """A room in one published game, for one GameIDE class: joined by its code."""
    __tablename__ = "gameide_net_rooms"
    __table_args__ = (UniqueConstraint("published_id", "code", name="uq_gameide_net_room"),)

    id = Column(Integer, primary_key=True)
    published_id = Column(Integer, ForeignKey("gameide_published.id"), index=True, nullable=False)
    class_id = Column(Integer, nullable=False)
    code = Column(String(8), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    active_at = Column(Float, nullable=False, default=0)


class NetPlayer(Base):
    """One person in a room. `token` is what their page syncs with; `state` is the
    last thing their game sent (JSON), kept so coming back picks up where they were."""
    __tablename__ = "gameide_net_players"
    __table_args__ = (UniqueConstraint("room_id", "user_id", name="uq_gameide_net_player"),)

    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey("gameide_net_rooms.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    token = Column(String(48), unique=True, index=True, nullable=False)
    number = Column(Integer, nullable=False)
    name = Column(String(30), nullable=False)
    state = Column(Text, nullable=False, default="{}")
    away = Column(Integer, nullable=False, default=0)
    seen_at = Column(Float, nullable=False, default=0)


class NetMessage(Base):
    """A one-off message to everyone else in a room (net_shout): kept a few seconds."""
    __tablename__ = "gameide_net_messages"

    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey("gameide_net_rooms.id"), index=True, nullable=False)
    sender = Column(Integer, nullable=False)   # the player's number
    data = Column(Text, nullable=False)
    sent_at = Column(Float, nullable=False, default=0)

class Report(Base):
    """Someone's "Report" on a game. Its owner's teachers and the admins see it until handled."""
    __tablename__ = "gameide_reports"

    id = Column(Integer, primary_key=True)
    published_id = Column(Integer, ForeignKey("gameide_published.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String(500), nullable=False)
    handled = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=now)


class ClassSettings(Base):
    """GameIDE's own settings for a class (the classes table is shared with
    PyIDE and the other editors, so nothing GameIDE-only goes on it)."""
    __tablename__ = "gameide_class_settings"

    id = Column(Integer, primary_key=True)
    class_id = Column(Integer, unique=True, nullable=False)
    #: Students' public games go up without waiting for approval.
    auto_approve = Column(Integer, nullable=False, default=0)


# ---------------------------------------------------------------- classes (Phase 10)
# Classes, rosters, assignments and turning in are the shared tables PyIDE
# made (accounts.Course, Enrollment, ClassItem, Assignment, Submission,
# ClassroomLink, ClassroomPost), every row GameIDE writes carrying
# app="gameide". What those can't hold — a game isn't a map of text files —
# is here: which project an assignment starts from, whose copy of it each
# student is working in, and the comments on them.


class AssignmentGame(Base):
    """The game side of one assignment (accounts.Assignment, app "gameide").

    `starter_id` is a project the TEACHER owns, copied from the game they
    chose when they made the assignment — a copy, as PyIDE's starter code is,
    so they can carry on changing their own game without changing what the
    class was given. They edit the starter like any game ("Edit starter");
    students who haven't opened the assignment yet get it as it is then.
    It is kept off the teacher's My Games, where it would look like a stray
    duplicate (app.py, list_projects).

    `due_at` is UTC, or NULL for none. The shared Assignment has no due date
    (PyIDE sends one to Classroom only when posting); a game assignment
    shows it on the class page, so it is kept.
    """
    __tablename__ = "gameide_assignment_games"

    id = Column(Integer, primary_key=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), unique=True, nullable=False)
    starter_id = Column(Integer, ForeignKey("gameide_projects.id"), nullable=False)
    due_at = Column(DateTime, nullable=True)


class AssignmentWork(Base):
    """A student's own copy of an assignment's game: an ordinary project of
    theirs (on their My Games too), found again by (assignment, student) —
    so opening the assignment's link a second time goes back to the same
    game instead of making another, which was the whole problem PyIDE's
    Draft solved. Their teacher may read it (classes.can_read); only they
    can change it."""
    __tablename__ = "gameide_assignment_work"
    __table_args__ = (UniqueConstraint("assignment_id", "owner_id", name="uq_gameide_work"),)

    id = Column(Integer, primary_key=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), index=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("gameide_projects.id"), unique=True, nullable=False)
    created_at = Column(DateTime, nullable=False, default=now)


class Comment(Base):
    """A comment on a student's game: the teacher's, or the student's reply.

    `seen` is whether the OTHER side has read it — the student, for the
    teacher's comments; the teacher, for replies — which is what the
    "new comments" counts on the class and assignment pages are.
    """
    __tablename__ = "gameide_comments"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("gameide_projects.id"), index=True, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    seen = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=now)


# ---------------------------------------------------------------- tutorials (Phase 11b)

class Tutorial(Base):
    """A tutorial a teacher wrote: markdown with a header and one step per
    `---` slide (frontend/src/tutorials/tutorial.ts has the format). The
    built-in ones aren't rows — they're files the editor ships with
    (frontend/public/tutorials) — so a teacher can't change or lose them.

    visibility: "private" (its author only), "classes" (the students of its
    author's GameIDE classes), or "site" (everyone; only an admin can set it).
    """
    __tablename__ = "gameide_tutorials"

    id = Column(Integer, primary_key=True)
    slug = Column(String(16), unique=True, index=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(String(200), nullable=False, default="")
    level = Column(String(60), nullable=False, default="")
    markdown = Column(Text, nullable=False, default="")
    visibility = Column(String(12), nullable=False, default="private")
    created_at = Column(DateTime, nullable=False, default=now)
    updated_at = Column(DateTime, nullable=False, default=now)


def tutorial_of(text: str):
    """The tutorial a game is following and how far it has got, from the
    game's own JSON ({key, step, steps, title}), or None."""
    try:
        t = json.loads(text).get("tutorial")
    except ValueError:
        return None
    return t if isinstance(t, dict) and isinstance(t.get("key"), str) else None


def icon_asset(text: str):
    """A game's picture on "My games": the first frame of its sprite named
    "icon" (microStudio's convention), or None. The same rule as projectIcon
    in store/project.ts, for games kept only in the browser."""
    try:
        sprites = json.loads(text).get("sprites") or []
    except ValueError:
        return None
    for s in sprites:
        if str(s.get("name", "")).lower() == "icon" and s.get("frames"):
            return s["frames"][0]
    return None


def project_asset_ids(data: dict) -> list:
    """Every file a project uses — the same list as project.ts assetIds."""
    ids = []
    for s in data.get("sprites") or []:
        ids += [f for f in s.get("frames") or [] if isinstance(f, str)]
    for key, field in (("tilesets", "image"), ("sounds", "asset"), ("fonts", "asset")):
        ids += [r[field] for r in data.get(key) or [] if isinstance(r.get(field), str)]
    return list(dict.fromkeys(ids))



class HiddenBuiltin(Base):
    """A built-in tutorial an admin took off the public Learn page. The
    built-ins are files the editor ships with, the same for every site, so
    whether one is shown is kept here: a row is "hidden", no row is "on the
    Learn page". It still opens by its key (builtin:<name>), so a student's
    game started from it, and an assignment made from it, carry on."""
    __tablename__ = "gameide_hidden_builtins"

    key = Column(String(40), primary_key=True)
    hidden_at = Column(DateTime, nullable=False, default=now)

def create_all(engine):
    """accounts.create_all, which now also makes the tables above; then the
    columns added since, which it never adds to a table that already exists."""
    accounts.create_all(engine)
    from sqlalchemy import inspect, text
    if "showcase" not in {c["name"] for c in inspect(engine).get_columns("gameide_published")}:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE gameide_published ADD COLUMN showcase INTEGER NOT NULL DEFAULT 0"))
