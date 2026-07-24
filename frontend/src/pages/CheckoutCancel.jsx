import React from "react";
import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";

export default function CheckoutCancel() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <XCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
      <h1 className="display text-3xl md:text-4xl font-black mb-4">Paiement annulé</h1>
      <p className="text-muted-foreground mb-8">Votre commande n'a pas été finalisée. Aucun débit n'a été effectué.</p>
      <Link to="/shop" className="cta-primary px-6 py-3 inline-block">Retour à la boutique</Link>
    </div>
  );
}
