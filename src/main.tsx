import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Telegram Mini App
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  // Request adding shortcut to home screen (native Telegram prompt)
  if (typeof tg.addToHomeScreen === 'function') {
    tg.addToHomeScreen();
  }
}

createRoot(document.getElementById("root")!).render(<App />);
