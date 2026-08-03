import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import SEO from "@/components/SEO";

// WooCommerce category descriptions are raw HTML with their own inline styles (often
// text-align:center, sometimes a duplicate <h1>). Strip that out so it doesn't fight
// with the page's own layout, which is what caused the misaligned/offset look.
function sanitizeCategoryHtml(html) {
  if (!html) return "";
  return html
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/<h1(\s[^>]*)?>/gi, "<h2>")
    .replace(/<\/h1>/gi, "</h2>");
}

export default function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api.get(`/categories/${slug}`)
      .then(r => setCategory(r.data))
      .catch(() => setNotFound(true));
    api.get("/products", { params: { category: slug, limit: 100 } })
      .then(r => setProducts(r.data))
      .finally(() => setLoading(false));
  }, [slug]);

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="display text-2xl font-black mb-4">Catégorie introuvable</h1>
        <Link to="/shop" className="cta-primary px-6 py-3 inline-block">Voir la boutique</Link>
      </div>
    );
  }

  const metaDescription = category?.description
    ? category.description.replace(/<[^>]+>/g, "").trim().slice(0, 160)
    : `Découvrez la sélection ${category?.name || ""} chez Kami Street.`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {category && (
        <SEO
          title={category.name}
          description={metaDescription}
          path={`/product-category/${slug}`}
        />
      )}

      <div className="mb-10 text-center max-w-3xl mx-auto">
        <div className="text-xs uppercase tracking-[0.3em] text-black dark:text-accent mb-2">// Catalog</div>
        <h1 className="display text-3xl sm:text-4xl md:text-5xl font-black break-words" data-testid="category-title">
          {category?.name || "Catégorie"}
        </h1>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Chargement...</div>
      ) : products.length === 0 ? (
        <div className="p-16 border border-dashed text-center text-muted-foreground">
          Aucun produit dans cette catégorie pour le moment.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6" data-testid="category-product-grid">
            {products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
          </div>
          {category?.description && (
            <div className="max-w-4xl mx-auto mt-10 pt-10 border-t border-border">
              <div
                className="category-description prose-ks text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeCategoryHtml(category.description) }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
