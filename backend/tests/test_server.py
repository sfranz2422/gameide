"""
The server's checks: signing in, projects, pictures, history, the idle
sign-out and the headers. A plain script, as in PyIDE — prints ok/FAIL per
check and exits non-zero on any failure:

    backend/.venv/bin/python backend/tests/test_server.py

Runs against a throwaway SQLite database and Flask's test client; nothing
here touches the real one.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
DB = Path(tempfile.mkdtemp()) / "test.db"
os.environ["GAMEIDE_TEST_DATABASE_URL"] = f"sqlite:///{DB}"
os.environ["GAMEIDE_DEV_LOGIN"] = "1"
os.environ["TEACHER_EMAILS"] = "teacher@example.com"
os.environ.pop("DATABASE_URL", None)
os.environ.pop("GOOGLE_CLIENT_ID", None)
sys.path.insert(0, str(BACKEND))

import app as server  # noqa: E402
import gamestore  # noqa: E402
import accounts  # noqa: E402

failures = []


def check(name, cond, detail=""):
    print(("ok   " if cond else "FAIL ") + name + ("" if cond else f"  — {detail}"))
    if not cond:
        failures.append(name)


PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")


def project(slug, name="Game", **extra):
    d = {"format": "gameide-project", "schemaVersion": 1, "id": slug, "name": name, "objects": [], "sprites": [],
         "rooms": [], "scripts": [], "settings": {"stepsPerSecond": 60}}
    d.update(extra)
    return d


def client(email=None):
    c = server.app.test_client()
    if email:
        c.get("/dev/login?email=" + email)
    return c


def put(c, slug, data, base, packed=False):
    body = {"data": data, "base": base}
    if packed:
        body = {"_packed": base64.b64encode(json.dumps(body).encode()).decode()}
    return c.put(f"/api/projects/{slug}", json=body)


# ---------------------------------------------------------------- signing in
anon = client()
me = anon.get("/api/me").get_json()
check("signed out: /api/me says so", me["user"] is None and me["login_enabled"] is True)
r = anon.get("/api/projects")
check("signed out: projects need signing in, in words", r.status_code == 401 and "Sign in" in r.get_json()["error"])

alice = client("alice@example.com")
me = alice.get("/api/me").get_json()
check("dev sign-in makes a users row and a session", me["user"] and me["user"]["email"] == "alice@example.com")
check("a student is not a teacher, and is signed out when idle", me["user"]["teacher"] is False and me["idle_seconds"] > 0)
teacher = client("teacher@example.com")
tme = teacher.get("/api/me").get_json()
check("TEACHER_EMAILS makes a teacher, never idle-signed-out", tme["user"]["teacher"] is True and tme["idle_seconds"] == 0)

r = client().get("/dev/login?email=x@example.com&next=//evil.example/")
check("sign-in never redirects off the site", r.status_code == 302 and r.headers["Location"] == "/", r.headers.get("Location"))

# The dev sign-in must not exist on the real server, even if the flag leaks there.
out = subprocess.run([sys.executable, "-c", "import app; print(app.DEV_LOGIN)"], cwd=BACKEND, capture_output=True,
                     text=True, env={**os.environ, "DATABASE_URL": f"sqlite:///{DB}", "GAMEIDE_DEV_LOGIN": "1"})
check("dev sign-in is off whenever DATABASE_URL is set", out.stdout.strip().endswith("False"), out.stdout + out.stderr)

# ---------------------------------------------------------------- saving
r = put(alice, "aaa1", project("aaa1", "First"), 0)
check("a new project is saved at version 1", r.status_code == 200 and r.get_json() == {"version": 1, "replaced": False}, r.data)
r = alice.get("/api/projects/aaa1")
check("and comes back as it was sent", r.get_json()["data"]["name"] == "First" and r.get_json()["version"] == 1)
lst = alice.get("/api/projects").get_json()
check("it is in the list, with its name", [p["name"] for p in lst["projects"]] == ["First"] and lst["used"] > 0)

r = put(alice, "aaa1", project("aaa1", "First", objects=[{"id": "o"}]), 1)
check("saving from the current version moves it on", r.get_json() == {"version": 2, "replaced": False}, r.data)
r = put(alice, "aaa1", project("aaa1", "First", objects=[{"id": "o"}]), 2)
check("saving the same thing again changes nothing", r.get_json()["version"] == 2)

r = put(alice, "aaa1", project("aaa1", "From the other tab"), 1)
check("a save from an older version is accepted…", r.get_json() == {"version": 3, "replaced": True}, r.data)
versions = alice.get("/api/projects/aaa1/versions").get_json()["versions"]
replaced = [v for v in versions if v["kind"] == "replaced"]
check("…and what it replaced is kept in history", len(replaced) == 1 and replaced[0]["version"] == 2, versions)
old = alice.get(f"/api/projects/aaa1/versions/{replaced[0]['id']}").get_json()
check("…and can be read back", old["data"]["objects"] == [{"id": "o"}])

r = put(alice, "aaa2", project("aaa2", "Packed <script>alert(1)</script> def on_step(self):"), 0, packed=True)
check("a packed body (what the firewall sees) is read", r.status_code == 200 and
      alice.get("/api/projects/aaa2").get_json()["data"]["name"].startswith("Packed"))

r = put(alice, "zzz9", project("other-id"), 0)
check("the id in the URL must be the project's own", r.status_code == 400)
r = put(alice, "aaa3", {"format": "something-else", "id": "aaa3"}, 0)
check("only GameIDE projects are accepted", r.status_code == 400)
big = project("aaa4", rooms=[{"x": "y" * 2_100_000}])
r = put(alice, "aaa4", big, 0)
check("a project over the limit is refused, with the sizes in words",
      r.status_code == 413 and "MB" in r.get_json()["error"], r.data[:200])

# ---------------------------------------------------------------- other people's projects
bob = client("bob@example.com")
check("someone else's project can't be read", bob.get("/api/projects/aaa1").status_code == 403)
r = put(bob, "aaa1", project("aaa1", "Mine now"), 3)
check("…or written: its id is taken", r.status_code == 409)
check("…and it is untouched", alice.get("/api/projects/aaa1").get_json()["data"]["name"] == "From the other tab")
check("…nor its history", bob.get("/api/projects/aaa1/versions").status_code == 403)
check("…nor its pictures", bob.put("/api/projects/aaa1/assets/p1", data=PNG).status_code == 403)
check("bob's list is his own", bob.get("/api/projects").get_json()["projects"] == [])

# ---------------------------------------------------------------- pictures
r = alice.put("/api/projects/aaa1/assets/pic1", data=PNG, content_type="image/png")
check("a PNG uploads", r.status_code == 201, r.data)
r = alice.get("/api/projects/aaa1/assets/pic1")
check("and comes back byte for byte, as a PNG, cached for good",
      r.data == PNG and r.mimetype == "image/png" and "immutable" in r.headers["Cache-Control"])
check("sending it again (a retry) is fine", alice.put("/api/projects/aaa1/assets/pic1", data=PNG).status_code == 200)
check("different bytes can't take an existing id",
      alice.put("/api/projects/aaa1/assets/pic1", data=PNG + b"x").status_code == 409)
r = alice.put("/api/projects/aaa1/assets/pic2", data=b"<?php echo 1; ?>", content_type="image/png")
check("a file that isn't a picture is refused, whatever it claims", r.status_code == 415, r.data)
r = alice.put("/api/projects/aaa1/assets/pic3", data=b"\x89PNG\r\n\x1a\n" + b"0" * (gamestore.MAX_ASSET_BYTES + 1))
check("a picture over the limit is refused", r.status_code == 413)
# Sounds and fonts, judged by their bytes like pictures; sounds may be bigger.
WAV = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 28
check("a WAV sound is accepted", alice.put("/api/projects/aaa1/assets/snd1", data=WAV).status_code == 201)
r = alice.get("/api/projects/aaa1/assets/snd1")
check("…and comes back as audio", r.status_code == 200 and r.mimetype == "audio/wav", r.mimetype)
check("an MP3 (ID3 tag) is accepted", alice.put("/api/projects/aaa1/assets/snd2", data=b"ID3\x04\x00" + b"\x00" * 50).status_code == 201)
check("an OGG is accepted", alice.put("/api/projects/aaa1/assets/snd3", data=b"OggS" + b"\x00" * 50).status_code == 201)
check("a font (OTF) is accepted", alice.put("/api/projects/aaa1/assets/fnt1", data=b"OTTO" + b"\x00" * 50).status_code == 201)
r = alice.put("/api/projects/aaa1/assets/snd4", data=b"ID3" + b"\x00" * 3_000_000)
check("a 3 MB sound is fine (music)", r.status_code == 201, r.status_code)
r = alice.put("/api/projects/aaa1/assets/pic9", data=PNG + b"\x00" * 3_000_000)
check("…but a 3 MB picture is too big", r.status_code == 413 and "picture" in r.get_json()["error"], r.status_code)
r = alice.put("/api/projects/aaa1/assets/snd5", data=b"ID3" + b"\x00" * (gamestore.MAX_SOUND_BYTES + 1))
check("a sound over its limit is refused, by name", r.status_code == 413 and "sound" in r.get_json()["error"], r.status_code)
r = alice.put("/api/projects/aaa1/assets/txt1", data=b"just some text pretending to be a song")
check("anything else is refused, saying what is allowed", r.status_code == 415 and "MP3" in r.get_json()["error"])
check("a bad asset id is refused", alice.put("/api/projects/aaa1/assets/../x", data=PNG).status_code in (400, 404))

# ---------------------------------------------------------------- history
check("Save a version keeps a snapshot", alice.post("/api/projects/aaa1/versions", json={"label": "Before bosses"}).status_code == 201)
manual = [v for v in alice.get("/api/projects/aaa1/versions").get_json()["versions"] if v["kind"] == "manual"]
check("…with its label", manual and manual[0]["label"] == "Before bosses", manual)
put(alice, "aaa1", project("aaa1", "Broken"), 3)
r = alice.post(f"/api/projects/aaa1/versions/{manual[0]['id']}/restore")
check("restoring brings the old version back as the current one",
      r.status_code == 200 and r.get_json()["data"]["name"] == "From the other tab" and
      alice.get("/api/projects/aaa1").get_json()["data"]["name"] == "From the other tab")
kinds = [v["kind"] for v in alice.get("/api/projects/aaa1/versions").get_json()["versions"]]
check("…and keeps what was there before the restore", kinds[0] == "restore", kinds)
got = alice.get("/api/projects/aaa1/versions").get_json()["versions"]
before = alice.get(f"/api/projects/aaa1/versions/{got[0]['id']}").get_json()
check("…which is the version restored over", before["data"]["name"] == "Broken")

# Automatic snapshots: at most one per interval, and only the newest kept.
gamestore.AUTO_SNAPSHOT_SECONDS = -1  # every changed save makes one
gamestore.KEEP_AUTO_SNAPSHOTS = 3
v = alice.get("/api/projects/aaa1").get_json()["version"]
for i in range(6):
    v = put(alice, "aaa1", project("aaa1", f"Edit {i}"), v).get_json()["version"]
autos = [x for x in alice.get("/api/projects/aaa1/versions").get_json()["versions"] if x["kind"] == "auto"]
check("automatic snapshots are made as you save, and pruned to the newest", len(autos) == 3, len(autos))
check("hand-made snapshots are never pruned with them",
      any(x["kind"] == "manual" for x in alice.get("/api/projects/aaa1/versions").get_json()["versions"]))
gamestore.AUTO_SNAPSHOT_SECONDS = 10 * 60
gamestore.KEEP_AUTO_SNAPSHOTS = 40  # or pruning would hide an extra snapshot below
before = len(alice.get("/api/projects/aaa1/versions").get_json()["versions"])
v = put(alice, "aaa1", project("aaa1", "Quick edit"), v).get_json()["version"]
after = len(alice.get("/api/projects/aaa1/versions").get_json()["versions"])
check("within the interval, saving makes no snapshot", before == after, (before, after))

# ---------------------------------------------------------------- deleting
check("deleting works", alice.delete("/api/projects/aaa2").status_code == 200)
check("a deleted project leaves the list", "aaa2" not in [p["id"] for p in alice.get("/api/projects").get_json()["projects"]])
check("…and can't be opened", alice.get("/api/projects/aaa2").status_code == 404)
r = put(alice, "aaa2", project("aaa2", "Saved from an open tab"), 1)
check("…but a tab still open on it saves it back rather than losing the work",
      r.status_code == 200 and "aaa2" in [p["id"] for p in alice.get("/api/projects").get_json()["projects"]])

# ---------------------------------------------------------------- the idle sign-out
s = client("idle@example.com")
with s.session_transaction() as sess:
    sess["act"] = int(time.time()) - server.STUDENT_IDLE_SECONDS - 5
check("a student idle too long is signed out", s.get("/api/me").get_json()["user"] is None)
s = client("busy@example.com")
with s.session_transaction() as sess:
    sess["act"] = int(time.time()) - 600
s.get("/api/projects")
with s.session_transaction() as sess:
    polled = sess["act"]
s.post("/api/alive")
with s.session_transaction() as sess:
    beat = sess["act"]
check("polling (a GET to /api/) is not activity", int(time.time()) - polled >= 599)
check("the page's beat (a POST) is", int(time.time()) - beat < 5)
t = client("teacher@example.com")
with t.session_transaction() as sess:
    sess["act"] = int(time.time()) - server.STUDENT_IDLE_SECONDS - 5
check("a teacher is never signed out for being idle", t.get("/api/me").get_json()["user"] is not None)

# ---------------------------------------------------------------- headers
for path in ("/api/me", "/", "/healthz"):
    r = anon.get(path)
    check(f"{path} is sent cross-origin isolated",
          r.headers.get("Cross-Origin-Opener-Policy") == "same-origin"
          and r.headers.get("Cross-Origin-Embedder-Policy") == "credentialless")

# ---------------------------------------------------------------- publishing
os.environ["ADMIN_EMAILS"] = "admin@example.com"
admin = client("admin@example.com")
carol = client("carol@example.com")
other_teacher = client("teacher2@example.com")
os.environ["TEACHER_EMAILS"] = "teacher@example.com,teacher2@example.com"
db = server.SessionLocal()
tid = tme["user"]["id"]
period4 = accounts.Course(teacher_id=tid, name="Period 4", app="gameide")
db.add(period4)
db.flush()
for email in ("alice@example.com", "carol@example.com"):
    db.add(accounts.Enrollment(class_id=period4.id, email=email, name=email.split("@")[0]))
db.add(accounts.Course(teacher_id=tid, name="Period 7", app="gameide"))  # a class of the teacher's alice isn't in
# Alice's programming class is PyIDE's: it must never show up in GameIDE.
pyclass = accounts.Course(teacher_id=tid, name="Programming 1", app="pyide")
db.add(pyclass)
db.flush()
db.add(accounts.Enrollment(class_id=pyclass.id, email="alice@example.com", name="alice"))
db.commit()
PYCLASS = pyclass.id
P4 = period4.id
db.close()

GAME = project("pub1", "Coin Run", sprites=[{"frames": ["pic1"]}])
check("a game to publish is saved", put(alice, "pub1", GAME, 0).status_code == 200)
alice.put("/api/projects/pub1/assets/pic1", data=PNG)
settings = alice.get("/api/projects/pub1/publish").get_json()
check("publishing offers the student's own classes", [c["name"] for c in settings["classes"]] == ["Period 4"], settings["classes"])
check("…and their first name as the author, never their email", settings["author"] and "@" not in settings["author"])
check("another editor's classes are never offered (PyIDE's Programming 1)", "Programming 1" not in [c["name"] for c in alice.get("/api/my-classes").get_json()["classes"]])
check("…nor can a game be published to one", alice.post("/api/projects/pub1/publish", json={"title": "x", "visibility": "class", "classId": PYCLASS}).status_code == 400)
check("…nor its gallery be opened through GameIDE", alice.get(f"/api/gallery/{PYCLASS}").status_code == 403)

r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "unlisted", "author": "alice@example.com"})
pub = r.get_json()["published"]
SLUG = pub["id"]
check("publishing gives a play link", r.status_code == 200 and pub["url"] == f"/play/{SLUG}", r.get_json())
check("an email as the author name is replaced by a first name", "@" not in pub["author"])
r = anon.get(f"/api/play/{SLUG}")
check("an unlisted game plays for anyone with the link, signed out too", r.status_code == 200 and r.get_json()["project"]["name"] == "Coin Run")
check("…and its page holds no email address", "@example.com" not in r.get_data(as_text=True))
check("its files come with it", anon.get(f"/api/play/{SLUG}/assets/pic1").data == PNG)
check("…and only its own", anon.get(f"/api/play/{SLUG}/assets/nope").status_code == 404)
check("someone else can't publish your project", bob.post("/api/projects/pub1/publish", json={"title": "x", "visibility": "unlisted"}).status_code == 403)

# A snapshot: the student keeps working; players see the published version until it's published again.
put(alice, "pub1", project("pub1", "Coin Run 2", sprites=[{"frames": ["pic1"]}]), 1)
check("players see the published version, not the one being edited", anon.get(f"/api/play/{SLUG}").get_json()["project"]["name"] == "Coin Run")
alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "unlisted"})
check("…until it is published again", anon.get(f"/api/play/{SLUG}").get_json()["project"]["name"] == "Coin Run 2")

# Class games: members, its teacher and admins only.
r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "class", "classId": P4 + 1})
check("a game can't go to a class its author isn't in", r.status_code == 400)
alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "class", "classId": P4})
check("a class game needs signing in", anon.get(f"/api/play/{SLUG}").status_code == 401)
check("…is closed to someone outside the class", bob.get(f"/api/play/{SLUG}").status_code == 403)
check("…open to a classmate", carol.get(f"/api/play/{SLUG}").status_code == 200)
check("…to its teacher", teacher.get(f"/api/play/{SLUG}").status_code == 200)
check("…and to an admin", admin.get(f"/api/play/{SLUG}").status_code == 200)
check("…and its files are closed the same way", bob.get(f"/api/play/{SLUG}/assets/pic1").status_code == 403)
g = carol.get(f"/api/gallery/{P4}").get_json()
check("it is in the class's gallery", [x["id"] for x in g["games"]] == [SLUG], g)
check("the gallery is only for its class", bob.get(f"/api/gallery/{P4}").status_code == 403)

# Public: waits for a teacher, then is on Explore.
r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "public", "tags": ["arcade", "nonsense"]})
check("a student's public game waits for approval", r.get_json()["published"]["status"] == "pending")
check("…with only real tags kept", r.get_json()["published"]["tags"] == ["arcade"])
check("…and isn't on Explore yet", SLUG not in [x["id"] for x in anon.get("/api/explore").get_json()["games"]])
check("…though its link plays", anon.get(f"/api/play/{SLUG}").status_code == 200)
mod = teacher.get("/api/moderation").get_json()
check("its teacher sees it waiting", [x["id"] for x in mod["pending"]] == [SLUG], mod["pending"])
check("students can't open the approval queue", alice.get("/api/moderation").status_code == 403)
check("another class's teacher can't approve it", other_teacher.post(f"/api/moderation/{SLUG}", json={"action": "approve"}).status_code == 403)
check("its teacher approves it", teacher.post(f"/api/moderation/{SLUG}", json={"action": "approve"}).status_code == 200)
listed = anon.get("/api/explore?sort=new").get_json()["games"]
check("…and then it is on Explore, for anyone", [x["id"] for x in listed] == [SLUG] and listed[0]["author"] != "alice@example.com", listed)
check("Explore searches titles", [x["id"] for x in anon.get("/api/explore?q=coin").get_json()["games"]] == [SLUG])
check("…and filters by tag", anon.get("/api/explore?tag=puzzle").get_json()["games"] == [])
r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "public"})
check("publishing again puts it back in the queue (an approved game can't be swapped)", r.get_json()["published"]["status"] == "pending")
teacher.post(f"/api/moderation/classes/{P4}", json={"autoApprove": True})
r = alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "public", "allowRemix": True})
check("a class set to approve by itself lets it straight onto Explore", r.get_json()["published"]["status"] == "approved")
check("only a class's own teacher can change that", other_teacher.post(f"/api/moderation/classes/{P4}", json={"autoApprove": False}).status_code == 403)
put(teacher, "tch1", project("tch1", "Demo"), 0)
r = teacher.post("/api/projects/tch1/publish", json={"title": "Demo", "visibility": "public"})
check("a teacher's public game needs no approval", r.get_json()["published"]["status"] == "approved")

# Playing: plays, likes, remixes, reports.
p1 = anon.post(f"/api/play/{SLUG}/played").get_json()["plays"]
p2 = anon.post(f"/api/play/{SLUG}/played").get_json()["plays"]
check("a play is counted once per visit", p2 == p1 == 1, (p1, p2))
check("liking needs signing in", anon.post(f"/api/play/{SLUG}/like").status_code == 401)
check("a like counts", bob.post(f"/api/play/{SLUG}/like").get_json() == {"liked": True, "likes": 1})
check("…and a second press takes it back", bob.post(f"/api/play/{SLUG}/like").get_json() == {"liked": False, "likes": 0})
r = bob.post(f"/api/play/{SLUG}/remix")
new = r.get_json().get("slug")
check("a remix copies the game into the remixer's games", r.status_code == 200 and new in [x["id"] for x in bob.get("/api/projects").get_json()["projects"]], r.get_json())
data = bob.get(f"/api/projects/{new}").get_json()["data"]
check("…crediting where it came from", data.get("remixOf") == {"id": SLUG, "title": "Coin Run", "author": pub["author"]} and data["id"] == new)
check("…with its files", bob.get(f"/api/projects/{new}/assets/pic1").data == PNG)
alice.post("/api/projects/pub1/publish", json={"title": "Coin Run", "visibility": "public", "allowRemix": False})
check("a game its author won't let be remixed can't be", bob.post(f"/api/play/{SLUG}/remix").status_code == 403)
check("reporting needs a reason", bob.post(f"/api/play/{SLUG}/report", json={"reason": " "}).status_code == 400)
check("a report is taken", bob.post(f"/api/play/{SLUG}/report", json={"reason": "bad words in it"}).status_code == 200)
mod = teacher.get("/api/moderation").get_json()
check("its teacher sees the report", [x["reports"] for x in mod["reported"]] == [["bad words in it"]], mod["reported"])
check("…and so does an admin", [x["id"] for x in admin.get("/api/moderation").get_json()["reported"]] == [SLUG])
teacher.post(f"/api/moderation/{SLUG}", json={"action": "takedown", "note": "language"})
check("a game taken down is gone for players", anon.get(f"/api/play/{SLUG}").status_code == 404)
check("…and from Explore", SLUG not in [x["id"] for x in anon.get("/api/explore").get_json()["games"]])
check("…but its author can still open it", alice.get(f"/api/play/{SLUG}").status_code == 200)
check("…and its reports are handled", teacher.get("/api/moderation").get_json()["reported"] == [])
teacher.post(f"/api/moderation/{SLUG}", json={"action": "restore"})
check("restoring brings it back", anon.get(f"/api/play/{SLUG}").status_code == 200)
check("only admins feature games", teacher.post(f"/api/moderation/{SLUG}", json={"action": "feature"}).status_code == 400)
admin.post(f"/api/moderation/{SLUG}", json={"action": "feature"})
check("…and featured games are on Explore's Featured", [x["id"] for x in anon.get("/api/explore?sort=featured").get_json()["games"]] == [SLUG])
check("unpublishing takes the link down", alice.delete("/api/projects/pub1/publish").status_code == 200 and anon.get(f"/api/play/{SLUG}").status_code == 404)

# ---------------------------------------------------------------- the built editor's files
# The blocks editor's media come from our own origin (vite.config.ts copies
# them into dist/blockly-media); without this route the trash can and drag
# cursors 404 in production only, where the dev server isn't there to serve them.
fake_dist = Path(tempfile.mkdtemp())
(fake_dist / "blockly-media").mkdir()
(fake_dist / "blockly-media" / "sprites.svg").write_text("<svg/>")
real_dist, server.DIST = server.DIST, fake_dist
r = anon.get("/blockly-media/sprites.svg")
check("Blockly's media are served from our origin", r.status_code == 200 and r.data == b"<svg/>", r.status_code)
check("…and nothing outside that folder", anon.get("/blockly-media/../index.html").status_code == 404)
server.DIST = real_dist

print()
if failures:
    print(f"FAILED: {len(failures)} — " + "; ".join(failures))
    sys.exit(1)
print("all server checks ok")
