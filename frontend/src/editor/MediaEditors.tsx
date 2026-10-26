/**
 * The Sound and Font editors: choose a file (or a starter sound), hear or
 * see it, and copy the line of Python that uses it.
 *
 * Files are checked by what they really are (store/assetTypes.ts) before
 * they're kept, with the server's own limits, so a file accepted here is
 * never refused when the project saves.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { readAsset } from "../store/assetTypes";
import { find, newId, type SoundResource } from "../store/project";
import { STARTER_SOUNDS, starterSoundBlob } from "../store/starterSounds";
import { Icon } from "./ui/icons";
import { useProjectApi } from "./useProject";

/** One sound playing at a time in the editor: starting another stops it. */
let previewing: HTMLAudioElement | null = null;
function preview(blob: Blob, volume = 1) {
  previewing?.pause();
  const a = new Audio(URL.createObjectURL(blob));
  a.volume = volume;
  a.onended = () => URL.revokeObjectURL(a.src);
  void a.play().catch(() => undefined);
  previewing = a;
}

function useDuration(blob: Blob | undefined): number | null {
  const [d, setD] = useState<number | null>(null);
  useEffect(() => {
    setD(null);
    if (!blob) return;
    const a = new Audio();
    const url = URL.createObjectURL(blob);
    a.preload = "metadata";
    a.onloadedmetadata = () => setD(a.duration);
    a.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return d;
}

/** Copies a line of Python, with a moment of "Copied". */
function CopyLine({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="copy-line">
      <code>{code}</code>
      <button
        className="btn small"
        onClick={() => {
          void navigator.clipboard?.writeText(code);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function FilePick({ accept, label, onFile, testId }: { accept: string; label: string; onFile: (f: File) => void; testId: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="btn" onClick={() => input.current?.click()} data-testid={testId}>
        {Icon.plus()} {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </>
  );
}

export function SoundEditor({ soundId }: { soundId: string }) {
  const { project, assets, mutate, addAssets } = useProjectApi();
  const sound = find(project, "sounds", soundId);
  const [problem, setProblem] = useState<string | null>(null);
  const blob = sound?.asset ? assets.get(sound.asset) : undefined;
  const duration = useDuration(blob);
  if (!sound) return <div className="empty-pane">This sound was deleted.</div>;

  const set = (recipe: (s: SoundResource) => void, label: string) => mutate((p) => recipe(find(p, "sounds", soundId)!), { label });
  const use = async (b: Blob, label: string) => {
    const id = newId();
    await addAssets(new Map([[id, b]]));
    set((s) => void (s.asset = id), label);
    setProblem(null);
  };
  const choose = async (f: File) => {
    try {
      await use(await readAsset(f, "sound"), "choose a sound file");
    } catch (e) {
      setProblem((e as Error).message);
    }
  };

  return (
    <div className="media-editor pad" data-tutorial="sound-editor">
      <h2>{sound.name}</h2>
      {blob ? (
        <div className="row">
          <button className="btn" onClick={() => preview(blob, sound.volume)} data-testid="sound-play">
            {Icon.play()} Play
          </button>
          <button className="btn" onClick={() => previewing?.pause()}>
            {Icon.stop()} Stop
          </button>
          <span className="muted" data-testid="sound-info">
            {duration !== null && isFinite(duration) ? `${duration.toFixed(2)} s · ` : ""}
            {(blob.size / 1024).toFixed(0)} KB · {blob.type.replace("audio/", "").toUpperCase()}
          </span>
        </div>
      ) : (
        <p className="muted">No sound yet. Choose a file, or start from one of these.</p>
      )}
      <div className="row">
        <FilePick accept="audio/*,.mp3,.ogg,.wav" label={blob ? "Replace with a file" : "Choose a sound file"} onFile={(f) => void choose(f)} testId="sound-file" />
        <span className="muted small">MP3, OGG or WAV, up to 8 MB.</span>
      </div>
      {problem && (
        <p className="error-text" role="alert">
          {problem}
        </p>
      )}
      <label className="field">
        Volume
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={sound.volume}
          onChange={(e) => set((s) => void (s.volume = Number(e.target.value)), "change volume")}
          data-testid="sound-volume"
        />
        <span className="muted small">{Math.round(sound.volume * 100)}% — sound_play's own volume is multiplied by this.</span>
      </label>
      <h3>Starter sounds</h3>
      <ul className="starter-sounds">
        {STARTER_SOUNDS.map((s) => (
          <li key={s.key}>
            <button className="icon-btn" onClick={() => preview(starterSoundBlob(s.key))} aria-label={`Hear ${s.key}`}>
              {Icon.play()}
            </button>
            <b>{s.key}</b> <span className="muted">{s.describe}</span>
            <button className="btn small" onClick={() => void use(starterSoundBlob(s.key), `use the ${s.key} sound`)} data-testid={`starter-sound-${s.key}`}>
              Use
            </button>
          </li>
        ))}
      </ul>
      <h3>In Python</h3>
      <CopyLine code={`sound_play("${sound.name}")`} />
      <CopyLine code={`music_play("${sound.name}")`} />
    </div>
  );
}

export function FontEditor({ fontId }: { fontId: string }) {
  const { project, assets, mutate, addAssets } = useProjectApi();
  const font = find(project, "fonts", fontId);
  const [problem, setProblem] = useState<string | null>(null);
  const [sample, setSample] = useState("Score: 1234 — The quick brown fox");
  const blob = font?.asset ? assets.get(font.asset) : undefined;
  // The page's own copy, for the preview (the game loads its own in its worker).
  const family = useMemo(() => `preview-${fontId}-${font?.asset ?? "none"}`, [fontId, font?.asset]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!blob) return;
    let face: FontFace | null = null;
    void blob.arrayBuffer().then(async (data) => {
      try {
        face = new FontFace(family, data);
        await face.load();
        document.fonts.add(face);
        setReady(true);
      } catch {
        setProblem("This file couldn't be read as a font.");
      }
    });
    return () => void (face && document.fonts.delete(face));
  }, [blob, family]);
  if (!font) return <div className="empty-pane">This font was deleted.</div>;

  const choose = async (f: File) => {
    try {
      const b = await readAsset(f, "font");
      const id = newId();
      await addAssets(new Map([[id, b]]));
      mutate((p) => void (find(p, "fonts", fontId)!.asset = id), { label: "choose a font file" });
      setProblem(null);
    } catch (e) {
      setProblem((e as Error).message);
    }
  };

  return (
    <div className="media-editor pad" data-tutorial="font-editor">
      <h2>{font.name}</h2>
      <div className="row">
        <FilePick accept=".ttf,.otf,.woff,.woff2,font/*" label={blob ? "Replace with a file" : "Choose a font file"} onFile={(f) => void choose(f)} testId="font-file" />
        <span className="muted small">TTF, OTF, WOFF or WOFF2, up to 2 MB. Free game fonts: fonts.google.com, or search for "pixel font".</span>
      </div>
      {problem && (
        <p className="error-text" role="alert">
          {problem}
        </p>
      )}
      {blob && (
        <>
          <input className="font-sample-input" value={sample} onChange={(e) => setSample(e.target.value)} aria-label="Sample text" />
          <div className="font-samples" data-testid="font-preview" data-ready={ready ? "yes" : "no"}>
            {[12, 16, 24, 40].map((size) => (
              <div key={size} style={{ fontFamily: ready ? `"${family}"` : undefined, fontSize: size }}>
                <span className="muted small">{size}</span> {sample}
              </div>
            ))}
          </div>
        </>
      )}
      <h3>In Python</h3>
      <CopyLine code={`draw_set_font("${font.name}", 24)`} />
      <p className="muted small">Then draw_text uses it. draw_set_font() goes back to the built-in font.</p>
    </div>
  );
}
