"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Pin } from "@/components/MapView";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
export type { Pin };

/** Loads the map library only when the map scrolls near the screen, so it never slows the first page load. */
export function MapLoader({ pins, className = "h-[420px]", initial }: { pins: Pin[]; className?: string; initial?: string }) {
  const ref = useRef<HTMLDivElement>(null), [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`rounded-lg bg-[#0c1417] ${className}`}>{on && <MapView pins={pins} className={className} initial={initial} />}</div>;
}
