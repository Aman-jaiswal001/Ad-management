import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const env = loadEnv(mode, process.cwd(), '')
const apiUrl = env.VITE_API_URL


export default defineConfig({
  
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": apiUrl || "http://localhost:5000",
    },
  },
});
