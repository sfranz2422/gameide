/**
 * A week's Python check questions, on their way to the server. A ```python
 * predict block's answer is whatever it prints, so something has to run it, and
 * it's the teacher's own browser, here: the server never runs uploaded code
 * (backend/pycheck.py). Each becomes the ```quiz predict block it amounts to.
 */
import { pyodideURLs } from "../python/pyodideSource";

const OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*py(?:thon)?[ \t]+predict[ \t]*$/i;
const HINT = /^\s*#\s*hint\s*:/i;

export type Run = (code: string) => Promise<{ output: string } | { error: string }>;

/** The code a predict block runs: without its hints, as xp.predict_code reads it. */
export const predictCode = (body: string[]) => body.filter((l) => !HINT.test(l)).join("\n").trimEnd();

export function hasPredicts(md: string) {
  return md.split(/\r?\n/).some((l) => OPEN.test(l));
}

export async function predictsToQuiz(md: string, run: Run): Promise<{ markdown: string; problems: string[] }> {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  const problems: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = OPEN.exec(lines[i]!);
    if (!m) {
      out.push(lines[i]!);
      continue;
    }
    const fence = m[1]!;
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const s = lines[j]!.trim();
      if (s && s[0] === fence[0] && [...s].every((c) => c === fence[0]) && s.length >= fence.length) break;
      body.push(lines[j]!);
    }
    const code = predictCode(body);
    const r = await run(code);
    if ("error" in r) {
      problems.push(`Line ${i + 1}: this predict block can't be used: ${r.error}`);
    } else if (!r.output.trim()) {
      problems.push(`Line ${i + 1}: this predict block doesn't print anything, so there's nothing to predict.`);
    } else {
      // On one line, as an answer must be: answers are compared ignoring line breaks anyway.
      out.push("```quiz", "type: predict", "What will this print?", "~~~python", code, "~~~", `answer: ${r.output.trim().split(/\s+/).join(" ")}`, "```");
    }
    i = j;
  }
  return { markdown: out.join("\n"), problems };
}

const RUN_MS = 4000;

/** Runs blocks in a Python of their own, in a worker, so an endless loop can be stopped. */
export function browserRunner(): { run: Run; stop: () => void } {
  let worker: Worker | null = null;
  let ready: Promise<void> | null = null;
  const fresh = () => {
    worker = new Worker(new URL("./predictWorker.ts", import.meta.url), { type: "module" });
    const w = worker;
    ready = new Promise((resolve) => {
      const on = (e: MessageEvent) => {
        if (e.data.ready) {
          w.removeEventListener("message", on);
          resolve();
        }
      };
      w.addEventListener("message", on);
    });
    w.postMessage({ indexURLs: pyodideURLs() });
  };
  const stop = () => {
    worker?.terminate();
    worker = null;
  };
  const run: Run = async (code) => {
    if (!worker) fresh();
    await ready;
    const w = worker!;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        stop(); // the only way to stop an endless loop; the next block starts a new Python
        resolve({ error: `it was still running after ${RUN_MS / 1000} seconds.` });
      }, RUN_MS);
      w.onmessage = (e) => {
        clearTimeout(timer);
        resolve(e.data.error ? { error: `it stopped with an error: ${e.data.error}` } : { output: e.data.output });
      };
      w.postMessage({ code });
    });
  };
  return { run, stop };
}
