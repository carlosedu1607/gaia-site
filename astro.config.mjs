import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: process.env.SITE_URL || "https://gaiaresidencia.com.br",
  output: "static",
  trailingSlash: "always",
  vite: {
    plugins: [tailwindcss()]
  }
});
