import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../editor/app.css";
import "./player.css";
import { PlayerApp } from "./PlayerApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
);
