import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig, loadEnv } from "vite";
// @ts-expect-error Vite loads this server-only JavaScript module at config time.
import { createDataMiddleware } from "./server/data-api.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwindcss(),
      tanstackRouter({ target: "react" }),
      react(),
      {
        name: "time-blossom-data-api",
        configureServer(server) {
          server.middlewares.use("/api/data", createDataMiddleware(env));
        },
      },
    ],
  };
});
