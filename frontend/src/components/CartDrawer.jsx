import React, { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Minus, Plus, ArrowRight, MapPin, CreditCard, CheckCircle2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { usePaymentMethods } from "@/context/PaymentMethodsContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import KlarnaBadge from "@/components/KlarnaBadge";

function AddressAutocomplete({ value, onSelect }) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => setQuery(value || ""), [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onSelect({ line1: val });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(val)}&limit=5`
        );
        const data = await res.json();
        setSuggestions(data.features || []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const pick = (feature) => {
    const p = feature.properties;
    setQuery(p.name);
    setOpen(false);
    onSelect({
      line1: p.name,
      city: p.city,
      postal_code: p.postcode,
      country: "France",
    });
  };

  return (
    <div className="relative">
      <Input
        data-testid="checkout-address"
        value={query}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="12 rue de la Paix, Paris..."
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((f) => (
            <button
              key={f.properties.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(f)}
              className="w-full text-left px-3 py-2 text-sm flex items-start gap-2 hover:bg-muted transition-colors border-b border-border last:border-0"
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <span>
                <span className="font-medium">{f.properties.name}</span>
                <span className="text-muted-foreground"> — {f.properties.postcode} {f.properties.city}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CartDrawer() {
  const { items, open, setOpen, removeItem, updateQty, total, clear, getLineTotal } = useCart();
  const [step, setStep] = useState("cart"); // cart | info
  const [form, setForm] = useState({ customer_name: "", customer_email: "", line1: "", city: "", postal_code: "", country: "France" });
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [paymentType, setPaymentType] = useState("standard");
  const { alma, stripe: stripeEnabled, qonto: qontoEnabled, mollie: mollieEnabled, klarna: klarnaEnabled } = usePaymentMethods();

  const PROVIDER_ENDPOINTS = { stripe: "/checkout/session", qonto: "/checkout/qonto-session", mollie: "/checkout/mollie-session", alma: "/checkout/alma-session" };
  const MIN_INSTALLMENT_ELIGIBLE_AMOUNT = 300;
  const installmentOptions = alma && total >= MIN_INSTALLMENT_ELIGIBLE_AMOUNT ? [3, 4, 6, 10, 12] : [];

  const submit = async () => {
    const selectedProvider = paymentType.startsWith("alma-")
      ? "alma"
      : "mollie";
    if (!selectedProvider) return;
    setLoading(true);
    try {
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
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Coordonnées</div>
                <div><Label>Nom complet</Label><Input data-testid="checkout-name" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
                <div><Label>Email</Label><Input data-testid="checkout-email" type="email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Adresse de livraison
                </div>
                <div>
                  <Label>Adresse</Label>
                  <AddressAutocomplete
                    value={form.line1}
                    onSelect={(fields) => setForm(prev => ({ ...prev, ...fields }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Code postal</Label><Input data-testid="checkout-postal" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} /></div>
                  <div><Label>Ville</Label><Input data-testid="checkout-city" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                </div>
                <div><Label>Pays</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
              </div>

              <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Mode de paiement
                  </div>
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType("standard")}
                      className={`flex items-center justify-between border px-4 py-3 text-left transition-colors ${
                        paymentType === "standard"
                          ? "border-foreground bg-muted"
                          : "border-border hover:border-foreground/50"
                      }`}
                    >
                      <span className="text-sm font-medium">Comptant</span>
                      {paymentType === "standard" && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    {klarnaEnabled && (
                      <button
                        type="button"
                        onClick={() => setPaymentType("klarna")}
                        className={`flex items-center justify-between border px-4 py-3 text-left transition-colors ${
                          paymentType === "klarna"
                            ? "border-foreground bg-muted"
                            : "border-border hover:border-foreground/50"
                        }`}
                      >
                        <span className="text-sm font-medium">Payer avec Klarna</span>
                        {paymentType === "klarna" && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    )}
                    {installmentOptions.map(option => {
                      const value = `alma-${option}x`;
                      const selected = paymentType === value;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setPaymentType(value)}
                          className={`flex items-center justify-between border-2 px-4 py-3 text-left transition-colors ${
                            selected
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/60"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{option}x sans frais</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-foreground text-background px-1.5 py-0.5">
                              Alma
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{(total / option).toFixed(2)} €/mois</span>
                            {selected && <CheckCircle2 className="w-4 h-4 text-accent" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {installmentOptions.length > 0 && (
                    <p className="text-xs text-muted-foreground">Paiement en plusieurs fois avec Alma, proposé à partir de 300 €.</p>
                  )}
              </div>

              <div>
                <Label>Code promo</Label>
                <Input placeholder="Votre code promo" value={promoCode} onChange={e => setPromoCode(e.target.value)} />
              </div>
            </div>
            <div className="p-6 border-t space-y-2 shrink-0">
              <div className="flex justify-between font-bold"><span>Total</span><span className="display text-black dark:text-accent">{total.toFixed(2)} €</span></div>
              <p className="text-xs text-muted-foreground">La remise sera vérifiée et appliquée au paiement.</p>
              <Button
                disabled={loading || !form.customer_email || !form.customer_name || !form.line1}
                className="w-full cta-primary rounded-none h-12"
                onClick={submit}
                data-testid="checkout-pay-btn"
              >
                {loading
                  ? "Redirection..."
                  : `Payer avec ${paymentType.startsWith("alma-") ? "Alma" : paymentType === "klarna" ? "Klarna" : "Mollie"}`}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep("cart")}>Retour au panier</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
