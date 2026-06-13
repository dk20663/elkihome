import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Build config for the public embed widget (elkihome24.ru on Tilda).
 * Produces a self-contained static site in `dist-embed/` that is hosted
 * on GitHub + jsDelivr and loaded into a Tilda iframe.
 *
 *   npm run build:embed
 *
 * ВАЖНО: PROXY_URL — Cloudflare Worker-прокси для Supabase.
 * Нужен, чтобы виджет открывался в РФ без VPN (домен *.supabase.co
 * заблокирован РКН). Деплой воркера: см. cloudflare-worker/README.md.
 *
 * После деплоя замени значение PROXY_URL на свой Worker-URL и пересобери.
 * Если оставить пустую строку — embed будет ходить напрямую в Supabase
 * (работает с VPN или вне РФ).
 */
const PROXY_URL = ""; // пример: "https://elkihome-proxy.dk20663.workers.dev"

const SUPABASE_URL_FOR_EMBED =
  PROXY_URL || "https://hpfurpylorcuvcoevpsl.supabase.co";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Подменяем только для embed-сборки. Админка и основной build не затронуты.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL_FOR_EMBED),
  },
  build: {
    outDir: "dist-embed",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "embed.html"),
    },
  },
  base: "./",
});
