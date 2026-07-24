import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, Sun, Moon, Menu, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const { count, setOpen } = useCart();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const loc = useLocation();

  React.useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  const links = [
    { to: "/", label: "Accueil" },
    { to: "/shop", label: "Shop" },
    { to: "/blog", label: "Journal" },
  ];

  const logoSrc = theme === "dark" ? "/logo/logo-kami-offwhite.png" : "/logo/kami-street-black.png";
  const koalaSrc = theme === "dark" ? "/logo/logo-koala-offwhite.png" : "/logo/logo-koala-black.png";

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center">
          <img src={logoSrc} alt="Kami Street" className="h-8 md:h-10 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={`nav-link-${l.label.toLowerCase()}`}
              className={`text-sm uppercase tracking-widest font-medium hover:text-accent transition-colors ${loc.pathname === l.to ? "text-accent" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            data-testid="theme-toggle"
            className="p-2 hover:bg-secondary rounded-none border border-transparent hover:border-border transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setOpen(true)}
            data-testid="nav-cart-btn"
            className="relative p-2 hover:bg-secondary transition-colors"
            aria-label="Panier"
          >
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span data-testid="nav-cart-count" className="absolute -top-1 -right-1 bg-accent text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {count}
              </span>
            )}
          </button>
          <button className="md:hidden p-2" onClick={() => setMobileOpen(v => !v)} data-testid="nav-mobile-toggle">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border bg-background overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2">
                <img src={koalaSrc} alt="" className="h-6 w-auto" />
                <span className="display font-black tracking-tight">KAMI<span className="text-accent">.</span>STREET</span>
              </div>
              {links.map(l => (
                <Link key={l.to} to={l.to} className="uppercase tracking-widest text-sm py-2">{l.label}</Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
