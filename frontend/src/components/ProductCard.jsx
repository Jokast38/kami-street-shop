import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import KlarnaBadge from "@/components/KlarnaBadge";

export default function ProductCard({ p, index = 0 }) {
  const price = p.sale_price || p.price;
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
        <div className="aspect-square overflow-hidden bg-white">
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
            {p.sale_price && (
              <span className="text-muted-foreground line-through text-sm">{p.price.toFixed(2)} €</span>
            )}
            <span className="text-accent font-black display">{price.toFixed(2)} €</span>
          </div>
          <div className="mt-2">
            <KlarnaBadge price={price} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
