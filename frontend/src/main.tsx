import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./editor/App";
import "./editor/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
