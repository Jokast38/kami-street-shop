import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  useEffect(() => { api.get(`/blog/${slug}`).then(r => setPost(r.data)); }, [slug]);
  if (!post) return <div className="p-12 text-center text-muted-foreground">Chargement...</div>;
  return (
    <article className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-xs uppercase tracking-[0.3em] text-accent mb-4">
        {post.published_at ? new Date(post.published_at).toLocaleDateString("fr-FR") : ""}
      </div>
      <h1 className="display text-3xl md:text-5xl font-black mb-6" dangerouslySetInnerHTML={{ __html: post.title }} data-testid="blog-post-title" />
      {post.featured_image && <img src={post.featured_image} alt="" className="w-full aspect-video object-cover mb-8" />}
      <div className="prose-ks" dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
