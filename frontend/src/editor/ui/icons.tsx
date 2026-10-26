/** Small inline icons, so the IDE needs no icon library. 16 px, currentColor. */
import type { ReactNode } from "react";

const svg = (children: ReactNode, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const Icon = {
  play: () => svg(<path d="M4 2.5v11l9-5.5z" fill="currentColor" stroke="none" />),
  stop: () => svg(<rect x="3.5" y="3.5" width="9" height="9" rx="1" fill="currentColor" stroke="none" />),
  restart: () => svg(<><path d="M13 8a5 5 0 1 1-1.5-3.6" /><path d="M13 2.5v3h-3" /></>),
  sprite: () => svg(<><rect x="2" y="2" width="12" height="12" rx="2" /><circle cx="6" cy="6.5" r="1.3" /><path d="M2.5 12l3.5-3.5 2.5 2.5 2-2 3 3" /></>),
  object: () => svg(<><path d="M8 1.8l5.5 3v6.4L8 14.2l-5.5-3V4.8z" /><path d="M2.5 4.8L8 8l5.5-3.2M8 8v6.2" /></>),
  room: () => svg(<><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6.5h12M6 6.5V13" /></>),
  script: () => svg(<><path d="M5.5 4.5L2.5 8l3 3.5M10.5 4.5l3 3.5-3 3.5" /></>),
  sound: () => svg(<><path d="M3 6h2.5L9 3v10L5.5 10H3z" /><path d="M11.5 5.5a3.5 3.5 0 0 1 0 5" /></>),
  font: () => svg(<><path d="M3 13 7.5 3h1L13 13" /><path d="M5 9h6" /></>),
  tileset: () => svg(<><rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" /><rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" /></>),
  settings: () => svg(<><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" /></>),
  plus: () => svg(<path d="M8 3v10M3 8h10" />),
  trash: () => svg(<><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9" /></>),
  close: () => svg(<path d="M4 4l8 8M12 4l-8 8" />),
  more: () => svg(<><circle cx="3.5" cy="8" r=".9" fill="currentColor" /><circle cx="8" cy="8" r=".9" fill="currentColor" /><circle cx="12.5" cy="8" r=".9" fill="currentColor" /></>),
  chevron: (open: boolean) => svg(<path d={open ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"} />),
  notes: () => svg(<><path d="M4 2.5h8v11H4z" /><path d="M6 5.5h4M6 8h4M6 10.5h2.5" /></>),
  docs: () => svg(<><path d="M3 2.5h7l3 3v8H3z" /><path d="M10 2.5v3h3M5.5 8.5h5M5.5 11h5" /></>),
  console: () => svg(<><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M4.5 6.5l2 1.5-2 1.5M8 10h3.5" /></>),
  bug: () => svg(<><rect x="5" y="5" width="6" height="8" rx="3" /><path d="M8 5V3.5M5 8H2.5M13.5 8H11M5 11l-2 1.5M11 11l2 1.5M5.5 5.5L4 4M10.5 5.5L12 4" /></>),
  home: () => svg(<path d="M2.5 7.5L8 3l5.5 4.5V13h-4V9.5h-3V13h-4z" />),
  code: () => svg(<><path d="M5.5 4.5L2.5 8l3 3.5M10.5 4.5l3 3.5-3 3.5M9 3l-2 10" /></>),
  clear: () => svg(<><circle cx="8" cy="8" r="5.5" /><path d="M4.2 11.8l7.6-7.6" /></>),
  search: (size = 16) => svg(<><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l3.5 3.5" /></>, size),
  create: (size = 16) => svg(<><path d="M5.5 4.5L2.5 8l3 3.5M10.5 4.5l3 3.5-3 3.5M9 3l-2 10" /></>, size),
  classes: (size = 16) => svg(<><circle cx="5.5" cy="5.5" r="2" /><circle cx="11" cy="6" r="1.7" /><path d="M1.8 13c.4-2.4 1.9-3.8 3.7-3.8s3.3 1.4 3.7 3.8M9.6 9.6c.4-.3.9-.4 1.4-.4 1.5 0 2.7 1.2 3 3.4" /></>, size),
  approve: (size = 16) => svg(<><path d="M3 8.5l3 3 7-7" /></>, size),
  docsBig: (size = 16) => svg(<><path d="M2 3.5c2-1 4-1 6 .5 2-1.5 4-1.5 6-.5v9c-2-1-4-1-6 .5-2-1.5-4-1.5-6-.5z" /><path d="M8 4v9" /></>, size),
  upload: () => svg(<><path d="M8 11V3M4.5 6.5L8 3l3.5 3.5M3 13h10" /></>),
  download: () => svg(<><path d="M8 3v8M4.5 7.5L8 11l3.5-3.5M3 13h10" /></>),
  copy: () => svg(<><rect x="5" y="5" width="8.5" height="8.5" rx="1" /><path d="M3 10.5V3.5a1 1 0 0 1 1-1h6.5" /></>),
};
