import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": "http://localhost:10000", // Proxy solo en desarrollo
      },
    },
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(
        mode === "production"
          ? "https://vbodegas.onrender.com" // Backend en Render
          : "http://localhost:10000"        // Localhost para desarrollo
      ),
    },
  };
});