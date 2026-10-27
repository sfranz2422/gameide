/**
 * #/help/checks — everything that can go in an assignment's notes: slides,
 * questions (PyIDE's formats, the same in every editor) and the checks a
 * game can be tested with. Each example here is real: notes.test.ts reads
 * every one, so a check listed here is one GameIDE knows.
 */
import { SiteNav } from "../editor/SiteNav";
import { TARGETS } from "../tutorials/tutorial";

export const CHECK_EXAMPLES: [string, string][] = [
  ["object Player exists", "Also sprite, room, sound, font, script and tileset."],
  ["Player has sprite", "The object has a sprite chosen."],
  ["Player has event step", "The event's name as the editor shows it: create, step, draw, collision with Coin, key pressed: space, alarm 0…"],
  ["Player.step uses keyboard_check", "The word is in that event's code (blocks and event sheets count: they make code too)."],
  ["Player.step is written in blocks", "How the event is written: in blocks, in Python, or in an event sheet."],
  ["Player uses move_and_collide", "Anywhere in that object's events."],
  ["uses for", "Anywhere in the game. Python words work: for, while, if, def, return."],
  ["avoids instance_destroy", "The word appears nowhere in the game."],
  ["room Level1 has 3 Coin", "Exactly 3 Coins placed in that room; or room Level1 has at least 3 Coin."],
  ["game runs 2 seconds without errors", "Plays the game for 2 seconds."],
  ["after 1 second holding right, Player.x increased", "Plays it holding keys (right and up, space…); also decreased, changed, stayed the same."],
  ['after 2 seconds, instance_number("Coin") < 15', "Any Python that should come out true after that long."],
];

const QUESTIONS = `\`\`\`quiz
Which function says whether a key is held down?
- [x] keyboard_check
- [ ] keyboard_check_pressed
points: 2
\`\`\`

\`\`\`quiz
What do you call a picture with several frames?
answer: sprite
answer: a sprite
\`\`\`

\`\`\`quiz
type: blank
To move right, add to [[x|self.x]]; to fall, add to [[y|self.y]].
\`\`\`

\`\`\`quiz
type: match
Match each event to when it runs.
- Create -> once, when the instance appears
- Step -> every frame
option: when the game ends
\`\`\`

\`\`\`quiz
type: long
Describe how your game gets harder as it goes on.
points: 5
\`\`\`

\`\`\`quiz
type: order
Put the lines in order so the player moves right.
- def on_step(self):
-     if keyboard_check("right"):
-         self.x += 4
\`\`\`

\`\`\`quiz
type: bug
Which line stops this event from running?
~~~python
if keyboard_check("space")
    self.vspeed = -8
~~~
bug: 1
\`\`\`

\`\`\`quiz
type: predict
What does x end up as?
~~~python
x = 3
x += 2
print(x * 2)
~~~
answer: 10
\`\`\`

\`\`\`quiz
type: sort
Sort each into events and functions.
group: Event
- Create
- Step
group: Function
- instance_create
- keyboard_check
\`\`\``;

const EXTRAS = `- [ ] Make the player move
- [ ] Add a coin
- [x] Open the game

\`\`\`cards
sprite -> a picture, with frames
object -> a thing in the game, with code
room -> where the game happens
\`\`\``;

export const ANIMATED = `animate: words

## Step 1
An object can ^ move itself.

...

Put this in its step event:
\`\`\`python
x += 2
\`\`\`

...

:::pop
Press Check my work in the Notes tab.
:::`;

