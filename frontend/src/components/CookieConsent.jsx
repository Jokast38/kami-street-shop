import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "ks_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(CONSENT_KEY));

  const save = (value) => {
    localStorage.setItem(CONSENT_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] border border-border bg-background p-5 shadow-2xl md:left-auto md:max-w-lg" role="dialog" aria-label="Gestion des cookies">
      <div className="font-bold mb-2">Votre vie privée</div>
      <p className="text-sm text-muted-foreground mb-4">Kami Street utilise les stockages nécessaires au panier et au fonctionnement du site. Aucun cookie facultatif n’est activé sans votre accord. <Link className="underline" to="/cookies">En savoir plus</Link></p>
      <div className="flex flex-wrap gap-2">
        <Button className="cta-primary rounded-none" onClick={() => save("accepted")}>Accepter</Button>
        <Button variant="outline" className="rounded-none" onClick={() => save("refused")}>Refuser les cookies facultatifs</Button>
      </div>
    </div>
  );
}

export function CookieSettingsButton() {
  const reset = () => {
    localStorage.removeItem(CONSENT_KEY);
    window.location.reload();
  };
  return <button type="button" onClick={reset} className="hover:text-accent">Gérer les cookies</button>;
}
