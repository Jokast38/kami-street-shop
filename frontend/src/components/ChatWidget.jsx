import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInlineMarkdown(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

const WELCOME = {
  role: "assistant",
  content: "Bonjour ! Je suis l'assistant Kami Street. Je peux vous conseiller sur nos produits, les prix ou le stock. Que cherchez-vous ?",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const history = messages.filter(m => m !== WELCOME);
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/chat", {
        message: text,
        history: history.map(m => ({ role: m.role, content: m.content })),
      });
      setMessages(m => [...m, { role: "assistant", content: data.reply, products: data.products || [] }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: "Désolé, une erreur est survenue. Réessayez dans un instant." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
        data-testid="chat-toggle-btn"
        aria-label="Ouvrir le chat"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[92vw] max-w-sm h-[70vh] max-h-[560px] bg-card border border-border shadow-2xl flex flex-col" data-testid="chat-panel">
          <div className="p-4 border-b border-border">
            <div className="font-black display">KAMI<span className="text-accent">.</span>ASSISTANT</div>
            <div className="text-xs text-muted-foreground">Propulsé par IA · vous conseille sur nos produits</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"} gap-2`}>
                {m.content && (
                  <div
                    className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "user" ? "bg-accent text-black" : "bg-secondary"
                    }`}
                    dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(m.content) }}
                  />
                )}
                {m.products?.length > 0 && (
                  <div className="w-full space-y-2">
                    {m.products.map(p => (
                      <ChatProductCard key={p.slug} p={p} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 text-sm bg-secondary text-muted-foreground">…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Posez votre question..."
              className="rounded-none"
              data-testid="chat-input"
            />
            <Button onClick={send} disabled={loading} className="cta-primary rounded-none" data-testid="chat-send-btn">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function ChatProductCard({ p }) {
  const price = p.sale_price || p.price;
  const img = p.images?.[0] || "https://images.unsplash.com/photo-1721637686340-de9f8cebda5a?w=400";
  return (
    <div className="flex gap-3 border border-border bg-card p-2 w-full" data-testid={`chat-product-${p.slug}`}>
      <div className="w-16 h-16 shrink-0 bg-white overflow-hidden">
        <img src={img} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="text-sm font-semibold truncate">{p.name}</div>
        <div className="flex items-center gap-2">
          {p.sale_price && <span className="text-muted-foreground line-through text-xs">{p.price?.toFixed(2)} €</span>}
          <span className="text-accent font-bold text-sm">{price?.toFixed(2)} €</span>
        </div>
      </div>
      <Link
        to={`/product/${p.slug}`}
        className="shrink-0 self-center flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-accent hover:underline"
      >
        Voir <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
