import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Minus, Plus, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function CartDrawer() {
  const { items, open, setOpen, removeItem, updateQty, total, clear } = useCart();
  const [step, setStep] = useState("cart"); // cart | info
  const [form, setForm] = useState({ customer_name: "", customer_email: "", line1: "", city: "", postal_code: "", country: "France" });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/checkout/session", {
        items: items.map(i => ({
          product_id: i.product_id,
          variation_id: i.variation_id || null,
          name: i.name, price: i.price, quantity: i.quantity, image: i.image,
        })),
        customer_email: form.customer_email,
        customer_name: form.customer_name,
        shipping_address: {
          line1: form.line1, city: form.city, postal_code: form.postal_code, country: form.country,
        },
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur lors de la commande");
    } finally { setLoading(false); }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0" data-testid="cart-drawer">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="display uppercase tracking-widest">
            {step === "cart" ? `Panier (${items.length})` : "Livraison"}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Votre panier est vide.
          </div>
        ) : step === "cart" ? (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.map((i, idx) => (
                <div key={idx} className="flex gap-4 border-b pb-4" data-testid={`cart-item-${idx}`}>
                  {i.image && <img src={i.image} alt="" className="w-20 h-24 object-cover" />}
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{i.price.toFixed(2)} €</div>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => updateQty(i.product_id, i.variation_id, i.quantity - 1)} className="p-1 border"><Minus className="w-3 h-3" /></button>
                      <span className="text-sm w-6 text-center">{i.quantity}</span>
                      <button onClick={() => updateQty(i.product_id, i.variation_id, i.quantity + 1)} className="p-1 border"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <button onClick={() => removeItem(i.product_id, i.variation_id)} className="text-muted-foreground hover:text-destructive" data-testid={`cart-remove-${idx}`}><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="p-6 border-t space-y-3">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="display text-accent" data-testid="cart-total">{total.toFixed(2)} €</span>
              </div>
              <Button className="w-full cta-primary rounded-none h-12" onClick={() => setStep("info")} data-testid="cart-checkout-btn">
                Passer commande <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div><Label>Nom complet</Label><Input data-testid="checkout-name" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input data-testid="checkout-email" type="email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
              <div><Label>Adresse</Label><Input data-testid="checkout-address" value={form.line1} onChange={e => setForm({ ...form, line1: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code postal</Label><Input data-testid="checkout-postal" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} /></div>
                <div><Label>Ville</Label><Input data-testid="checkout-city" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              </div>
              <div><Label>Pays</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t space-y-2">
              <div className="flex justify-between font-bold"><span>Total</span><span className="display text-accent">{total.toFixed(2)} €</span></div>
              <Button
                disabled={loading || !form.customer_email || !form.customer_name || !form.line1}
                className="w-full cta-primary rounded-none h-12"
                onClick={submit}
                data-testid="checkout-pay-btn"
              >
                {loading ? "Redirection..." : "Payer avec Stripe"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep("cart")}>Retour au panier</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
