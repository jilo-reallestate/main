"use client";
import { useEffect, useRef, useState } from "react";

export function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLElement>(null), [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current; if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const f = (n: number) => { const p = Math.min(1, (n - t0) / 1400); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); };
      setV(0); requestAnimationFrame(f);
    }, { threshold: 0.4 });
    io.observe(el); return () => io.disconnect();
  }, [to]);
  return <b ref={ref} className="block text-[clamp(40px,7vw,88px)] font-bold leading-none tracking-[-.06em]">{v}{suffix}</b>;
}
