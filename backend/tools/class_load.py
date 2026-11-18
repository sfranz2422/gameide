#!/usr/bin/env python3
"""
A class opening one published game at the same moment, against a local server: the
game (a showcase .zip: its project and every picture) is published once, then each
pretend student fetches the game and all its files, two at a time.
It reports how long the class took and the server's memory at its highest. Local only:
it signs in with the dev login, which Render doesn't have.

    cd backend
    GAMEIDE_DEV_LOGIN=1 GAMEIDE_ONE_PROCESS=1 GAMEIDE_TEST_DATABASE_URL=sqlite:////tmp/classload.db \\
        .venv/bin/gunicorn app:app --workers 1 --threads 64 --bind 127.0.0.1:5078 &
    .venv/bin/python tools/class_load.py http://127.0.0.1:5078 ../showcase/farm/out/Farm.zip 30 <gunicorn pid>
"""
import json
import subprocess
import sys
import threading
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor

import requests

BASE, ZIP = sys.argv[1], sys.argv[2]
STUDENTS = int(sys.argv[3]) if len(sys.argv) > 3 else 30
PID = sys.argv[4] if len(sys.argv) > 4 else None
# Files a student fetches at once: two keeps a class within what one machine will queue
# (thirty students at six each was more connections than macOS holds for one server).
AT_ONCE = 2


def signed_in(email):
    s = requests.Session()
    s.get(f"{BASE}/dev/login", params={"email": email}, allow_redirects=False)
    return s


def rss_mb():
    """The server's memory (its worker's, the biggest gunicorn process)."""
    if not PID:
        return 0
    out = subprocess.run(["ps", "-o", "rss=", "-g", subprocess.run(["ps", "-o", "pgid=", "-p", PID], capture_output=True, text=True).stdout.strip()],
                         capture_output=True, text=True).stdout.split()
    return max((int(x) for x in out), default=0) / 1024


z = zipfile.ZipFile(ZIP)
project = json.loads(z.read("project.json"))
index = json.loads(z.read("assets/index.json"))
slug = "classload"
project["id"] = slug
owner = signed_in("classload.owner@example.com")
r = owner.put(f"{BASE}/api/projects/{slug}", json={"data": project, "base": 0})
assert r.status_code == 200, r.text
for aid, path in index.items():
    owner.put(f"{BASE}/api/projects/{slug}/assets/{aid}", data=z.read(path))
r = owner.post(f"{BASE}/api/projects/{slug}/publish", json={"title": "Class load", "visibility": "unlisted"})
play = r.json()["published"]["id"]
students = [signed_in(f"classload.s{i}@example.com") for i in range(STUDENTS)]
print(f"{len(index)} files, {sum(len(z.read(p)) for p in index.values()) / 1e6:.1f} MB a student, {STUDENTS} students")

peak = [rss_mb()]
start_mb = peak[0]
done = threading.Event()


def watch():
    while not done.is_set():
        peak[0] = max(peak[0], rss_mb())
        time.sleep(0.05)


def student(s):
    t = time.time()
    s.get(f"{BASE}/api/play/{play}").raise_for_status()
    with ThreadPoolExecutor(AT_ONCE) as ex:
        for res in ex.map(lambda aid: s.get(f"{BASE}/api/play/{play}/assets/{aid}"), index):
            res.raise_for_status()
    return time.time() - t


threading.Thread(target=watch, daemon=True).start()
t0 = time.time()
with ThreadPoolExecutor(STUDENTS) as ex:
    times = list(ex.map(student, students))
done.set()
times.sort()
print(f"whole class: {time.time() - t0:.1f} s; a student: median {times[len(times) // 2]:.1f} s, slowest {times[-1]:.1f} s")
print(f"server memory: {start_mb:.0f} MB before, {peak[0]:.0f} MB at the highest")
