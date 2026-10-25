/**
 * Light or dark, remembered per browser. index.html applies the stored
 * choice before the first paint, so a light-theme student never sees a dark
 * flash on load.
 */
import { useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const flip = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("gameide.theme", next);
    } catch {
      /* just won't be remembered */
    }
  };
  return (
    <button className="icon-btn theme-toggle" onClick={flip} aria-label={theme === "light" ? "Dark theme" : "Light theme"} title={theme === "light" ? "Dark theme" : "Light theme"}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        {theme === "light" ? (
          <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />
        ) : (
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
          </>
        )}
      </svg>
    </button>
  );
}
