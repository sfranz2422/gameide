/**
 * The front door, laid out after gdevelop.io's: a big promise and a button
 * to start, games people made, the ways to write one, what an engine
 * gives you, how sharing works, and a last call to start — in GameIDE's own
 * fonts and colours. Everything said here is something GameIDE does now.
 *
 * The pictures (public/home/) are screenshots of GameIDE itself, made by
 * e2e/home-images.editor.spec.ts; run it again when the editor changes.
 */
import { useEffect, useState } from "react";
import { api } from "../store/api";
import { useSession } from "./session";
import { SiteNav } from "./SiteNav";

interface Card {
  id: string;
  title: string;
  author: string;
  plays: number;
  thumbnail: boolean;
}

const FEATURES: [string, string][] = [
  ["Sprites and animation", "Import your own art, slice sprite sheets, set origins and collision masks — or start from ready-made sprites."],
  ["Levels from tiles", "Paint levels from tilesets, with solid tiles for floors and walls and autotiling that picks edges and corners."],
  ["Rooms and cameras", "Drag objects into rooms, add layers and backgrounds, and give each room a camera that follows the player and shakes."],
  ["Sound and music", "Sound effects and music from your own files, or starter sounds made for games."],
  ["Gamepads and saves", "Up to four gamepads, plus save files for high scores and progress between plays."],
  ["Real Python", "Every game is Python underneath — the same language students go on to use everywhere else."],
];

const WAYS: { title: string; img: string; text: string }[] = [
  { title: "Python", img: "home/python.jpg", text: "Write each event in Python, with autocomplete, and errors that point to the exact line that went wrong." },
  { title: "Code blocks", img: "home/blocks.jpg", text: "Snap blocks together, Scratch-style. The Python they make is shown beside them, and one click turns them into Python." },
  { title: "Event sheets", img: "home/sheet.jpg", text: "Rows of conditions and actions, GDevelop-style — with the Python beside them too, so the step to code is a small one." },
];

export function HomePage() {
  const { me } = useSession();
  const [games, setGames] = useState<Card[]>([]);
  useEffect(() => {
    void api<{ games: Card[] }>("/api/explore?sort=popular").then(
      (r) => setGames(r.games.slice(0, 4)),
      () => undefined, // no server (the editor on its own): no games to show
    );
  }, []);
  // Straight to making a game: signing in only adds things (an account to
  // keep games in), never a gate in front of starting one.
  const start = "#/games";

  return (
    <div className="site-page home">
      <SiteNav at="home" />
      <main>
        <section className="hero">
          <div className="hero-text">
            <h1>
              Make your own game.
              <br />
              <span className="hero-accent">Code it in real Python.</span>
            </h1>
            <p className="hero-sub">
              GameIDE is a game engine for the classroom. Draw your sprites, paint your levels, and write what happens — in Python, with
              code blocks, or as event sheets. Then share it with your class, or the whole web.
            </p>
            <div className="hero-buttons">
              <a className="btn big go" href={start} data-testid="home-start">
                Start your game now
              </a>
              <a className="btn big blue" href="#/explore">
                Explore games
              </a>
            </div>
          </div>
          <div className="hero-art">
            <img src="home/hero.jpg" alt="The GameIDE editor, with a platformer game running beside its Python code" />
          </div>
        </section>

        {games.length > 0 && (
          <section className="home-section">
            <h2>Games made with GameIDE</h2>
            <div className="home-games">
              {games.map((g) => (
                <a key={g.id} className="home-game" href={`/play/${g.id}`}>
                  {g.thumbnail ? <img src={`/api/play/${g.id}/thumbnail`} alt="" loading="lazy" /> : <div className="game-card-blank">▶</div>}
                  <b>{g.title}</b>
                  <span className="muted small">
                    by {g.author} · {g.plays} plays
                  </span>
                </a>
              ))}
            </div>
            <a href="#/explore">See all the games →</a>
          </section>
        )}

        <section className="home-section">
          <h2>
            Three ways to write a game. <span className="hero-accent">One language underneath.</span>
          </h2>
          <div className="home-ways">
            {WAYS.map((w) => (
              <div key={w.title} className="home-way">
                <img src={w.img} alt={`${w.title} in GameIDE`} loading="lazy" />
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="home-section">
          <h2>Everything a game needs</h2>
          <div className="home-features">
            {FEATURES.map(([title, text]) => (
              <div key={title} className="home-feature">
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="home-section home-share">
          <div>
            <h2>Share what you make</h2>
            <p>
              Publish a game with one button and it gets its own page to play: for anyone with the link, for your class, or for everyone on
              Explore once your teacher approves it. Others can play it, like it, and remix it into a game of their own.
            </p>
          </div>
          <div>
            <h2>Take it anywhere</h2>
            <p>
              Export a finished game as a web page that runs on itch.io or any website, or as a project to open again later. Games run in
              the browser — on a Chromebook too — with nothing to install.
            </p>
          </div>
          <div>
            <h2>Made for classrooms</h2>
            <p>
              Sign in with your school Google account and your games are saved to it. Teachers approve what goes public, and a game's page
              never shows a student's email.
            </p>
          </div>
        </section>

        <section className="home-cta">
          <h2>{me.user ? "Your games are waiting." : "Start making your game."}</h2>
          <a className="btn big go" href={start}>
            {me.user ? "Go to my games" : "Start your game now"}
          </a>
        </section>
      </main>
      <footer className="site-footer">
        <span className="site-logo small">
          <span className="site-logo-game">Game</span>
          <span className="site-logo-ide">IDE</span>
        </span>
        <a href="#/explore">Explore</a>
        <a href="#/games">My games</a>
      </footer>
    </div>
  );
}
