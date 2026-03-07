import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Telegram Mini App
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  // Request adding shortcut to home screen (native Telegram prompt, v8.0+)
  // Try multiple known method names for compatibility
  setTimeout(() => {
    try {
      if (typeof tg.addToHomeScreen === 'function') {
        tg.addToHomeScreen();
      } else if (typeof tg.requestAddToHomeScreen === 'function') {
        tg.requestAddToHomeScreen();
      } else {
        // Use postEvent for raw method call
        const postEvent = tg.postEvent || ((evt: string) => {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(JSON.stringify({ eventType: evt }), '*');
          }
        });
        postEvent('web_app_add_to_home_screen');
      }
    } catch (e) {
      console.warn('addToHomeScreen not supported', e);
    }
  }, 1000);
}

createRoot(document.getElementById("root")!).render(<App />);
