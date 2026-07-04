import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

export default defineConfig({
  plugins: [react(), mcpPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack/react-query")) return "query";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("react-window")) return "vlist";
          if (id.includes("react-dom") || id.match(/[\\/]react[\\/]/)) return "react";
          return "vendor";
        },
      },
    },
  },
});
