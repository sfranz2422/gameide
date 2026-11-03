/// <reference lib="webworker" />
/** Runs a teacher's predict block and answers what it printed (pycheck/bank.ts). */
import { loadPyodide, type PyodideInterface } from "pyodide";

let py: PyodideInterface | null = null;

self.onmessage = async (e: MessageEvent<{ indexURL?: string; code?: string }>) => {
  if (e.data.indexURL) {
    py = await loadPyodide({ indexURL: e.data.indexURL });
    self.postMessage({ ready: true });
    return;
  }
  const out: string[] = [];
  try {
    py!.setStdout({ batched: (line) => out.push(line) });
    // A namespace of its own, so one block's names don't leak into the next.
    await py!.runPythonAsync(e.data.code!, { globals: py!.toPy({}) });
    self.postMessage({ output: out.join("\n") });
  } catch (err) {
    const lines = String(err).trim().split("\n");
    self.postMessage({ error: lines[lines.length - 1] });
  }
};
