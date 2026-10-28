/**
 * #/docs — the editor's Docs tab as a page of its own, from the bar at the
 * top of the site: every function and instance property, searchable, to
 * read with no game open (or on a second screen beside one). There is no
 * code here to type into, so a click copies the entry instead.
 */
import { useState } from "react";
import { DocsPane } from "./RunPanes";
import { SiteNav } from "./SiteNav";

export function DocsPage() {
  const [copied, setCopied] = useState("");
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => setCopied(text),
      () => setCopied(""),
    );
  };
  return (
    <div className="site-page">
      <SiteNav at="docs" />
      <main className="explore-page docs-page" data-testid="docs-page">
        <header className="page-head">
          <h1>Docs</h1>
          <p className="muted">
            Every function your game can call, and what <code>self</code> has. Click one to copy it.
            {copied && (
              <span className="docs-copied" role="status">
                {" "}Copied <code>{copied}</code>
              </span>
            )}
          </p>
        </header>
        <DocsPane pick={copy} hint="Click to copy it" />
      </main>
    </div>
  );
}
