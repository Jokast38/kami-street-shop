import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { CheckCircle2 } from "lucide-react";

export default function CheckoutSuccess() {
  const [sp] = useSearchParams();
  const [status, setStatus] = useState(null);
  const { clear } = useCart();

  useEffect(() => {
    const sid = sp.get("session_id");
    if (!sid) return;
    let tries = 0;
    const poll = () => {
      api.get(`/checkout/status/${sid}`).then(r => {
        setStatus(r.data);
        if (r.data.payment_status === "paid") clear();
        else if (tries++ < 10) setTimeout(poll, 2000);
      }).catch(() => {});
    };
    poll();
  }, [sp, clear]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <CheckCircle2 className="w-16 h-16 text-accent mx-auto mb-6" />
      <h1 className="display text-3xl md:text-4xl font-black mb-4" data-testid="success-title">Merci pour votre commande</h1>
      {status && (
        <>
          <p className="text-muted-foreground mb-2">Commande #{status.order_no}</p>
          <p className="text-muted-foreground mb-6">Total : <span className="text-accent font-bold">{status.total?.toFixed(2)} €</span></p>
          <p className="text-sm text-muted-foreground mb-8">Statut : {status.payment_status === "paid" ? "Payé ✓" : "En attente..."}</p>
        </>
      )}
      <p className="mb-8 text-muted-foreground">Un email de confirmation vous a été envoyé.</p>
      <Link to="/shop" className="cta-primary px-6 py-3 inline-block">Continuer mes achats</Link>
    </div>
  );
}
