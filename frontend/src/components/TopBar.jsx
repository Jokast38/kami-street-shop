import React from "react";
import Marquee from "react-fast-marquee";

const MESSAGE = "🚚 Livraison en 48h partout en France · Kami Street — Fatbikes, scooters, trottinettes électriques & accessoires, Made in France ·";

export default function TopBar() {
  return (
    <Marquee className="ticker-strip" speed={35} gradient={false}>
      <span className="font-bold tracking-widest text-xs px-8 uppercase">{MESSAGE}</span>
      <span className="font-bold tracking-widest text-xs px-8 uppercase">{MESSAGE}</span>
    </Marquee>
  );
}
