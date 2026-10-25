/**
 * Phase 1's shell: pick a demo, Play / Stop / Restart, the debug overlay,
 * FPS, and the console. The real editor (resource tree, object editor)
 * arrives in Phase 2 and replaces the demo picker.
 */
import { useEffect, useRef, useState } from "react";
import type { PythonGameError } from "../engine/engine";
import type { GameDefinition } from "../engine/game";
import { coinsDemo } from "../demos/coins";
import { stressDemo } from "../demos/stress";
import { GameSession, type SessionState, type SessionStats } from "./gameSession";
import { KEY_CODE } from "../engine/input";

const DEMOS: Record<string, { label: string; def: GameDefinition }> = {
  coins: { label: "Collect the coins", def: coinsDemo },
  stress: { label: "Stress test (300+)", def: stressDemo },
};

interface Line {
  text: string;
  kind: "out" | "err" | "warn" | "info";
}

function describe(e: PythonGameError): string {
  const who = e.kind === "script" ? `script ${e.object}` : e.object;
  const where = [who, e.event, e.line != null ? `line ${e.line}` : null].filter(Boolean).join(" → ");
  return `${where ? where + "\n" : ""}${e.message}${e.traceback ? "\n" + e.traceback : ""}`;
}

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const session = useRef<GameSession | null>(null);
  const [demo, setDemo] = useState("coins");
  const [state, setState] = useState<SessionState>("stopped");
  const [lines, setLines] = useState<Line[]>([]);
  const [debug, setDebug] = useState(false);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const consoleEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const add = (text: string, kind: Line["kind"]) => setLines((ls) => [...ls.slice(-500), { text, kind }]);
    const s = new GameSession(host.current!, {
      output: add,
      error: (e) => add(describe(e), "err"),
      state: setState,
    });
    session.current = s;
    // Hooks for the Playwright smoke test; harmless in a student's browser.
    (window as unknown as Record<string, unknown>).__gameide = {
      session: s,
      keyCode: (k: string) => KEY_CODE.get(k),
    };
    const timer = setInterval(() => setStats(s.stats()), 500);
    return () => {
      clearInterval(timer);
      s.stop();
    };
  }, []);

  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and
  // an effect that returns anything but a function crashes React's commit.
  useEffect(() => {
    void consoleEnd.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  const play = () => {
    setLines((ls) => [...ls, { text: `▶ ${DEMOS[demo]!.label}`, kind: "info" }]);
    void session.current?.play(DEMOS[demo]!.def);
  };

  return (
    <div className="ide">
      <header className="toolbar" data-tutorial="toolbar">
        <strong className="brand">GameIDE</strong>
        <select value={demo} onChange={(e) => setDemo(e.target.value)} data-tutorial="demo-picker" aria-label="Demo">
          {Object.entries(DEMOS).map(([k, d]) => (
            <option key={k} value={k}>
              {d.label}
            </option>
          ))}
        </select>
        <button onClick={play} disabled={state === "loading"} data-tutorial="play" data-testid="play">
          {state === "running" ? "↻ Restart" : "▶ Play"}
        </button>
        <button onClick={() => session.current?.stop()} disabled={state !== "running"} data-tutorial="stop">
          ■ Stop
        </button>
        <label className="toggle" data-tutorial="debug-toggle">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => {
              setDebug(e.target.checked);
              session.current?.setDebug(e.target.checked);
            }}
          />
          Debug overlay
        </label>
        <span className="stats" data-testid="stats">
          {state === "loading" && "Starting Python…"}
          {state === "running" && stats && (
            <>
              <b data-testid="fps">{stats.fps}</b> fps · {stats.instances} instances · Python{" "}
              {stats.pythonMs.toFixed(2)} ms (engine {stats.motionMs.toFixed(2)} ms)
            </>
          )}
        </span>
      </header>
      <main className="stage" data-tutorial="game-pane">
        <div className="game-host" ref={host} />
        {state === "stopped" && (
          <p className="hint">Press Play. Arrow keys move; click the game first so it has the keyboard.</p>
        )}
      </main>
      <section className="console" data-tutorial="console" data-testid="console">
        {lines.map((l, i) => (
          <pre key={i} className={`line ${l.kind}`}>
            {l.text}
          </pre>
        ))}
        <div ref={consoleEnd} />
      </section>
    </div>
  );
}
