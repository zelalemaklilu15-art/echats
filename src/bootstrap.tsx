import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { initNative } from "./lib/native";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/cinzel/600.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("React root element #root was not found in index.html");
}

createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// No-op in the browser; sets up back button, status bar and push on Android.
initNative().catch((e) => console.warn("native init failed", e));
