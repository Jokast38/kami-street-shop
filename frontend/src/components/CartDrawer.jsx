import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Minus, Plus, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { usePaymentMethods } from "@/context/PaymentMethodsContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import KlarnaBadge from "@/components/KlarnaBadge";

export default function CartDrawer() {
  const { items, open, setOpen, removeItem, updateQty, total, clear, getLineTotal } = useCart();
  const [step, setStep] = useState("cart"); // cart | info
  const [form, setForm] = useState({ customer_name: "", customer_email: "", line1: "", city: "", postal_code: "", country: "France" });
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(null);
  const [promoCode, setPromoCode] = useState("");
  const [paymentType, setPaymentType] = useState("standard");
  const { alma, stripe: stripeEnabled, qonto: qontoEnabled, mollie: mollieEnabled } = usePaymentMethods();

  const PROVIDER_LABELS = { stripe: "Stripe", qonto: "Qonto", mollie: "Mollie", alma: "Alma" };
  const PROVIDER_ENDPOINTS = { stripe: "/checkout/session", qonto: "/checkout/qonto-session", mollie: "/checkout/mollie-session", alma: "/checkout/alma-session" };
  const MIN_INSTALLMENT_ELIGIBLE_AMOUNT = 300;
  const installmentOptions = alma && total >= MIN_INSTALLMENT_ELIGIBLE_AMOUNT ? [3, 4, 6, 10, 12] : [];

  useEffect(() => {
    api.get("/payment-methods").then(r => {
      const active = ["stripe", "qonto", "mollie", "alma"].find(p => r.data[p]);
      setProvider(active || null);
    }).catch(() => {});
  }, []);

  const submit = async () => {
    const selectedProvider = paymentType.startsWith("alma-") ? "alma" : provider;
    if (!selectedProvider) return;
    setLoading(true);
    try {
      if (selectedProvider === "alma") {
        toast.error("Le paiement Alma complet nécessite une configuration dédiée côté Alma et n’est pas encore prêt à être utilisé depuis ce checkout.");
        setLoading(false);
        return;
      }
      const endpoint = PROVIDER_ENDPOINTS[selectedProvider];
      const { data } = await api.post(endpoint, {
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
        promo_code: promoCode.trim() || null,
        payment_provider: selectedProvider,
        payment_option: paymentType,
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
                  {i.image && <img src={i.image} alt={i.name} className="w-20 h-24 object-cover" />}
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{(getLineTotal(i) / i.quantity).toFixed(2)} € / article</div>
                    {i.bundle_enabled && i.quantity >= (i.bundle_quantity || 2) && <div className="text-xs text-red-600 dark:text-red-400 font-bold">Prix du lot appliqué</div>}
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
                <span className="display text-black dark:text-accent" data-testid="cart-total">{total.toFixed(2)} €</span>
              </div>
              <KlarnaBadge price={total} />
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
              <div className="flex justify-between font-bold"><span>Total</span><span className="display text-black dark:text-accent">{total.toFixed(2)} €</span></div>
              <div><Label>Code promo</Label><Input placeholder="Votre code promo" value={promoCode} onChange={e => setPromoCode(e.target.value)} /></div>
              {alma && total >= MIN_INSTALLMENT_ELIGIBLE_AMOUNT && (
                <div className="space-y-2">
                  <Label>Type de paiement</Label>
                  <select
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value)}
                    className="w-full border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="standard">Paiement comptant</option>
                    {installmentOptions.map(option => (
                      <option key={option} value={`alma-${option}x`}>
                        Paiement en {option}x avec Alma
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Les paiements Alma sont proposés à partir de 300 €.</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">La remise sera vérifiée et appliquée au paiement.</p>
              <Button
                disabled={loading || !form.customer_email || !form.customer_name || !form.line1 || !provider}
                className="w-full cta-primary rounded-none h-12"
                onClick={submit}
                data-testid="checkout-pay-btn"
              >
                {loading ? "Redirection..." : provider ? `Payer avec ${paymentType.startsWith("alma-") ? "Alma" : PROVIDER_LABELS[provider]}` : "Aucun moyen de paiement disponible"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep("cart")}>Retour au panier</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
