import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/ubuntu/500.css";
import "@fontsource/ubuntu/700.css";
import "@fontsource/ubuntu-mono/400.css";
import "../editor/app.css";
import "./player.css";
import { PlayerApp } from "./PlayerApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
);
