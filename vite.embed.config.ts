import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Build config for the public embed widget (elkihome24.ru on Tilda).
 * Produces a self-contained static site in `dist-embed/` that is hosted
 * on GitHub + jsDelivr and loaded into a Tilda iframe.
 *
 *   npm run build:embed
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
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
