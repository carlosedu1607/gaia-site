import type { APIRoute } from "astro";
import pages from "../content/pages.json";

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin || "https://gaiaresidencia.com.br";
  const paths = ["/", ...pages.map((page) => `/${page.slug}/`), "/privacidade/"];
  const urls = paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
