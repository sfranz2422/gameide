/**
 * The teacher's Python Check page: this week's questions, uploaded as a markdown
 * file, and who has answered them. A file with anything wrong in it is shown
 * problem by problem and not used, so the bank in play is always a whole one.
 */
import { useEffect, useState } from "react";
import { PageHead } from "../editor/ExplorePages";
import { api } from "../store/api";
import { browserRunner, hasPredicts, predictsToQuiz } from "./bank";

interface Bank {
  name: string;
  uploaded: string;
  count: number;
  kinds: Record<string, number>;
  source: string;
  questions: { kind: string; prompt: string; answer: string; explain: string }[];
}
interface Settings { everyMinutes: number; strikesOut: number; lockMinutes: number }
interface Student { name: string; answered: number; right: number; last: string }

const SAMPLE = `\`\`\`quiz
What does len("hello") return?
- [ ] "hello"
- [x] 5
- [ ] 4
explain: len counts the characters, and hello has five.
\`\`\`

\`\`\`quiz
Which keyword repeats code while a condition stays true?
answer: while
\`\`\`

\`\`\`python predict
for i in range(3):
    print(i * 2)
\`\`\`

\`\`\`quiz
type: predict
What will this print?
~~~python
print("a" + "b")
~~~
answer: ab
\`\`\`

\`\`\`quiz
type: blank
A [[while]] loop repeats as long as its condition is [[True|true]].
\`\`\`

\`\`\`quiz
type: match
Match each keyword to what it does.
- for -> repeats once for each item
- while -> repeats while a condition holds
option: stops the program
\`\`\`

\`\`\`quiz
type: order
Put the lines in order so it counts to 3.
- for i in range(1, 4):
-     print(i)
\`\`\`

\`\`\`quiz
type: bug
Which line stops this program from running?
~~~python
for n in range(3)
    print(n)
~~~
bug: 1
\`\`\`

\`\`\`quiz
type: sort
Sort each value into its type.
group: Number
- 5
- 3.14
group: Text
- "hello"
- "5"
\`\`\`
`;

