import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// BASE_PATH=/human_no_bar/ khi build cho GitHub Pages (xem .github/workflows/deploy.yml)
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
  },
});
