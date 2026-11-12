"use client";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { mediaUrl } from "@/lib/data";
import { refreshSite } from "@/actions/listings";
import { shrink } from "@/lib/photos-client";

export type Photo = { id: string; path: string; is_cover: boolean; sort_order: number };
const sorted = (a: Photo[]) => [...a].sort((x, y) => Number(y.is_cover) - Number(x.is_cover) || x.sort_order - y.sort_order);

/** Uploads straight from the browser to the property-media bucket (permission: only people who can edit this property). Photos are resized to 2000px WebP first. */
export function PhotoManager({ propertyId, initial, table = "property_media", bucket = "property-media", fk = "property_id" }: { propertyId: string; initial: Photo[]; table?: string; bucket?: string; fk?: string }) {
  const t = useTranslations("mgr.ph"), sb = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Photo[]>(sorted(initial)), [busy, setBusy] = useState(false), [err, setErr] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return; setBusy(true); setErr("");
    let next = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0, list = [...items];
    for (const f of Array.from(files)) {
      try {
        const path = `${propertyId}/${crypto.randomUUID()}.webp`, blob = await shrink(f);
        const up = await sb.storage.from(bucket).upload(path, blob, { contentType: "image/webp" }); if (up.error) throw up.error;
        const { data, error } = await sb.from(table).insert({ [fk]: propertyId, kind: "image", path, sort_order: next++, is_cover: list.length === 0 }).select("id, path, is_cover, sort_order").single();
        if (error) throw error; list = [...list, data as Photo]; setItems(sorted(list));
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    }
    setBusy(false); void refreshSite();
  }
  async function cover(id: string) {
    await sb.from(table).update({ is_cover: false }).eq(fk, propertyId); await sb.from(table).update({ is_cover: true }).eq("id", id);
    setItems(sorted(items.map((i) => ({ ...i, is_cover: i.id === id })))); void refreshSite();
  }
  async function remove(p: Photo) {
    await sb.from(table).delete().eq("id", p.id); await sb.storage.from(bucket).remove([p.path]);
    const rest = items.filter((i) => i.id !== p.id);
    if (p.is_cover && rest[0]) { await sb.from(table).update({ is_cover: true }).eq("id", rest[0].id); rest[0] = { ...rest[0], is_cover: true }; }
    setItems(sorted(rest)); void refreshSite();
  }
  async function move(i: number, d: -1 | 1) {
    const a = items[i], b = items[i + d]; if (!a || !b) return;
    await sb.from(table).update({ sort_order: b.sort_order }).eq("id", a.id); await sb.from(table).update({ sort_order: a.sort_order }).eq("id", b.id);
    setItems(sorted(items.map((x) => (x.id === a.id ? { ...x, sort_order: b.sort_order } : x.id === b.id ? { ...x, sort_order: a.sort_order } : x)))); void refreshSite();
  }
  const b = "rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-black";
  return (
    <section className="rounded-lg bg-surf p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">{t("title")}</h2>
        <label className={clsx("inline-flex min-h-[46px] cursor-pointer items-center rounded-full bg-goldgrad px-6 font-semibold text-[#1a1409]", busy && "pointer-events-none opacity-60")}>{busy ? t("uploading") : t("upload")}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} /></label></div>
      <p className="mt-2 text-sm text-mu">{t("hint")}</p>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      {items.length === 0 ? <p className="mt-6 text-mu">{t("none")}</p> : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((p, i) => (
          <li key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(p.path, bucket)} alt="" className="h-full w-full object-cover" />
            {p.is_cover && <span className="absolute start-2 top-2 rounded-full bg-goldgrad px-2.5 py-1 text-[11px] font-bold text-[#1a1409]">{t("cover")}</span>}
            <div className="absolute inset-x-2 bottom-2 flex flex-wrap gap-1">
              {!p.is_cover && <button type="button" onClick={() => cover(p.id)} className={b}>{t("setCover")}</button>}
              <button type="button" aria-label={t("up")} onClick={() => move(i, -1)} className={b}>←</button><button type="button" aria-label={t("down")} onClick={() => move(i, 1)} className={b}>→</button>
              <button type="button" onClick={() => remove(p)} className={clsx(b, "!text-danger")}>{t("remove")}</button>
            </div>
          </li>))}</ul>)}
    </section>
  );
}
