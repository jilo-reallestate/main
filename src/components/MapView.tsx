"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { Art } from "@/components/Art";

export type Pin = { id: string; lat: number; lng: number; label: string; title: string; area: string; price: string; href: string; seed: number };

/** Free OpenStreetMap raster tiles (no account or key). Keep the attribution. For heavy traffic, host your own tiles or use a paid provider. */
const STYLE: maplibregl.StyleSpecification = { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] };

export default function MapView({ pins, className = "h-[420px]", initial }: { pins: Pin[]; className?: string; initial?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Pin | undefined>(pins.find((p) => p.id === initial) ?? pins[0]);
  useEffect(() => {
    if (!box.current) return;
    const map = new maplibregl.Map({ container: box.current, style: STYLE, center: [55.2, 25.15], zoom: 9.5, attributionControl: { compact: true } });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const els: HTMLElement[] = [];
    pins.forEach((p) => {
      const el = document.createElement("button"); el.className = "pin-pill"; el.textContent = p.label; el.setAttribute("aria-label", p.title);
      el.onclick = () => setActive(p); el.onmouseenter = () => setActive(p); els.push(el);
      new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    });
    if (pins.length > 1) { const b = new maplibregl.LngLatBounds(); pins.forEach((p) => b.extend([p.lng, p.lat])); map.fitBounds(b, { padding: 70, maxZoom: 13, duration: 0 }); }
    else if (pins[0]) map.jumpTo({ center: [pins[0].lng, pins[0].lat], zoom: 13.5 });
    return () => map.remove();
  }, [pins]);
  return (
    <div className={`relative overflow-hidden rounded-lg bg-[#0c1417] ${className}`}>
      <div ref={box} className="absolute inset-0" />
      {active && pins.length > 0 && (
        <Link href={active.href} className="absolute bottom-4 start-4 z-10 flex w-[min(340px,calc(100%-2rem))] items-center gap-3.5 rounded-lg border border-white/15 bg-[#0f1416]/80 p-3 text-white backdrop-blur-xl">
          <Art seed={active.seed} className="h-20 w-20 flex-none overflow-hidden rounded-2xl [&_svg]:h-full [&_svg]:w-full" />
          <span className="min-w-0"><small className="block text-[#A9AFB4]">{active.area}</small><b className="block leading-tight">{active.title}</b><em className="font-bold not-italic text-gold-1">{active.price}</em></span>
        </Link>
      )}
    </div>
  );
}
