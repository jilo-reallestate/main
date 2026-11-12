"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { IS_DEMO, type AreaOpt } from "@/lib/data";
import { CommandPalette } from "@/components/CommandPalette";
import { CompareDock } from "@/components/CompareDock";
import { MobileBar } from "@/components/MobileBar";

export type CmpItem = { id: string; href: string; title: string; area: string; price: string; type: string; beds: string; baths: string; size: string; ppsf: string; seed: number; cover?: string };
type Ctx = {
  saved: Set<string>; toggleSave: (id: string) => void;
  cmp: CmpItem[]; toggleCmp: (i: CmpItem) => void; removeCmp: (id: string) => void; clearCmp: () => void;
  searchOpen: boolean; setSearchOpen: (b: boolean) => void; compareOpen: boolean; setCompareOpen: (b: boolean) => void;
  toast: (m: string) => void;
};
const C = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(C); if (!c) throw new Error("Providers missing"); return c; };

const LS = { saved: "jilo.saved", cmp: "jilo.cmp" };

export function Providers({ areas, children }: { areas: AreaOpt[]; children: React.ReactNode }) {
  const locale = useLocale();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [cmp, setCmp] = useState<CmpItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    try { setSaved(new Set(JSON.parse(localStorage.getItem(LS.saved) ?? "[]"))); setCmp(JSON.parse(localStorage.getItem(LS.cmp) ?? "[]")); } catch { /* ignore */ }
    if (IS_DEMO) return;
    const sb = createClient();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      const { data: favs } = await sb.from("favorites").select("property_id");
      if (favs) setSaved((s) => new Set([...s, ...favs.map((f) => f.property_id as string)]));
    });
  }, []);
  useEffect(() => { try { localStorage.setItem(LS.saved, JSON.stringify([...saved])); } catch { /* ignore */ } }, [saved]);
  useEffect(() => { try { localStorage.setItem(LS.cmp, JSON.stringify(cmp)); } catch { /* ignore */ } }, [cmp]);

  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 1800); }, []);
  const toggleSave = useCallback((id: string) => {
    setSaved((s) => {
      const n = new Set(s), had = n.has(id);
      had ? n.delete(id) : n.add(id);
      if (uid) { const sb = createClient(); void (had ? sb.from("favorites").delete().eq("property_id", id).eq("user_id", uid) : sb.from("favorites").insert({ property_id: id, user_id: uid })); }
      return n;
    });
  }, [uid]);
  const toggleCmp = useCallback((i: CmpItem) => setCmp((c) => (c.some((x) => x.id === i.id) ? c.filter((x) => x.id !== i.id) : c.length >= 3 ? (toast("3 max"), c) : [...c, i])), [toast]);
  const value = useMemo<Ctx>(() => ({ saved, toggleSave, cmp, toggleCmp, removeCmp: (id) => setCmp((c) => c.filter((x) => x.id !== id)), clearCmp: () => setCmp([]), searchOpen, setSearchOpen, compareOpen, setCompareOpen, toast }),
    [saved, toggleSave, cmp, toggleCmp, searchOpen, compareOpen, toast]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName ?? "");
      if (e.key === "Escape") { setSearchOpen(false); setCompareOpen(false); }
      if (!typing && (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) { e.preventDefault(); setSearchOpen(true); }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  return (
    <C.Provider value={value}>
      {children}
      <CommandPalette areas={areas} locale={locale} />
      <CompareDock />
      <MobileBar />
      {msg && <div role="status" className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 animate-fadein rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">{msg}</div>}
    </C.Provider>
  );
}
