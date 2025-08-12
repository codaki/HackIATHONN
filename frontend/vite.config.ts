import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Add the DigitalOcean host to allowed hosts
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "dreamteamfront-jraz2.ondigitalocean.app",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
