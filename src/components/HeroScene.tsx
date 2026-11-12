"use client";
import { useEffect, useRef } from "react";

/** Skyline artwork with mouse + scroll parallax. The SVG is generated on the server (lib/art.ts). */
export function HeroScene({ svg }: { svg: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current, hero = el?.parentElement; if (!el || !hero || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const groups = [...el.querySelectorAll<SVGGElement>("g[data-s]")];
    const mm = (e: MouseEvent) => { const dx = e.clientX / innerWidth - 0.5; groups.forEach((g) => { g.style.transition = "transform .5s cubic-bezier(.2,.8,.2,1)"; g.style.transform = `translateX(${-dx * Number(g.dataset.s) * 1400}px)`; }); };
    const sc = () => { el.style.transform = `translateY(${Math.min(scrollY, 700) * 0.22}px)`; };
    hero.addEventListener("mousemove", mm); addEventListener("scroll", sc, { passive: true });
    return () => { hero.removeEventListener("mousemove", mm); removeEventListener("scroll", sc); };
  }, []);
  return <div ref={ref} className="absolute inset-x-0 -top-[4%] bottom-0 will-change-transform [&_svg]:block [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