export function HelpPage() {
  return (
    <div className="site-page">
      <SiteNav at="classes" />
      <main className="explore-page class-page help-page">
        <header className="page-head">
          <h1>What notes can hold</h1>
        </header>
        <p>
          An assignment's notes are markdown. A line of <code>---</code> on its own starts a new slide. Students read them in the editor's <b>Notes</b> tab, beside
          Console and Docs, while they work on their game.
        </p>
        <h2>Questions</h2>
        <p>
          The same formats as PyIDE, WebIDE and FlaskIDE. One try each, marked at once; the points go on top of your score. The answers are taken out before
          the notes reach a student. <code>[x]</code> marks the right choice; <code>answer:</code> lines are accepted short answers (case and spacing don't
          matter); <code>[[a|b]]</code> is a blank with its accepted answers; <code>type: match</code> pairs with <code>{"->"}</code>; <code>type: long</code> is
          marked by you on the assignment's page. <code>type: order</code> gives lines (each after <code>- </code>, in the right order) shuffled, to put back
          in order; <code>type: bug</code> asks which line of the code in a <code>~~~</code> fence is wrong (<code>bug: 2</code>);{" "}
          <code>type: sort</code> has a <code>group:</code> line for each group with its items under it. Order and sort give part marks.{" "}
          <code>type: predict</code> asks what the code in its <code>~~~</code> fence prints: <code>answer:</code> is the output, compared like a short
          answer (line breaks don't count), and once a student has answered they're shown what it prints.{" "}
          <code>points:</code> is 1 if left out.
        </p>
        <pre className="help-example">{QUESTIONS}</pre>
        <h2 id="extras">Checklists and flip cards</h2>
        <p>
          Not questions: nothing is marked or sent. <code>- [ ]</code> at the start of a list item is a box students tick — kept in their browser, for them
          (<code>- [x]</code> starts ticked). A <code>```cards</code> block is a card a line, <code>front {"->"} back</code>; a click turns one over.
        </p>
        <pre className="help-example">{EXTRAS}</pre>
        <h2 id="animate">Playing a slide a part at a time</h2>
        <p>
          Put <code>animate: words</code> as the notes' first line, and students get <b>▶ Play</b> above them. Each press plays the next part of the slide, word
          by word — <code>animate: type</code> types it out letter by letter instead. A line with only <code>...</code> on it divides a slide into the parts it's
          played in; a slide with none plays in one go. Too quick or too slow? Add a speed: <code>animate: words slow</code>,{" "}
          <code>animate: type fast</code>, or just <code>animate: slow</code> — without one it's <code>normal</code>. A <code>^</code> on its own (spaces round it, or a line to
          itself) pauses there about a second before the rest comes in by itself; <code>^^</code> waits twice as long. A <code>^</code> in code is left alone. Wrap anything that should stand out in <code>:::pop</code> and <code>:::</code> lines: it arrives with a
          little pop, and stays in a highlighted box. Nothing else pops.
        </p>
        <p>
          The next slide's arrow waits until the slide has been played. Slides already played show whole, so going back replays nothing, and the notes reopen
          where the student got to. When you open the assignment yourself they play too, with <b>⏭ Skip</b>, and <b>↺ Replay</b> to watch a slide again after you change it — students get neither.
        </p>
        <pre className="help-example">{ANIMATED}</pre>
        <h2 id="checks">Checks</h2>
        <p>
          A <code>```tests</code> block holds checks, one per line, that the student's game must pass. Students press <b>Check my work</b> in the Notes tab — the
          checks that play the game play it in their game pane — and you press <b>Check all</b> on the assignment's page, which checks what each student turned in
          and is the result that counts. Add <code>(2 points)</code> at the end of a line to make it worth more than 1.
        </p>
        <h2 id="spotlights">Spotlights</h2>
        <p>
          A line <code>highlight: add-event</code> on a slide (or a tutorial's step) puts a pulsing ring round that part of the editor while the slide is open.
          It never blocks a click, and goes at the first one. It points at what's on screen: if the part isn't open (a tab not chosen), there's no ring, so say
          where it is too. The names, with <code>*</code> standing for a resource's or a folder's name (<code>add-sprites</code>,{" "}
          <code>resource-player</code>, <code>object-sprite</code>):
        </p>
        <p className="help-targets" data-testid="help-targets">
          {TARGETS.map((t) => (
            <code key={t}>{t}</code>
          ))}
        </p>
        <h2>Every check</h2>
        <table className="mod-table">
          <tbody>
            {CHECK_EXAMPLES.map(([line, what]) => (
              <tr key={line}>
                <td>
                  <code>{line}</code>
                </td>
                <td className="muted small">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
