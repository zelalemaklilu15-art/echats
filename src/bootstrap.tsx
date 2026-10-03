import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { initNative } from "./lib/native";

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
