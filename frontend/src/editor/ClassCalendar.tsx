/**
 * The week's calendar at the top of a class's page: day cards drawn from the
 * text the teacher pasted (calendarWeek.ts reads it), and for the teacher,
 * Edit calendar with a preview that redraws as they type, so a line that
 * didn't become a day shows before Save. The same `classes.calendar` column
 * PyIDE, WebIDE and FlaskIDE show on their class pages.
 */
import { useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { api } from "../store/api";
import { asItem, parseWeek, todayIn } from "./calendarWeek";

/** The teacher's markdown, sanitised, with every link opening in a new tab
 *  (a student following one shouldn't lose the class page). */
function Md({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(text, { breaks: true, async: false }) as string;
    return (DOMPurify.sanitize(raw) as string).replace(
      /<a /g,
      '<a target="_blank" rel="noopener" ',
    );
  }, [text]);
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function Week({ text, extra }: { text: string; extra?: React.ReactNode }) {
  const week = useMemo(() => parseWeek(text), [text]);
  const today = todayIn(week.days);
  return (
    <>
      <div className="cal-bar">
        {week.title ? (
          <Md text={week.title} className="cal-heading" />
        ) : (
          <div className="cal-heading">This week</div>
        )}
        {extra}
      </div>
      {week.days.length > 0 && (
        <div
          className="cal-grid"
          style={
            {
              "--cal-days": Math.min(week.days.length, 7),
            } as React.CSSProperties
          }
        >
          {week.days.map((d, i) => (
            <section
              key={i}
              className={`cal-day${i === today ? " is-today" : ""}`}
              data-testid="cal-day"
            >
              <header className="cal-day-head">
                <span className="cal-dow">{d.name}</span>
                {d.date && <span className="cal-date">{d.date}</span>}
                {i === today && <span className="cal-today">Today</span>}
              </header>
              {d.lines.length ? (
                <Md
                  text={d.lines.map(asItem).join("\n")}
                  className="cal-body"
                />
              ) : (
                <p className="cal-nothing">—</p>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** A student's: nothing at all until the teacher has posted a week. */
export function StudentCalendar({ text }: { text: string }) {
  if (!text) return null;
  return (
    <section className="class-calendar" data-testid="class-calendar">
      <Week text={text} />
    </section>
  );
}

export function TeacherCalendar({
  classId,
  text,
  others,
  onSaved,
}: {
  classId: number;
  text: string;
  others: { id: number; name: string }[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [also, setAlso] = useState<number[]>([]);
  const [state, setState] = useState("");
  const editing = draft !== null;
  const save = async (value: string) => {
    setState("Saving…");
    try {
      await api(`/api/classes/${classId}/calendar`, {
        json: { calendar: value, also },
      });
      setDraft(null);
      setAlso([]);
      setState("");
      onSaved();
    } catch (e) {
      setState(e instanceof Error ? e.message : String(e));
    }
  };
  const shown = editing ? draft : text;
  const empty =
    editing && draft.trim() !== "" && parseWeek(draft).days.length === 0;
  return (
    <section className="class-calendar" data-testid="class-calendar">
      <Week
        text={shown}
        extra={
          !editing && (
            <button
              className="btn small"
              onClick={() => setDraft(text)}
              data-testid="edit-calendar"
            >
              {text ? "Edit calendar" : "Add a calendar"}
            </button>
          )
        }
      />
      {!text && !editing && (
        <p className="muted small cal-hint">
          The week's to-do, shown at the top of the class's page. Paste it in as
          text — a line for each day, and the work under it.
        </p>
      )}
      {editing && (
        <div className="cal-edit">
          <textarea
            className="cal-box"
            rows={10}
            maxLength={20000}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="This week's calendar"
            placeholder={
              "Week of Oct 27\nMonday:\nLoops worksheet\nTuesday: Lab day\n- finish the platformer\nWednesday:\n…"
            }
            data-testid="calendar-text"
          />
          <p className="muted small">
            A line starting with a day (<code>Monday:</code>, <code>Tues</code>,{" "}
            <code>Fri 10/31:</code>) starts that day; the lines under it are its
            to-do. Anything above the first day is the title. Markdown works:
            **bold**, [a link](https://…).
          </p>
          {empty && (
            <p className="cal-problem small">
              No day found yet — start a line with a day's name, like{" "}
              <code>Monday:</code>
            </p>
          )}
          {others.length > 0 && (
            <fieldset className="cal-also">
              <legend className="small">Also post this week to</legend>
              {others.map((c) => (
                <label key={c.id} className="small">
                  <input
                    type="checkbox"
                    checked={also.includes(c.id)}
                    onChange={(e) =>
                      setAlso(
                        e.target.checked
                          ? [...also, c.id]
                          : also.filter((x) => x !== c.id),
                      )
                    }
                  />{" "}
                  {c.name}
                </label>
              ))}
            </fieldset>
          )}
          <div className="cal-actions">
            <button
              className="btn go"
              onClick={() => void save(draft)}
              data-testid="save-calendar"
            >
              Save
            </button>
            <button
              className="btn"
              onClick={() => {
                setDraft(null);
                setState("");
              }}
            >
              Cancel
            </button>
            <button
              className="btn cal-clear"
              onClick={() =>
                confirm("Take the calendar off the class's page?") &&
                void save("")
              }
            >
              Clear
            </button>
            <span className="muted small" role="status">
              {state}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
