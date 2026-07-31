import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "@/context/ThemeContext";

const STORE_LOCATION = [48.9515, 2.3089];

export default function StoreMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const tileLayer = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return undefined;

    const map = L.map(mapRef.current, {
      center: STORE_LOCATION,
      zoom: 16,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.marker(STORE_LOCATION, {
      icon: L.divIcon({
        className: "kami-store-marker",
        html: '<span class="kami-store-marker-pin"><span></span></span>',
        iconSize: [38, 46],
        iconAnchor: [19, 44],
        popupAnchor: [0, -40],
      }),
    })
      .addTo(map)
      .bindPopup("<strong>Kami Street</strong><br />59 Avenue Joffre<br />93800 Épinay-sur-Seine")
      .openPopup();

    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
      tileLayer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    const isDark = theme === "dark";
    const tileUrl = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const attribution = isDark
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    if (tileLayer.current) mapInstance.current.removeLayer(tileLayer.current);
    tileLayer.current = L.tileLayer(tileUrl, { attribution, maxZoom: 19 });
    tileLayer.current.addTo(mapInstance.current);
  }, [theme]);

  return <div ref={mapRef} className="store-map h-[300px] md:h-[380px] w-full" aria-label="Carte de la boutique Kami Street" />;
}
