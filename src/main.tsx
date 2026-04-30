import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Start prefetching calendar occupancy before React mounts
import "./lib/prefetch";

// Initialize Telegram Mini App
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

createRoot(document.getElementById("root")!).render(<App />);
