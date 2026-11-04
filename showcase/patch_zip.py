#!/usr/bin/env python3
"""
Puts a game's current code into a built zip, keeping its pictures and sounds.

    python3 showcase/patch_zip.py GAME_FOLDER ZIP      # e.g. showcase/greymire  Greymire.zip

For a game whose art isn't on this computer, so build.py can't make it: a zip
built earlier, or a project exported from GameIDE, already holds the pictures.
Only code changes: each script, and each object's events, by name, from
GAME_FOLDER/game/*.py, and settings["scoreboard"] from its build.py. Writes
beside the zip as <name>-patched.zip and <name>-patched.json, never over it.
"""
import importlib.util
import json
import re
import sys
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location("thornwood_build", Path(__file__).resolve().parent / "build.py")
tw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tw)


def key_of(name, ids):
    parts = name.split()
    if parts[0] == "mouse":
        return {"type": "mouse", "button": parts[-1], "edge": parts[-2], "global": parts[1] == "global"}
    if parts[0] == "collision":
        return {"type": "collision", "object": ids[parts[1]]}
    return tw.event_key(name, None)


def patch(folder, zip_path):
    folder, zip_path = Path(folder), Path(zip_path)
    with zipfile.ZipFile(zip_path) as z:
        files = {n: z.read(n) for n in z.namelist()}
    p = json.loads(files["project.json"])
    ids = {o["name"]: o["id"] for o in p["objects"]}
    changed, missing = [], []
    for f in sorted((folder / "game").glob("*.py")):
        head, events = tw.read_code(f)
        if f.name.startswith("_"):
            name = head.get("script", f.stem.strip("_"))
            script = next((s for s in p["scripts"] if s["name"] == name), None)
            if script is None:
                missing.append(f"script {name}")
            elif script["code"] != f.read_text():
                script["code"] = f.read_text()
                changed.append(f"script {name}")
            continue
        obj = next((o for o in p["objects"] if o["name"] == f.stem), None)
        if obj is None:
            missing.append(f"object {f.stem}")
            continue
        for ev, code in events:
            key = key_of(ev, ids)
            have = next((e for e in obj["events"] if e["key"] == key), None)
            if have is None:
                missing.append(f"{f.stem}: {ev}")
            elif have.get("code") != code:
                have["code"] = code
                changed.append(f"{f.stem}: {ev}")
    if missing:
        raise SystemExit("These aren't in the zip, so its code is too different to patch:\n  " + "\n  ".join(missing))
    m = re.search(r'\["scoreboard"\] = (\{.*\})', (folder / "build.py").read_text())
    if m:
        p["settings"]["scoreboard"] = eval(m.group(1))
    text = json.dumps(p, indent=1)
    files["project.json"] = text.encode()
    out = zip_path.with_name(zip_path.stem + "-patched.zip")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for n, data in files.items():
            z.writestr(n, data)
    zip_path.with_name(zip_path.stem + "-patched.json").write_text(text)
    print(f"{out}: {', '.join(changed) or 'no code changed'}")


if __name__ == "__main__":
    patch(sys.argv[1], sys.argv[2])
