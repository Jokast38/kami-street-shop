import React from "react";
import { Link } from "react-router-dom";
import Marquee from "react-fast-marquee";
import { useTheme } from "@/context/ThemeContext";
import { FaTiktok, FaInstagram, FaLinkedin, FaSnapchatGhost, FaFacebook, FaYoutube } from "react-icons/fa";
import { MapPin, Phone } from "lucide-react";
import { CookieSettingsButton } from "@/components/CookieConsent";

const SOCIAL_LINKS = [
  { name: "TikTok", icon: FaTiktok, url: "https://www.tiktok.com/@kami_street_" },
  { name: "Instagram", icon: FaInstagram, url: "https://www.instagram.com/kami_street_/?hl=fr" },
  { name: "LinkedIn", icon: FaLinkedin, url: "https://www.linkedin.com/in/kami-street-7450833a2/" },
  { name: "Snapchat", icon: FaSnapchatGhost, url: "https://www.snapchat.com/@kamistreet93" },
  { name: "Facebook", icon: FaFacebook, url: "https://www.facebook.com/profile.php?id=61584631330642&locale=fr_FR" },
  { name: "YouTube", icon: FaYoutube, url: "https://www.youtube.com/channel/UChTepM7oFRNng5Cb9O-_ScQ" },
];

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
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-5 gap-10">
        <div className="md:col-span-2">
          <img src={logoSrc} alt="Kami Street" className="h-9 w-auto" />
          <p className="text-muted-foreground mt-4 max-w-md text-sm">
            Fatbikes, scooters, trottinettes électriques & accessoires. Une identité forte, une communauté libre.
          </p>
          <div className="flex items-center gap-3 mt-6">
            {SOCIAL_LINKS.map(({ name, icon: Icon, url }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                data-testid={`social-${name.toLowerCase()}`}
                className="w-9 h-9 flex items-center justify-center border border-border text-muted-foreground hover:text-accent hover:border-accent transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
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
            <li><Link to="/mentions-legales" className="hover:text-accent">Mentions légales</Link></li>
            <li><Link to="/politique-confidentialite" className="hover:text-accent">Confidentialité</Link></li>
            <li><Link to="/cookies" className="hover:text-accent">Cookies</Link></li>
            <li><CookieSettingsButton /></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-bold uppercase mb-3 tracking-widest">Contact</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <span>59 Av. Joffre, 93800 Épinay-sur-Seine, France</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 shrink-0" />
              <a href="tel:+33180907251" className="hover:text-accent">+33 1 80 90 72 51</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Kami Street. Tous droits réservés.
      </div>
    </footer>
  );
}
