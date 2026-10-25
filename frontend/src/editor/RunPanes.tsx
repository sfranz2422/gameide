/**
 * The right-hand column: the game, then Console and Docs as tabs under it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { API, PROPERTIES, type Category } from "../catalog/api";
import type { MappedError } from "../python/codegen";
import type { GameState, WorkerStats } from "../python/protocol";
import { activeEditor } from "./code/CodeEditor";
import { signature } from "./code/pythonHelp";
import type { GameHost } from "./gameHost";
import { Icon } from "./ui/icons";

export type ConsoleLine = { kind: "out" | "err" | "warn" | "info"; text: string } | { kind: "error"; error: MappedError };

export function GamePane({
  host,
  state,
  stats,
  ready,
  onPlay,
  onStop,
}: {
  host: GameHost | null;
  state: GameState;
  stats: WorkerStats | null;
  ready: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    if (host) host.container = box.current;
  }, [host]);
  const running = state === "running" || state === "loading";
  return (
    <section className="game-pane" data-tutorial="game-pane">
      <header className="pane-head">
        <button className="btn play" onClick={onPlay} data-tutorial="play" data-testid="play" title="Play (Ctrl+Enter)">
          {running ? Icon.restart() : Icon.play()} {running ? "Restart" : "Play"}
        </button>
        <button className="btn" onClick={onStop} disabled={!running} data-tutorial="stop" data-testid="stop">
          {Icon.stop()} Stop
        </button>
        <label className="check" title="Show FPS and collision boxes" data-tutorial="debug-toggle">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => {
              setDebug(e.target.checked);
              host?.setDebug(e.target.checked);
            }}
          />
          {Icon.bug()} Debug
        </label>
        <span className="stats" data-testid="stats">
          {state === "loading" && (ready ? "Starting…" : "Loading Python…")}
          {state === "running" && stats && (
            <>
              <b data-testid="fps">{stats.fps}</b> fps · {stats.instances} inst · {stats.pythonMs.toFixed(1)} ms
            </>
          )}
          {state === "stopped" && !ready && "Loading Python…"}
        </span>
      </header>
      <div className="game-box" ref={box}>
        {state === "stopped" && <p className="hint">Press Play. Click the game to give it the keyboard.</p>}
      </div>
    </section>
  );
}

export function ConsolePane({ lines, clear, jump }: { lines: ConsoleLine[]; clear: () => void; jump: (e: MappedError) => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braces matter: newer Chrome returns a Promise from scrollIntoView, and
    // an effect that returns anything but a function crashes React's commit.
    void end.current?.scrollIntoView({ block: "end" });
  }, [lines]);
  return (
    <div className="console" data-tutorial="console" data-testid="console">
      <button className="icon-btn console-clear" onClick={clear} title="Clear" aria-label="Clear console">
        {Icon.clear()}
      </button>
      {lines.map((l, i) =>
        l.kind === "error" ? (
          <div key={i} className="line error-block">
            {l.error.where && (
              <button className="error-where" onClick={() => jump(l.error)} disabled={!l.error.target} data-testid="error-where">
                {l.error.where}
              </button>
            )}
            <pre className="error-msg">{l.error.message}</pre>
            {l.error.traceback && !l.error.hang && (
              <details>
                <summary>How it got there</summary>
                <pre>{l.error.traceback}</pre>
              </details>
            )}
          </div>
        ) : (
          <pre key={i} className={`line ${l.kind}`}>
            {l.text}
          </pre>
        ),
      )}
      <div ref={end} />
    </div>
  );
}

const CATEGORIES: Category[] = ["Instances", "Collision", "Input", "Motion", "Drawing", "Rooms", "Debug"];

/** The API catalog as a searchable list. Clicking an entry types it at the cursor. */
export function DocsPane() {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return API.filter((e) => !s || e.name.includes(s) || e.description.toLowerCase().includes(s));
  }, [q]);
  const insert = (text: string) => {
    const v = activeEditor.view;
    if (!v || v.state.readOnly) return;
    const { from, to } = v.state.selection.main;
    v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    v.focus();
  };
  return (
    <div className="docs" data-tutorial="docs">
      <input className="docs-search" placeholder="Search functions…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search docs" />
      {CATEGORIES.map((c) => {
        const items = shown.filter((e) => e.category === c);
        if (!items.length) return null;
        return (
          <section key={c}>
            <h4>{c}</h4>
            {items.map((e) => (
              <button
                key={e.name}
                className="doc-entry"
                title="Click to put it in your code"
                onClick={() => insert(e.kind === "function" ? `${e.name}(${e.params.filter((p) => p.default === undefined).map((p) => p.name).join(", ")})` : e.name)}
              >
                <code>{e.kind === "function" ? signature(e) : e.name}</code>
                <span>{e.description}</span>
              </button>
            ))}
          </section>
        );
      })}
      {!q && (
        <section>
          <h4>Instance properties (self.…)</h4>
          {PROPERTIES.map((p) => (
            <button key={p.name} className="doc-entry" onClick={() => insert(`self.${p.name}`)}>
              <code>self.{p.name}</code>
              <span>{p.description}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
