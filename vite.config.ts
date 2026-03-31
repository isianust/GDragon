import { defineConfig } from "vite";

/**
 * Default dev URL: http://127.0.0.1:5173/ (or next free port if 5173 is taken — see terminal output).
 * - strictPort: false avoids silent failure when another app already uses 5173.
 * - host: true: also listen on LAN for http://<your-PC-LAN-IP>:5173/
 */
export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: true,
  },
});
