import React from "react";
import { Link } from "react-router-dom";
import Marquee from "react-fast-marquee";
import { useTheme } from "@/context/ThemeContext";

export default function Footer() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/logo/logo-kami-offwhite.png" : "/logo/kami-street-black.png";
  const tickerKoalaSrc = theme === "dark" ? "/logo/logo-koala-black.png" : "/logo/logo-koala-offwhite.png";

  return (
    <footer className="border-t border-border mt-24 relative z-10">
      <Marquee className="ticker-strip" speed={40} gradient={false}>
        <span className="display font-black tracking-widest px-8 inline-flex items-center gap-3">
          <img src={tickerKoalaSrc} alt="" className="h-5 w-auto" /> KAMI STREET · ELECTRIC FATBIKE · SCOOTERS & TROTTINETTES · ACCESSOIRES · MADE IN FRANCE ·
        </span>
        <span className="display font-black tracking-widest px-8 inline-flex items-center gap-3">
          <img src={tickerKoalaSrc} alt="" className="h-5 w-auto" /> KAMI STREET · ELECTRIC FATBIKE · SCOOTERS & TROTTINETTES · ACCESSOIRES · MADE IN FRANCE ·
        </span>
      </Marquee>
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <img src={logoSrc} alt="Kami Street" className="h-9 w-auto" />
          <p className="text-muted-foreground mt-4 max-w-md text-sm">
            Fatbikes, scooters, trottinettes électriques & accessoires. Une identité forte, une communauté libre.
          </p>
        </div>
        <div>
          <div className="text-sm font-bold uppercase mb-3 tracking-widest">Boutique</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/shop" className="hover:text-accent">Tous les produits</Link></li>
            <li><Link to="/blog" className="hover:text-accent">Journal</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-bold uppercase mb-3 tracking-widest">Compte</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/admin/login" className="hover:text-accent">Admin</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Kami Street. Tous droits réservés.
      </div>
    </footer>
  );
}
