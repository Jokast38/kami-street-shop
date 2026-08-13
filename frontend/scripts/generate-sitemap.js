// Runs before `craco build`. The backend already exposes a live, DB-backed
// sitemap at GET /sitemap.xml (see backend/server.py). This CRA app is a static
// SPA deployed on Vercel with no server-side route of its own, so we can't proxy
// that at request time — instead we fetch it once at build time and bake the
// result into public/sitemap.xml so https://kamistreet.fr/sitemap.xml (referenced
// by robots.txt) actually resolves to something.
//
// Requires REACT_APP_BACKEND_URL to point at the real production backend during
// the Vercel build (not localhost). If it's unreachable, we fail soft with a
// minimal static-routes sitemap rather than breaking the deploy.
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const SITE_URL = "https://kamistreet.fr";
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const OUT_FILE = path.join(__dirname, "..", "public", "sitemap.xml");

const FALLBACK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE_URL}/shop</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${SITE_URL}/blog</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>
</urlset>
`;

function fetchText(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return resolve(fetchText(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });
}

async function main() {
  if (!BACKEND_URL) {
    console.warn("[sitemap] REACT_APP_BACKEND_URL non defini, sitemap minimal ecrit.");
    fs.writeFileSync(OUT_FILE, FALLBACK_XML, "utf-8");
    return;
  }
  try {
    const xml = await fetchText(`${BACKEND_URL.replace(/\/api\/?$/, "")}/sitemap.xml`);
    fs.writeFileSync(OUT_FILE, xml, "utf-8");
    console.log(`[sitemap] Recupere depuis le backend et ecrit dans ${OUT_FILE}`);
  } catch (err) {
    console.warn(`[sitemap] Echec recuperation backend (${err.message}), sitemap minimal ecrit.`);
    fs.writeFileSync(OUT_FILE, FALLBACK_XML, "utf-8");
  }
}

main();
