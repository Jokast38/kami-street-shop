import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";
import { SiKlarna } from "react-icons/si";
import { usePaymentMethods } from "@/context/PaymentMethodsContext";

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [category, setCategory] = useState(null);
  const [brand, setBrand] = useState(null);
  const [search, setSearch] = useState("");
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [loading, setLoading] = useState(true);
  const { klarna } = usePaymentMethods();

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = {};
    if (category) params.category = category;
    if (brand) params.brand = brand;
    if (search) params.search = search;
    if (priceRange[0] > 0) params.min_price = priceRange[0];
    if (priceRange[1] < 5000) params.max_price = priceRange[1];
    api.get("/products", { params }).then(r => setProducts(r.data)).finally(() => setLoading(false));
  }, [category, brand, search, priceRange]);

  useEffect(() => {
    api.get("/categories").then(r => setCategories(r.data));
    api.get("/brands").then(r => setBrands(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <SEO
        title="Boutique Fatbikes & Trottinettes Électriques"
        description="Découvrez toute la gamme Kami Street : fatbikes, scooters et trottinettes électriques. Filtrez par prix et catégorie, livraison 48h partout en France."
        path="/shop"
      />
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">// Catalog</div>
        <h1 className="display text-4xl md:text-5xl font-black" data-testid="shop-title">Boutique</h1>
      </div>

      {klarna && (
        <div className="flex items-center gap-3 border border-accent/40 bg-accent/10 px-5 py-3 mb-8" data-testid="klarna-shop-banner">
          <SiKlarna className="w-6 h-6 shrink-0" style={{ color: "#FFB3C7" }} />
          <span className="text-sm font-semibold">
            Payez en 3x sans frais avec Klarna, disponible sur tous nos produits.
          </span>
        </div>
      )}

      <div className="grid md:grid-cols-[240px_1fr] gap-8">
        <aside className="space-y-6">
          <div>
            <div className="text-sm uppercase tracking-widest font-bold mb-3">Recherche</div>
            <Input data-testid="shop-search" placeholder="Chercher..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchData()} className="rounded-none" />
          </div>
          <div>
            <div className="text-sm uppercase tracking-widest font-bold mb-3">Prix (€)</div>
            <Slider value={priceRange} min={0} max={5000} step={10} onValueChange={setPriceRange} />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{priceRange[0]}€</span><span>{priceRange[1]}€</span>
            </div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-widest font-bold mb-3">Catégories</div>
            <div className="flex flex-wrap gap-2">
              <Badge onClick={() => setCategory(null)} className={`cursor-pointer rounded-none ${!category ? "bg-accent text-black" : "bg-secondary text-foreground"}`}>Tout</Badge>
              {categories.map(c => (
                <Badge key={c.id} data-testid={`filter-cat-${c.slug}`} onClick={() => setCategory(c.slug)} className={`cursor-pointer rounded-none ${category === c.slug ? "bg-accent text-black" : "bg-secondary text-foreground"}`}>
                  {c.name}
                </Badge>
              ))}
            </div>
          </div>
          {brands.length > 0 && (
            <div>
              <div className="text-sm uppercase tracking-widest font-bold mb-3">Marques</div>
              <div className="flex flex-wrap gap-2">
                <Badge onClick={() => setBrand(null)} className={`cursor-pointer rounded-none ${!brand ? "bg-accent text-black" : "bg-secondary text-foreground"}`}>Toutes</Badge>
                {brands.map(b => (
                  <Badge key={b.id} data-testid={`filter-brand-${b.slug}`} onClick={() => setBrand(b.slug)} className={`cursor-pointer rounded-none ${brand === b.slug ? "bg-accent text-black" : "bg-secondary text-foreground"}`}>
                    {b.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div>
          {loading ? (
            <div className="text-muted-foreground">Chargement...</div>
          ) : products.length === 0 ? (
            <div className="p-16 border border-dashed text-center text-muted-foreground">
              Aucun produit. Synchronisez WooCommerce depuis le dashboard admin.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6" data-testid="product-grid">
              {products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
