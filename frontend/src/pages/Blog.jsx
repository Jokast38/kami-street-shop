import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";

export default function Blog() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    api.get("/blog").then(r => setPosts(r.data));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <SEO
        title="Le Journal Kami Street — Actus Mobilité Électrique"
        description="Conseils, actualités et guides d'achat sur la mobilité électrique : fatbikes, scooters et trottinettes. Le journal Kami Street pour bien choisir."
        path="/blog"
      />
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">// Editorial</div>
        <h1 className="display text-4xl md:text-5xl font-black" data-testid="blog-title">Le Journal</h1>
      </div>
      {posts.length === 0 ? (
        <div className="p-16 border border-dashed text-center text-muted-foreground">
          Aucun article. Depuis le dashboard admin, synchronisez WordPress.
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6" data-testid="blog-grid">
          {posts.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 6) * 0.05 }}>
              <Link to={`/blog/${b.slug}`} className="block group border border-border hover:border-accent transition-colors" data-testid={`blog-card-${b.slug}`}>
                {b.featured_image && (
                  <div className="aspect-video overflow-hidden">
                    <img src={b.featured_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <div className="p-5">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    {b.published_at ? new Date(b.published_at).toLocaleDateString("fr-FR") : ""}
                  </div>
                  <div className="display font-bold text-lg line-clamp-2" dangerouslySetInnerHTML={{ __html: b.title }} />
                  <div className="text-sm text-muted-foreground line-clamp-3 mt-2">{b.excerpt}</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
