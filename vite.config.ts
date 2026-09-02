import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig, loadEnv } from "vite";
import { createDataMiddleware } from "./server/data-api.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwindcss(),
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      {
        name: "watchtag-data-api",
        configureServer(server) {
          server.middlewares.use("/api/data", createDataMiddleware(env));
        },
      },
    ],
  };
});
