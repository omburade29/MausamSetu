import react from "@vitejs/plugin-react"
import fs from "node:fs"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"

const geojsonPlugin = {
  name: "geojson-loader",
  load(id: string) {
    if (id.endsWith(".geojson")) {
      return `export default ${fs.readFileSync(id, "utf-8")}`
    }
    return null
  },
}

export default defineConfig({
  plugins: [react(), geojsonPlugin],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@data": fileURLToPath(new URL("../data", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
    fs: {
      allow: [
        fileURLToPath(new URL(".", import.meta.url)),
        fileURLToPath(new URL("..", import.meta.url)),
      ],
    },
  },
})
