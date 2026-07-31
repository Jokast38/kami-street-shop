import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import SEO, { SITE_URL } from "@/components/SEO";

const stripHtml = (html) => (html || "").replace(/<[^>]+>/g, "").trim();

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  useEffect(() => { api.get(`/blog/${slug}`).then(r => setPost(r.data)); }, [slug]);
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

  return (
    <article className="max-w-3xl mx-auto px-6 py-12">
      <SEO
        title={plainTitle}
        description={description}
        path={`/blog/${post.slug}`}
        image={post.featured_image}
        type="article"
        jsonLd={articleJsonLd}
      />
      <div className="text-xs uppercase tracking-[0.3em] text-black dark:text-accent mb-4">
        {post.published_at ? new Date(post.published_at).toLocaleDateString("fr-FR") : ""}
      </div>
      <h1 className="display text-3xl md:text-5xl font-black mb-6" dangerouslySetInnerHTML={{ __html: post.title }} data-testid="blog-post-title" />
      {post.featured_image && <img src={post.featured_image} alt={plainTitle} className="w-full aspect-video object-cover mb-8" />}
      <div className="prose-ks" dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
