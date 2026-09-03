import React, { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";

/**
 * Renders a category's products either grouped into sections by subcategory
 * (default) or filtered flat to a single subcategory once one is picked.
 * `parentSlug` is the category the products were fetched for (e.g. "accessoires");
 * products tagged only with that slug (no subcategory) land in "Autres".
 */
export default function SubcategoryProductGrid({ products, subcategories, parentSlug }) {
  const [activeSub, setActiveSub] = useState(null);

  const groups = useMemo(() => {
    const bySlug = new Map(subcategories.map(s => [s.slug, { ...s, products: [] }]));
    const others = [];
    for (const p of products) {
      const cats = p.categories || [];
      const sub = cats.find(c => bySlug.has(c));
      if (sub) bySlug.get(sub).products.push(p);
      else others.push(p);
    }
    const result = subcategories.map(s => bySlug.get(s.slug)).filter(g => g.products.length > 0);
    if (others.length > 0) result.push({ slug: parentSlug, name: "Autres accessoires", products: others });
    return result;
  }, [products, subcategories, parentSlug]);

  if (subcategories.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6" data-testid="category-product-grid">
        {products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
      </div>
    );
  }

  const visibleGroups = activeSub ? groups.filter(g => g.slug === activeSub) : groups;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-8 justify-center" data-testid="subcategory-filters">
        <Badge
          onClick={() => setActiveSub(null)}
          className={`cursor-pointer rounded-none ${!activeSub ? "bg-accent text-black" : "bg-secondary text-foreground"}`}
        >
          Tout
        </Badge>
        {groups.map(g => (
          <Badge
            key={g.slug}
            data-testid={`subcategory-filter-${g.slug}`}
            onClick={() => setActiveSub(g.slug)}
            className={`cursor-pointer rounded-none ${activeSub === g.slug ? "bg-accent text-black" : "bg-secondary text-foreground"}`}
          >
            {g.name} ({g.products.length})
          </Badge>
        ))}
      </div>

      <div className="space-y-12">
        {visibleGroups.map(group => (
          <div key={group.slug}>
            {!activeSub && (
              <h2 className="display text-xl font-bold uppercase tracking-widest mb-4 pb-2 border-b border-border">
                {group.name}
              </h2>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {group.products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
