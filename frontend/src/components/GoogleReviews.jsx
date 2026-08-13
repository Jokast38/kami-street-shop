import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";

function Stars({ rating = 0 }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? "fill-accent text-accent" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

// Google's API sometimes omits a reviewer's profile photo (or the URL can 404 on
// hotlink). Generate a stable colored-initials avatar from the name instead of
// leaving a blank spot.
const AVATAR_COLORS = ["#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981", "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899"];

function initialsOf(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function colorFor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ReviewAvatar({ name, photoUrl }) {
  const [errored, setErrored] = useState(false);
  if (photoUrl && !errored) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="w-11 h-11 rounded-full object-cover shrink-0"
        loading="lazy"
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ backgroundColor: colorFor(name) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </div>
  );
}

export default function GoogleReviews() {
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    api.get("/google-reviews").then((r) => setData(r.data)).catch(() => {});
  }, []);

  const reviews = data?.reviews || [];

  useEffect(() => {
    if (reviews.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % reviews.length), 7000);
    return () => clearInterval(t);
  }, [reviews.length]);

  if (!data || reviews.length === 0) return null;

  const current = reviews[index];
  const goPrev = () => setIndex((i) => (i - 1 + reviews.length) % reviews.length);
  const goNext = () => setIndex((i) => (i + 1) % reviews.length);

  return (
    <section className="border-t border-border py-16" aria-labelledby="google-reviews-title">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-black dark:text-accent mb-2">// Avis Google</div>
            <h2 id="google-reviews-title" className="display text-3xl md:text-4xl font-black">Ce que disent nos clients</h2>
            {data.rating != null && (
              <div className="flex items-center gap-2 mt-3">
                <Stars rating={data.rating} />
                <span className="font-bold">{data.rating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">sur {data.user_ratings_total} avis Google</span>
              </div>
            )}
          </div>
          {data.write_review_url && (
            <a
              href={data.write_review_url}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-primary px-5 py-3 inline-flex items-center gap-2 shrink-0 self-start"
            >
              Laisser un avis <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className="relative border border-border bg-card p-8 md:p-10 min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <ReviewAvatar name={current.author_name} photoUrl={current.profile_photo_url} />
                <div>
                  <div className="font-bold">{current.author_name}</div>
                  <div className="text-xs text-muted-foreground">{current.relative_time_description}</div>
                </div>
              </div>
              <Stars rating={current.rating} />
              <p className="text-muted-foreground leading-relaxed mt-4">{current.text}</p>
            </motion.div>
          </AnimatePresence>

          {reviews.length > 1 && (
            <div className="flex items-center justify-between mt-8">
              <button onClick={goPrev} aria-label="Avis précédent" className="p-2 border border-border hover:border-accent transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex gap-2">
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Voir l'avis ${i + 1}`}
                    className={`w-2 h-2 rounded-full transition-colors ${i === index ? "bg-accent" : "bg-border"}`}
                  />
                ))}
              </div>
              <button onClick={goNext} aria-label="Avis suivant" className="p-2 border border-border hover:border-accent transition-colors">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
