// Runs after `craco build` (see package.json "postbuild"). The SPA serves an
// empty shell until React mounts and fetches product data client-side, which
// means crawlers relying on the raw HTML response (product/category/blog
// pages) see none of the actual content. This script crawls every URL listed
// in the build-time sitemap.xml against the freshly built app (served
// locally), waits for the page to finish rendering, and writes the resulting
// HTML as a static <path>/index.html file in the build output. Vercel serves
// those static files for direct/first requests; once the JS bundle loads,
// React hydrates over them exactly as it does today, so nothing changes for
// real visitors.
const fs = require("fs");
const path = require("path");
const http = require("http");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const BUILD_DIR = path.join(__dirname, "..", "build");
const SITEMAP_FILE = path.join(BUILD_DIR, "sitemap.xml");
const PORT = 45123;
const SITE_URL = "https://kamistreet.fr";
const CONCURRENCY = 4;

function readSitemapPaths() {
  if (!fs.existsSync(SITEMAP_FILE)) {
    console.warn("[prerender] Pas de sitemap.xml dans build/, rien a prerendre.");
    return [];
  }
  const xml = fs.readFileSync(SITEMAP_FILE, "utf-8");
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  return locs
    .map((loc) => {
      try {
        return new URL(loc).pathname;
      } catch {
        // FRONTEND_URL on the backend is missing its https:// scheme, so loc
        // is something like "kami-street-shop-z5ac.vercel.app/blog/x" rather
        // than a full URL. Retry with a scheme prepended instead of using
        // the raw string, which isn't a valid path either.
        try {
          return new URL(`https://${loc}`).pathname;
        } catch {
          return null;
        }
      }
    })
    .filter((p) => p && p !== "/" && p !== null);
}

function serveBuildDir() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    let filePath = path.join(BUILD_DIR, urlPath);
    if (urlPath === "/" || !path.extname(urlPath)) {
      filePath = path.join(BUILD_DIR, "index.html");
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(path.join(BUILD_DIR, "index.html"), (err2, fallback) => {
          if (err2) {
            res.writeHead(404);
            return res.end("Not found");
          }
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(fallback);
        });
        return;
      }
      res.writeHead(200);
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function prerenderPath(browser, urlPath) {
  const page = await browser.newPage();
  try {
    await page.goto(`http://localhost:${PORT}${urlPath}`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    // Product/category/blog pages fetch their data async; give react-helmet-async
    // a tick after the network settles to flush the <head> tags it injects.
    await new Promise((r) => setTimeout(r, 300));
    const html = await page.content();
    const outDir = path.join(BUILD_DIR, urlPath);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");
    console.log(`[prerender] OK   ${urlPath}`);
  } catch (err) {
    console.warn(`[prerender] FAIL ${urlPath}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function runPool(items, worker, concurrency) {
  let i = 0;
  async function next() {
    const idx = i++;
    if (idx >= items.length) return;
    await worker(items[idx]);
    await next();
  }
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  const paths = readSitemapPaths();
  if (paths.length === 0) return;

  console.log(`[prerender] ${paths.length} pages a prerendre...`);
  const server = await serveBuildDir();
  // Vercel's build image lacks the shared libs a plain downloaded Chrome needs
  // (libnspr4.so etc.), so on Linux CI we use @sparticuz/chromium's
  // purpose-built serverless binary. Locally (Windows/Mac dev machines) that
  // binary won't run, so fall back to whatever Chrome is already installed.
  const launchOptions =
    process.platform === "linux"
      ? {
          headless: true,
          executablePath: await chromium.executablePath(),
          args: chromium.args,
        }
      : { headless: true, channel: "chrome" };
  const browser = await puppeteer.launch(launchOptions);

  try {
    await runPool(paths, (p) => prerenderPath(browser, p), CONCURRENCY);
  } finally {
    await browser.close();
    server.close();
  }
  console.log("[prerender] Termine.");
}

main().catch((err) => {
  console.error("[prerender] Erreur fatale, build conserve tel quel:", err);
  process.exit(0); // fail soft: never break the deploy because of prerendering
});
