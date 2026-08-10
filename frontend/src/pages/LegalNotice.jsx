import React from "react";
import SEO from "@/components/SEO";

export default function LegalNotice() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 prose-ks">
      <SEO title="Mentions légales" description="Mentions légales du site Kami Street, spécialiste des vélos électriques et fatbikes." path="/mentions-legales" />
      <h1 className="display text-4xl font-black mb-8">Mentions légales</h1>
      <section className="space-y-4 text-muted-foreground">
        <h2 className="display text-2xl font-bold text-foreground">Éditeur du site</h2>
        <p>Kami Street<br />Société par actions simplifiée<br />59 Avenue Joffre<br />93800 Épinay-sur-Seine, France<br />Téléphone : +33 1 80 90 72 51<br />E-mail : contact@kamistreet.fr</p>
        <p>SIREN : 104 079 264<br />SIRET du siège social : 104 079 264 00016<br />TVA intracommunautaire : FR42 104079264<br />Activité : commerce de détail d’articles de sport en magasin spécialisé (APE/NAF 4764Z)<br />Date de création : 23 avril 2026</p>
        <p>Capital social : <strong>à compléter par l’exploitant</strong>.</p>
        <h2 className="display text-2xl font-bold text-foreground pt-6">Hébergement</h2>
        <p>Les informations relatives à l’hébergeur du site, son adresse et son téléphone doivent être complétées avec les coordonnées exactes du prestataire d’hébergement utilisé en production.</p>
        <h2 className="display text-2xl font-bold text-foreground pt-6">Propriété intellectuelle</h2>
        <p>Les textes, photographies, logos, marques et éléments graphiques présents sur ce site sont protégés par les règles applicables de propriété intellectuelle. Toute reproduction ou réutilisation non autorisée est interdite.</p>
        <h2 className="display text-2xl font-bold text-foreground pt-6">Vente en ligne</h2>
        <p>Les conditions de vente, les garanties légales, le droit de rétractation et les modalités de règlement sont applicables aux commandes selon la réglementation française et européenne. Elles doivent être publiées et maintenues à jour avant l’ouverture commerciale complète du site.</p>
      </section>
    </div>
  );
}
