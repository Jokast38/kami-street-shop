import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import KlarnaBadge from "@/components/KlarnaBadge";

export default function ProductCard({ p, index = 0 }) {
  const regularPrice = p.regular_price || p.price;
  const price = p.sale_price || regularPrice;
  const img = p.images?.[0] || "https://images.unsplash.com/photo-1721637686340-de9f8cebda5a?w=800";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: (index % 8) * 0.05 }}
      data-testid={`product-card-${p.slug}`}
    >
      <Link to={`/product/${p.slug}`} className="product-card block bg-card group">
        <div className="aspect-square overflow-hidden bg-white relative">
          {p.preorder && (
            <span className="absolute top-2 left-2 z-10 bg-black text-accent text-[10px] font-bold uppercase tracking-wider px-2 py-1">
              Précommande
            </span>
          )}
          <img
            src={img}
            alt={p.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>
        <div className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {p.categories?.[0] || "Kami Street"}
          </div>
          <div className="font-semibold mt-1 line-clamp-2 min-h-[3rem]">{p.name}</div>
          <div className="flex items-center gap-2 mt-2">
            {regularPrice > price && (
              <span className="text-muted-foreground line-through text-sm">{regularPrice.toFixed(2)} €</span>
            )}
            <span className={`font-black display ${regularPrice > price ? "text-red-600 dark:text-red-400" : "text-black dark:text-accent"}`}>{price.toFixed(2)} €</span>
          </div>
          <div className="mt-2">
            <KlarnaBadge price={price} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
