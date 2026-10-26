# GameIDE

A browser-based 2D game engine and IDE for high school and college students:
GameMaker's object → event → instance → room model, scripted in Python.
Games run entirely in the browser (PixiJS for drawing, Pyodide for Python);
the server only signs people in and stores their projects.

It is built in phases; what is done, what is next and the known issues are
in [PROGRESS.md](PROGRESS.md).

## Running it

The editor alone (projects kept in the browser, no sign-in):

```
cd frontend && npm install && npm run dev        # http://localhost:5173
```

With the server (sign-in, projects in an account, history). In a second
terminal:

```
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
GAMEIDE_DEV_LOGIN=1 .venv/bin/python app.py      # API on :5001
```

`npm run dev` sends /api, /login and friends through to it, and
`GAMEIDE_DEV_LOGIN=1` adds a Sign in that needs no Google (local only).

## Tests

```
cd frontend
npm test                                         # Vitest, including real Pyodide
npx playwright install chromium                  # once
npm run e2e                                      # the editor, and signed in against Flask
../backend/.venv/bin/python ../backend/tests/test_server.py
python3 scripts/sabotage.py                      # confirms every check can fail
```

## License

GameIDE is under the [MIT License](LICENSE). The libraries it uses, and ships
inside exported games, keep their own licences: Pyodide (MPL 2.0), Blockly
(Apache 2.0), PixiJS, CodeMirror and fflate (MIT), Electron in the Steam kit
(MIT), and the Source Sans 3 and Ubuntu fonts (SIL Open Font License and the
Ubuntu Font Licence).
