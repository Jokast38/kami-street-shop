// Content synced from WordPress/WooCommerce sometimes ships <img> tags without an
// alt attribute. Search engines flag this as a missing-alt accessibility/SEO issue,
// so patch in a fallback alt (derived from the surrounding page title) before the
// HTML is injected via dangerouslySetInnerHTML.
export function withImageAlt(html, fallbackAlt) {
  if (!html) return "";
  const safeFallback = (fallbackAlt || "Kami Street").replace(/"/g, "&quot;");
  return html.replace(/<img((?:(?!alt=)[^>])*)>/gi, (match, attrs) => `<img${attrs} alt="${safeFallback}">`);
}
