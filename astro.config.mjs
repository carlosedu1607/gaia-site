import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: process.env.SITE_URL || "https://gaiaresidenciaparaidosos.com.br",
  output: "static",
  trailingSlash: "always",
  vite: {
    plugins: [tailwindcss()]
  }
});
