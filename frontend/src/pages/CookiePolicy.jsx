import React from "react";
import SEO from "@/components/SEO";

export default function CookiePolicy() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 prose-ks">
      <SEO title="Gestion des cookies" description="Informations sur les cookies et le consentement sur le site Kami Street." path="/cookies" />
      <h1 className="display text-4xl font-black mb-8">Gestion des cookies</h1>
      <section className="space-y-4 text-muted-foreground">
        <h2 className="display text-2xl font-bold text-foreground">Cookies essentiels</h2>
        <p>Le site utilise uniquement les stockages nécessaires à son fonctionnement, notamment le panier et les préférences d’affichage. Ces éléments ne nécessitent pas de consentement lorsqu’ils sont strictement nécessaires au service demandé.</p>
        <h2 className="display text-2xl font-bold text-foreground pt-6">Cookies facultatifs</h2>
        <p>Aucun outil publicitaire, de mesure d’audience ou de suivi facultatif ne doit être activé sans votre consentement préalable. Si de tels outils sont ajoutés, cette page devra préciser leur fournisseur, leur finalité, leur durée et les transferts éventuels.</p>
        <h2 className="display text-2xl font-bold text-foreground pt-6">Modifier votre choix</h2>
        <p>Vous pouvez modifier votre choix à tout moment depuis le bouton « Gérer les cookies » affiché en bas de page.</p>
      </section>
    </div>
  );
}
