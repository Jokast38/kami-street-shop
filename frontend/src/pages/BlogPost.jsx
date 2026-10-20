import React, { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import SEO, { SITE_URL } from "@/components/SEO";
import { withImageAlt } from "@/lib/html";

const stripHtml = (html) => (html || "").replace(/<[^>]+>/g, "").trim();

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [redirectTo, setRedirectTo] = useState(null);
  useEffect(() => {
    setPost(null);
    setRedirectTo(null);
    // When an article's slug changes, the backend keeps a redirect record (old slug ->
    // new slug) instead of just 404ing old links — this is what makes that effective:
    // follow it to the new URL rather than rendering a dead end.
    api.get(`/blog/${slug}`).then(r => {
      if (r.data?.redirect) setRedirectTo(r.data.redirect);
      else setPost(r.data);
    });
  }, [slug]);
  if (redirectTo) return <Navigate to={`/blog/${redirectTo}`} replace />;
  if (!post) return <div className="p-12 text-center text-muted-foreground">Chargement...</div>;

  const plainTitle = stripHtml(post.title);
  const description = (post.excerpt ? stripHtml(post.excerpt) : stripHtml(post.content).slice(0, 160)).slice(0, 160);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": plainTitle,
    "description": description,
    "image": post.featured_image ? [post.featured_image] : undefined,
    "datePublished": post.published_at,
    "author": { "@type": "Organization", "name": "Kami Street" },
    "publisher": { "@type": "Organization", "name": "Kami Street", "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo/kami-street-black.png` } },
    "mainEntityOfPage": `${SITE_URL}/blog/${post.slug}`,
  };

  const faq = (post.faq || []).filter(f => f.question && f.answer);
  const faqJsonLd = faq.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faq.map(f => ({
      "@type": "Question",
      "name": stripHtml(f.question),
      "acceptedAnswer": { "@type": "Answer", "text": stripHtml(f.answer) },
    })),
  } : null;
  const jsonLd = faqJsonLd ? [articleJsonLd, faqJsonLd] : articleJsonLd;

  return (
    <article className="max-w-3xl mx-auto px-6 py-12">
      <SEO
        title={plainTitle}
        description={description}
        path={`/blog/${post.slug}`}
        image={post.featured_image}
        type="article"
        jsonLd={jsonLd}
      />
      <div className="text-xs uppercase tracking-[0.3em] text-black dark:text-accent mb-4">
        {post.published_at ? new Date(post.published_at).toLocaleDateString("fr-FR") : ""}
      </div>
      <h1 className="display text-3xl md:text-5xl font-black mb-6" dangerouslySetInnerHTML={{ __html: post.title }} data-testid="blog-post-title" />
      {post.featured_image && <img src={post.featured_image} alt={post.featured_image_alt || plainTitle} className="w-full aspect-video object-cover mb-8" />}
      <div className="prose-ks" dangerouslySetInnerHTML={{ __html: withImageAlt(post.content, plainTitle) }} />
      {faq.length > 0 && (
        <div className="mt-12 border-t border-border pt-8" data-testid="blog-faq-section">
          <h2 className="display text-2xl font-bold mb-6">Questions fréquentes</h2>
          <div className="space-y-6">
            {faq.map((f, i) => (
              <div key={i}>
                <h3 className="font-bold mb-1" dangerouslySetInnerHTML={{ __html: f.question }} />
                <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: f.answer }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
