"use client";
import { useEffect } from "react";

/** Full-screen modal layer with backdrop, Esc and click-outside close, and scroll lock. */
export function Overlay({ onClose, children, align = "center" }: { onClose: () => void; children: React.ReactNode; align?: "center" | "top" }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);
  return (
    <div role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className={`fixed inset-0 z-[100] grid animate-fadein justify-items-center bg-black/60 p-4 backdrop-blur-md ${align === "top" ? "items-start pt-[10vh]" : "place-items-center"}`}>
      {children}
    </div>
  );
}
