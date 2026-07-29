import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Zap, ShoppingBag, Truck } from "lucide-react";
import Marquee from "react-fast-marquee";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import SEO from "@/components/SEO";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTheme } from "@/context/ThemeContext";

const FALLBACK_HERO = "https://images.pexels.com/photos/13633037/pexels-photo-13633037.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1600";

const PARTNER_LOGOS = [
  { name: "HT-T47", src: "/logo/logo-partner/logo-HT-T47.png" },
  { name: "E-Zen", src: "/logo/logo-partner/logo-e-zen.png" },
  { name: "Emoko", src: "/logo/logo-partner/logo-emoko.png" },
  { name: "Jobobike", src: "/logo/logo-partner/logo-jobobike.png" },
  { name: "Joyor", src: "/logo/logo-partner/logo-joyor.png" },
  { name: "The One", src: "/logo/logo-partner/logo-the-one.png" },
];

const FAQ_ITEMS = [
  {
    q: "Quel est le délai de livraison Kami Street ?",
    a: "Toutes nos commandes de fatbikes, scooters et trottinettes électriques sont expédiées sous 48h partout en France métropolitaine.",
  },
  {
    q: "Les produits Kami Street sont-ils garantis ?",
    a: "Oui, chaque fatbike, scooter et trottinette électrique vendu sur Kami Street bénéficie de la garantie constructeur, ainsi que d'un support après-vente en français.",
  },
  {
    q: "Puis-je payer en plusieurs fois ?",
    a: "Le paiement s'effectue en ligne par carte bancaire de manière sécurisée. Contactez-nous pour connaître les options de paiement en plusieurs fois disponibles selon le produit.",
  },
  {
    q: "Proposez-vous des pièces détachées et accessoires ?",
    a: "Oui, Kami Street propose une gamme d'accessoires et de pièces détachées compatibles avec nos fatbikes, scooters et trottinettes électriques.",
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQ_ITEMS.map(({ q, a }) => ({
    "@type": "Question",
    "name": q,
    "acceptedAnswer": { "@type": "Answer", "text": a },
  })),
};

export default function Home() {
  const { theme } = useTheme();
  const koalaSrc = theme === "dark" ? "/logo/logo-koala-black.png" : "/logo/logo-koala-offwhite.png";
  const [products, setProducts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [blog, setBlog] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    api.get("/products", { params: { limit: 8 } }).then(r => setProducts(r.data)).catch(() => {});
    api.get("/banners").then(r => setBanners(r.data)).catch(() => {});
    api.get("/blog", { params: { limit: 3 } }).then(r => setBlog(r.data)).catch(() => {});
  }, []);

  const slides = banners.length
    ? banners
    : [
        {
          title: "FATBIKES × ACCESSOIRES ÉLECTRIQUES",
          subtitle: "La collection Kami Street. Fatbikes, scooters, trottinettes & accessoires pour rouler électrique.",
          image: FALLBACK_HERO,
          cta_text: "Explorer la collection",
          cta_link: "/shop",
        },
      ];

  useEffect(() => {
    setHeroIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setHeroIndex(i => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  const hero = slides[heroIndex] || slides[0];
  const goPrev = () => setHeroIndex(i => (i - 1 + slides.length) % slides.length);
  const goNext = () => setHeroIndex(i => (i + 1) % slides.length);

  return (
    <>
      <SEO
        title="Kami Street | Fatbikes & Trottinettes Électriques France"
        description="Kami Street, spécialiste des fatbikes, scooters et trottinettes électriques en France. Livraison 48h, garantie constructeur, accessoires et pièces détachées."
        path="/"
        jsonLd={FAQ_JSON_LD}
      />
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border min-h-[85vh] flex items-center">
        <AnimatePresence mode="sync">
          <motion.img
            key={hero.image}
            src={hero.image}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 w-full">
          <div className="max-w-xl">
            <AnimatePresence mode="wait">
              <motion.div key={heroIndex}>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                  <div className="text-xs uppercase tracking-[0.3em] text-accent mb-4">// Nouvelle collection 2026</div>
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="display text-4xl sm:text-5xl lg:text-6xl font-black leading-[0.95] mb-6 text-white"
                  data-testid="hero-title"
                >
                  {hero.title}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.35 }}
                  className="text-white/80 text-base mb-8 max-w-md"
                >
                  {hero.subtitle}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="flex flex-wrap gap-3"
                >
                  <Link to={hero.cta_link || "/shop"} className="cta-primary px-6 py-3 inline-flex items-center gap-2" data-testid="hero-cta">
                    {hero.cta_text || "Shop Now"} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/blog" className="px-6 py-3 border border-white/40 text-white inline-flex items-center gap-2 hover:border-accent hover:text-accent transition-colors">
                    Journal
                  </Link>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Bannière précédente"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goNext}
              aria-label="Bannière suivante"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/40 hover:bg-black/60 text-white transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  aria-label={`Bannière ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === heroIndex ? "w-6 bg-accent" : "w-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Marquee */}
      <Marquee className="ticker-strip" speed={50} gradient={false}>
        <span className="display font-black tracking-widest px-8 inline-flex items-center gap-3">
          <img src={koalaSrc} alt="" className="h-5 w-auto" /> // ELECTRIC FATBIKE // NEW DROP // KAMI STREET // 100% URBAN // MADE IN FRANCE //
        </span>
        <span className="display font-black tracking-widest px-8 inline-flex items-center gap-3">
          <img src={koalaSrc} alt="" className="h-5 w-auto" /> // ELECTRIC FATBIKE // NEW DROP // KAMI STREET // 100% URBAN // MADE IN FRANCE //
        </span>
      </Marquee>

      {/* Value props */}
      <section className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        {[
          { icon: Zap, title: "Electric energy", text: "Une identité fatbike électrique. Puissance & style." },
          { icon: ShoppingBag, title: "Accessoires premium", text: "Équipements et accessoires pour fatbikes, scooters & trottinettes électriques." },
          { icon: Truck, title: "Livraison rapide", text: "Expédition sous 48h partout en France." },
        ].map((v, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="p-8 border border-border bg-card">
            <v.icon className="w-8 h-8 text-accent mb-4" />
            <div className="display font-bold mb-2">{v.title}</div>
            <div className="text-sm text-muted-foreground">{v.text}</div>
          </motion.div>
        ))}
      </section>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">// Highlights</div>
            <h2 className="display text-3xl md:text-4xl font-black">Produits phares</h2>
          </div>
          <Link to="/shop" className="text-sm uppercase tracking-widest hover:text-accent inline-flex items-center gap-2">
            Voir tout <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="p-16 border border-dashed text-center text-muted-foreground">
            Aucun produit encore. Depuis le dashboard admin, cliquez sur "Synchroniser WooCommerce" pour importer votre catalogue.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6" data-testid="featured-products">
            {products.slice(0, 8).map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
          </div>
        )}
      </section>

      {/* Blog teasers */}
      {blog.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">// Journal</div>
          <h2 className="display text-3xl md:text-4xl font-black mb-10">Dernières publications</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {blog.map((b) => (
              <Link key={b.id} to={`/blog/${b.slug}`} className="group border border-border block hover:border-accent transition-colors">
                {b.featured_image && <div className="aspect-video overflow-hidden"><img src={b.featured_image} alt={b.title?.replace(/<[^>]+>/g, "")} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /></div>}
                <div className="p-5">
                  <div className="display font-bold text-lg line-clamp-2" dangerouslySetInnerHTML={{ __html: b.title }} />
                  <div className="text-sm text-muted-foreground line-clamp-2 mt-2">{b.excerpt}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Partner brands */}
      <section className="border-t border-border py-14">
        <div className="max-w-7xl mx-auto px-6 mb-8">
          <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">// Nos marques</div>
          <h2 className="display text-2xl md:text-3xl font-black">Marques partenaires</h2>
        </div>
        <Marquee speed={40} gradient={false} pauseOnHover>
          {PARTNER_LOGOS.map((logo) => (
            <div key={logo.name} className="mx-6 sm:mx-12 flex items-center justify-center h-20 sm:h-32">
              <img
                src={logo.src}
                alt={logo.name}
                className="h-full w-auto max-w-[160px] sm:max-w-[280px] object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
              />
            </div>
          ))}
        </Marquee>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-border">
        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">// FAQ</div>
        <h2 className="display text-2xl md:text-3xl font-black mb-8">Questions fréquentes</h2>
        <Accordion type="single" collapsible>
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </>
  );
}
