import React from "react";
import SEO from "@/components/SEO";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 prose-ks">
      <SEO title="Politique de confidentialité" description="Politique de confidentialité et protection des données personnelles de Kami Street." path="/politique-confidentialite" />
      <h1 className="display text-4xl font-black mb-8">Politique de confidentialité</h1>
      <section className="space-y-4 text-muted-foreground">
        <h2 className="display text-2xl font-bold text-foreground">Responsable du traitement</h2>
        <p>Kami Street, 59 Av. Joffre, 93800 Épinay-sur-Seine. Contact : info@kamistreet.fr.</p>
        <h2 className="display text-2xl font-bold text-foreground pt-6">Données collectées</h2>
        <p>Lors d’une commande, nous collectons les informations nécessaires à la livraison, au paiement et au suivi de la commande : identité, adresse e-mail, adresse de livraison et informations de contact. Les données de paiement sont traitées par le prestataire de paiement et ne sont pas stockées par Kami Street.</p>
        <h2 className="display text-2xl font-bold text-foreground pt-6">Finalités et durées</h2>
        <p>Les données servent à exécuter la commande, répondre aux demandes, assurer la comptabilité et respecter les obligations légales. Elles sont conservées pendant la durée nécessaire à ces finalités et aux délais légaux applicables.</p>
        <h2 className="display text-2xl font-bold text-foreground pt-6">Vos droits</h2>
        <p>Vous pouvez demander l’accès, la rectification, l’effacement, la limitation ou la portabilité de vos données, et vous opposer à certains traitements. Écrivez à l’adresse de contact ci-dessus. Vous pouvez également saisir la CNIL.</p>
        <h2 className="display text-2xl font-bold text-foreground pt-6">Sous-traitants</h2>
        <p>Le site peut utiliser des prestataires techniques pour l’hébergement, le paiement, l’envoi d’e-mails et la gestion du catalogue. La liste exacte et les transferts éventuels hors Union européenne doivent être documentés par l’exploitant dans la version finale de cette politique.</p>
      </section>
    </div>
  );
}
