# GameIDE

A browser-based 2D game engine and IDE for high school and college students:
GameMaker's object → event → instance → room model, scripted in Python.
Games run entirely in the browser (PixiJS for drawing, Pyodide for Python);
the server only stores and serves.

It is built in eleven phases; what is done, what is next and the known
issues are in [PROGRESS.md](PROGRESS.md).

## Running it

```
cd frontend
npm install
npm run dev            # http://localhost:5173
```

## Tests

```
cd frontend
npm test               # Vitest, including real Pyodide
npx playwright install chromium   # once
npm run e2e            # builds, serves, plays the demos in Chromium
python3 scripts/sabotage.py       # confirms every check can fail
```
