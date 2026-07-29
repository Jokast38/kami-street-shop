import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/CartContext";
import { ShoppingBag, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import SEO, { SITE_URL } from "@/components/SEO";

export default function ProductDetail() {
  const { slug } = useParams();
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(1);
  const [selVar, setSelVar] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const { addItem } = useCart();

  useEffect(() => {
    api.get(`/products/${slug}`).then(r => setP(r.data));
  }, [slug]);

  if (!p) return <div className="p-12 text-center text-muted-foreground">Chargement...</div>;

  const currentPrice = selVar ? selVar.price : (p.sale_price || p.price);
  const images = p.images?.length ? p.images : ["https://images.unsplash.com/photo-1721637686340-de9f8cebda5a?w=800"];

  const shortDesc = p.short_description || (p.description || "").slice(0, 150);
  const metaDescription = `${p.name} au meilleur prix chez Kami Street : ${currentPrice.toFixed(2)} €. ${shortDesc}`.slice(0, 160);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": p.name,
    "description": p.short_description || p.description || p.name,
    "image": images,
    "sku": p.id,
    "offers": {
      "@type": "Offer",
      "url": `${SITE_URL}/product/${p.slug}`,
      "priceCurrency": "EUR",
      "price": currentPrice,
      "availability": (p.stock || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  const handleAdd = () => {
    addItem({
      product_id: p.id,
      variation_id: selVar?.id || null,
      name: p.name + (selVar ? ` — ${selVar.name}` : ""),
      price: currentPrice,
      quantity: qty,
      image: selVar?.image || images[0],
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-12">
      <SEO
        title={p.name}
        description={metaDescription}
        path={`/product/${p.slug}`}
        image={images[0]}
        type="product"
        jsonLd={productJsonLd}
      />
      <div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="aspect-square bg-secondary overflow-hidden border border-border">
          <img src={images[activeImg]} alt={p.name} className="w-full h-full object-cover" />
        </motion.div>
        {images.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {images.map((im, i) => (
              <button key={i} onClick={() => setActiveImg(i)} className={`w-16 h-16 sm:w-20 sm:h-20 shrink-0 border ${activeImg === i ? "border-accent" : "border-border"}`}>
                <img src={im} alt={`${p.name} — vue ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">{p.categories?.[0] || "Kami Street"}</div>
        <h1 className="display text-3xl md:text-4xl font-black mb-4" data-testid="product-title">{p.name}</h1>
        <div className="flex items-center gap-3 mb-6">
          {p.sale_price && <span className="text-muted-foreground line-through">{p.price.toFixed(2)} €</span>}
          <span className="display text-3xl font-black text-accent" data-testid="product-price">{currentPrice.toFixed(2)} €</span>
        </div>
        {p.short_description && <p className="text-muted-foreground mb-6">{p.short_description}</p>}

        {p.variations?.length > 0 && (
          <div className="mb-6">
            <div className="text-sm uppercase tracking-widest font-bold mb-3">Variantes</div>
            <div className="flex flex-wrap gap-2">
              {p.variations.map(v => (
                <Badge
                  key={v.id}
                  data-testid={`variation-${v.id}`}
                  onClick={() => setSelVar(v)}
                  className={`cursor-pointer rounded-none px-4 py-2 ${selVar?.id === v.id ? "bg-accent text-black" : "bg-secondary text-foreground"}`}
                >
                  {v.name} — {v.price.toFixed(2)} €
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center border border-border shrink-0">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-secondary"><Minus className="w-4 h-4" /></button>
            <span className="px-6 font-bold" data-testid="product-qty">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="p-3 hover:bg-secondary"><Plus className="w-4 h-4" /></button>
          </div>
          <Button className="cta-primary rounded-none flex-1 min-w-0 h-12" onClick={handleAdd} data-testid="add-to-cart-btn">
            <ShoppingBag className="w-4 h-4 mr-2 shrink-0" /> <span className="truncate">Ajouter au panier</span>
          </Button>
        </div>

        {p.description && (
          <div className="mt-8 pt-8 border-t border-border">
            <div className="text-sm uppercase tracking-widest font-bold mb-3">Description</div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{p.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