export function BankPage() {
  const [bank, setBank] = useState<Bank | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Partial<Settings>>({});
  const [settingsNote, setSettingsNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [problems, setProblems] = useState<string[] | null>(null);
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const load = () => {
    void api<{ bank: Bank | null; settings: Settings }>("/api/check/bank").then((r) => {
      setBank(r.bank);
      setSettings(r.settings);
      // Opens on what's in use, to change and save again. Keeps what you wrote, not what it became.
      // If the page was slow, they may have started already: what they've typed or chosen stays.
      setText((t) => t || (r.bank?.source ?? ""));
      setName((n) => n || (r.bank?.name ?? ""));
    }, (e: Error) => setRefused(e.message));
    void api<{ students: Student[] }>("/api/check/report").then((r) => setStudents(r.students), () => undefined);
  };
  useEffect(load, []);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
    setName(f.name.replace(/\.[^.]*$/, ""));
    setProblems(null);
    setSaved(false);
  };

  const use = async () => {
    setBusy(hasPredicts(text) ? "Running your predict blocks…" : "Reading your questions…");
    setSaved(false);
    const runner = browserRunner();
    try {
      const { markdown, problems: ran } = await predictsToQuiz(text, runner.run);
      // With a block that wouldn't run, the rest is only read, so everything wrong is listed at once.
      const r = await api<{ problems: string[]; bank?: Bank }>("/api/check/bank", { json: { markdown, source: text, name, save: ran.length === 0 } });
      setProblems([...ran, ...r.problems]);
      if (r.bank) {
        setBank(r.bank);
        setSaved(true);
      }
    } catch (e) {
      setProblems([e instanceof Error ? e.message : String(e)]);
    } finally {
      runner.stop();
      setBusy("");
    }
  };

  const saveSettings = async () => {
    setSettingsNote(null);
    try {
      // Only what was changed: the rest stays exactly as it is.
      const r = await api<{ settings: Settings }>("/api/check/settings", { json: form });
      setSettings(r.settings);
      setForm({});
      setSettingsNote({ ok: true, text: "Saved. Students follow from their next question." });
    } catch (e) {
      setSettingsNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  const field = (key: keyof Settings, label: string, min: number, max: number) => (
    <label className="bank-setting">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={form[key] ?? settings?.[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value === "" ? undefined : Number(e.target.value) })}
        data-testid={`setting-${key}`}
      />
    </label>
  );

  if (refused) return <div className="explore-page"><PageHead title="Python Check" at="pycheck" /><p className="error-text">{refused}</p></div>;
  return (
    <div className="explore-page python-check-page" data-testid="python-check-page">
      <PageHead title="Python Check" at="pycheck" />
      <p>
        A showcase game stops every so often for one of these questions. A right answer earns XP and goes back to the game. A wrong one shows
        the answer and asks another. Too many wrong in a row, and the student is out for a while. To make a game a showcase game, tick{" "}
        <strong>Showcase game</strong> as you publish it.
      </p>

      <section>
        <h2>Timing and penalty</h2>
        <div className="bank-settings">
          {field("everyMinutes", "Minutes between questions", 1, 60)}
          {field("strikesOut", "Wrong answers in a row before they're out", 1, 10)}
          {field("lockMinutes", "Minutes they stay out", 1, 60)}
        </div>
        <p>
          <button className="btn primary" disabled={Object.keys(form).length === 0} onClick={() => void saveSettings()} data-testid="settings-save">Save these</button>
        </p>
        {settingsNote && <p className={settingsNote.ok ? "banner" : "banner error"} data-testid="settings-note">{settingsNote.text}</p>}
      </section>

      <section>
        <h2>This week's questions</h2>
        {bank ? (
          <>
            <p data-testid="bank-summary"><strong>{bank.name}</strong>: {bank.count} questions, uploaded {new Date(bank.uploaded).toLocaleString()}</p>
            <details>
              <summary>See them, with their answers</summary>
              <ol className="bank-list" data-testid="bank-list">
                {bank.questions.map((q, i) => (
                  <li key={i}>
                    <span className="muted small">{q.kind}</span>
                    <pre>{q.prompt}</pre>
                    <pre className="bank-answer">{q.answer}</pre>
                    {q.explain && <p className="muted small">{q.explain}</p>}
                  </li>
                ))}
              </ol>
            </details>
          </>
        ) : (
          <p className="banner error" data-testid="bank-none">No questions yet, so students can't play showcase games. Upload some below.</p>
        )}
      </section>

      <section>
        <h2>Change them, or upload a new week</h2>
        <p className="muted small">Edit below, or choose a file to replace what's there, then save. They replace the questions above straight away. What students have already answered stays in the record.</p>
        <p><input type="file" accept=".md,.markdown,.txt" onChange={(e) => void readFile(e.target.files?.[0])} data-testid="bank-file" aria-label="A markdown file of questions" /></p>
        <textarea className="bank-text" rows={10} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} placeholder="Your questions: choose a file above, or type or paste them here" data-testid="bank-text" aria-label="Questions, as markdown" />
        <p>
          <button className="btn primary" disabled={!text.trim() || !!busy} onClick={() => void use()} data-testid="bank-use">{busy || "Save these questions"}</button>
        </p>
        {saved && <p className="banner" data-testid="bank-saved">Done. These are the questions from now on.</p>}
        {problems && problems.length > 0 && (
          <div className="banner error" data-testid="bank-problems">
            <p>Nothing changed. Fix these and try again:</p>
            <ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        )}
        <details>
          <summary>How to write them</summary>
          <p>The same question blocks as your notes, every kind except long answers, plus a <code>python predict</code> block, whose answer is whatever it prints when you upload it. An optional <code>explain:</code> line is shown after a wrong answer.</p>
          <pre className="bank-sample" data-testid="bank-sample">{SAMPLE}</pre>
        </details>
      </section>

      <section>
        <h2>Who has answered this week's questions</h2>
        {students.length ? (
          <table className="bank-report" data-testid="bank-report">
            <thead><tr><th>Student</th><th>Answered</th><th>Right</th><th>Last answer</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.name}><td>{s.name}</td><td>{s.answered}</td><td>{s.right}</td><td>{new Date(s.last).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nobody yet.</p>
        )}
      </section>
    </div>
  );
}
