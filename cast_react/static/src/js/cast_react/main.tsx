import "vite/modulepreload-polyfill";
import "../../css/cast_react/shared.css";
import "../../css/cast_react/styles.css";
import "../../css/cast_react/pygments.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyColorScheme, readColorScheme } from "./colorScheme";
import { App } from "./components/App";
import { readConfig } from "./config";
import { startRouter } from "./router";

applyColorScheme(readColorScheme());

const container = document.getElementById("app");
if (container) {
  const config = readConfig();
  startRouter();
  createRoot(container).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  );
}
