"use client";
import clsx from "clsx";
import { createContext, startTransition, useActionState, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { addAmenityAction, refreshSite, saveListingAction, type FormState } from "@/actions/listings";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { uploadNewPhotos } from "@/lib/photos-client";
import { fieldCls } from "@/components/ui/Input";

export type ListingInit = Record<string, string> & { amenities?: never };
export type Initial = { values: Record<string, string>; amenities: string[]; status?: string };
type Opt = { code: string; name: string };
const TYPES = ["apartment", "villa", "townhouse", "studio", "penthouse", "duplex", "hotel_apartment", "land", "office", "shop", "warehouse", "building"];

const Defaults = createContext<Record<string, string>>({});
const useV = () => { const d = useContext(Defaults); return (k: string) => d[k] ?? ""; };
function F({ k, label, type = "text", req = false, ...r }: { k: string; label: string; type?: string; req?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const v = useV();
  return <label className="grid gap-1.5 text-sm"><span className="label">{label}{req && " *"}</span><input name={k} type={type} defaultValue={v(k)} required={req} className={fieldCls} {...r} /></label>;
}
function S({ k, label, children, onChange }: { k: string; label: string; children: React.ReactNode; onChange?: (v: string) => void }) {
  const v = useV();
  return <label className="grid gap-1.5 text-sm"><span className="label">{label}</span><select name={k} defaultValue={v(k)} onChange={(e) => onChange?.(e.target.value)} className={fieldCls}>{children}</select></label>;
}
function T({ k, label, dir, req = false }: { k: string; label: string; dir?: "rtl"; req?: boolean }) {
  const v = useV();
  return <label className="grid gap-1.5 text-sm"><span className="label">{label}{req && " *"}</span><textarea name={k} rows={k.startsWith("desc") ? 5 : 1} defaultValue={v(k)} dir={dir} className={clsx(fieldCls, "py-3")} /></label>;
}

export function ListingForm({ locale, listingId, initial, areas, amenities, agents, isAdmin }: { locale: string; listingId?: string; initial: Initial; areas: Opt[]; amenities: (Opt & { cat: string })[]; agents?: Opt[]; isAdmin: boolean }) {
  const t = useTranslations(), f = useTranslations("mgr.f");
  const router = useRouter(), sb = useMemo(() => createClient(), []);
  const [state, run, pending] = useActionState<FormState, FormData>(saveListingAction, null);
  const [files, setFiles] = useState<File[]>([]), [uploading, setUploading] = useState(0), [photoFail, setPhotoFail] = useState<{ n: number; listingId: string } | null>(null);
  const handled = useRef<unknown>(null), previews = useMemo(() => files.map((x) => URL.createObjectURL(x)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  // A new listing: once it is saved, upload the chosen photos, then open it. If some photos fail, stay here and say so.
  useEffect(() => {
    const c = state?.created; if (!c || handled.current === state) return; handled.current = state;
    (async () => {
      let failed = 0;
      if (files.length) { setUploading(1); failed = await uploadNewPhotos(sb, c.propertyId, files, (n) => setUploading(Math.min(n + 1, files.length))); void refreshSite(); }
      if (failed) { setUploading(0); setPhotoFail({ n: failed, listingId: c.listingId }); } else router.push(`/agent/listings/${c.listingId}`);
    })();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = pending || uploading > 0;
  // Admin can add amenities on the spot; new ones appear in the list already ticked.
  const [extra, setExtra] = useState<Opt[]>([]), [newEn, setNewEn] = useState(""), [newAr, setNewAr] = useState(""), [amErr, setAmErr] = useState(""), [amBusy, setAmBusy] = useState(false);
  async function addAmenity() {
    if (!newEn.trim() && !newAr.trim()) return;
    setAmBusy(true); setAmErr("");
    const r = await addAmenityAction(newEn, newAr); setAmBusy(false);
    if (r.error || !r.amenity) { setAmErr(r.error === "forbidden" ? t("mgr.err.forbidden") : r.error ?? ""); return; }
    const a = r.amenity; if (![...amenities, ...extra].some((x) => x.code === a.code)) setExtra((x) => [...x, { code: a.code, name: locale === "ar" ? a.name_ar : a.name_en }]);
    setNewEn(""); setNewAr("");
  }
  const [purpose, setPurpose] = useState(initial.values.purpose || "sale");
  const card = "rounded-lg bg-surf p-6", h2 = "mb-4 text-2xl", grid = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <Defaults.Provider value={initial.values}>
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter); startTransition(() => run(fd)); }} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="listing_id" value={listingId ?? ""} />
      {state?.ok && <p role="status" className="rounded-lg bg-success/10 p-4 font-semibold text-success">✓ {state.status === "published" ? f("published") : state.status === "pending_review" ? f("submitted") : f("saved")}</p>}
      {photoFail && <p role="alert" className="rounded-lg bg-danger/10 p-4 font-semibold text-danger">{f("photosFailed", { n: photoFail.n })} <Link href={`/agent/listings/${photoFail.listingId}`} className="underline">{f("openListing")}</Link></p>}
      {uploading > 0 && <p role="status" className="rounded-lg bg-surf p-4 font-semibold">{f("photosUploading", { n: uploading, total: files.length })}</p>}
      {state?.error && <p role="alert" className="rounded-lg bg-danger/10 p-4 font-semibold text-danger">{state.error === "forbidden" ? t("mgr.err.forbidden") : state.error}</p>}

      <section className={card}><h2 className={h2}>{f("basics")}</h2><div className={grid}>
        <S k="purpose" label={f("purpose")} onChange={setPurpose}><option value="sale">{f("sale")}</option><option value="rent">{f("rent")}</option></S>
        <S k="type" label={f("type")}>{TYPES.map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}</S>
        <F k="area_name" label={f("area")} list="area-list" placeholder={f("areaPh")} autoComplete="off" /><datalist id="area-list">{areas.map((a) => <option key={a.code} value={a.name} />)}</datalist>
        <F k="building_name" label={f("building")} /><S k="completion_status" label={f("completion")}><option value="ready">{f("ready")}</option><option value="off_plan">{f("off_plan")}</option></S>
        {isAdmin && agents && <S k="agent_id" label={f("agent")}>{agents.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</S>}
      </div><p className="mt-3 text-xs text-mu">{f("areaHint")}</p></section>

      <section className={card}><h2 className={h2}>{f("details")}</h2><div className={grid}>
        <F k="bedrooms" label={f("beds")} type="number" min={0} max={20} /><F k="bathrooms" label={f("baths")} type="number" min={0} max={20} />
        <F k="size_sqft" label={f("size")} type="number" min={1} step="any" /><F k="plot_sqft" label={f("plot")} type="number" min={1} step="any" />
        <F k="floor_number" label={f("floor")} type="number" /><F k="parking_spaces" label={f("parking")} type="number" min={0} />
        <S k="furnishing" label={f("furnishing")}><option value="">{f("none")}</option><option value="unfurnished">{f("unfurnished")}</option><option value="semi_furnished">{f("semi_furnished")}</option><option value="furnished">{f("furnished")}</option></S>
        <F k="view_type" label={f("view")} />
      </div>
        <h3 className="mb-2 mt-6 text-lg">{f("location")}</h3><div className={clsx(grid, "lg:grid-cols-2")}><F k="lat" label={f("lat")} type="number" step="any" min={-90} max={90} dir="ltr" /><F k="lng" label={f("lng")} type="number" step="any" min={-180} max={180} dir="ltr" /></div>
        <p className="mt-2 text-xs text-mu">{f("locHint")}</p></section>

      <section className={card}><h2 className={h2}>{f("pricing")}</h2><div className={grid}>
        <F k="price" label={f("price")} type="number" min={1} step="any" req dir="ltr" />
        <S k="currency" label={f("currency")}><option value="AED">AED</option><option value="USD">USD</option><option value="GBP">GBP</option></S>
        <F k="permit_number" label={f("permit")} dir="ltr" />
        {purpose === "rent" && <>
          <S k="price_period" label={f("period")}><option value="yearly">{f("yearly")}</option><option value="monthly">{f("monthly")}</option><option value="weekly">{f("weekly")}</option><option value="daily">{f("daily")}</option></S>
          <F k="cheques" label={f("cheques")} type="number" min={1} max={12} /><F k="deposit_amount" label={f("deposit")} type="number" min={0} step="any" /></>}
      </div></section>

      <section className={card}><h2 className={h2}>{f("amenities")}</h2>
        <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{[...amenities, ...extra].map((a) => (
          <label key={a.code} className="flex items-center gap-2.5 rounded-2xl bg-bg px-4 py-3 text-sm"><input type="checkbox" name="amenities" value={a.code} defaultChecked={initial.amenities.includes(a.code) || extra.some((x) => x.code === a.code)} className="h-4 w-4 accent-gold-3" />{a.name}</label>))}</div>
        {isAdmin && (
          <div className="mt-5 rounded-2xl bg-bg p-4">
            <h3 className="mb-3 text-base font-semibold">{f("amenityAdd")}</h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              {[[f("amenityEn"), newEn, setNewEn, undefined], [f("amenityAr"), newAr, setNewAr, "rtl"]].map(([label, val, set, dir], i) => (
                <label key={i} className="grid gap-1.5 text-sm"><span className="label">{label as string}</span>
                  <input value={val as string} dir={dir as "rtl" | undefined} maxLength={60} onChange={(e) => (set as (v: string) => void)(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addAmenity(); } }} className={fieldCls} /></label>))}
              <button type="button" onClick={() => void addAmenity()} disabled={amBusy} className="min-h-[46px] rounded-full border-[1.5px] border-ln px-6 font-semibold hover:bg-surf disabled:opacity-50">+ {f("amenityBtn")}</button>
            </div>
            {amErr && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{amErr}</p>}
          </div>)}
      </section>

      <section className={card}><h2 className={h2}>{f("content")}</h2><p className="mb-2 text-sm text-mu">{f("arHint")}</p><p className="mb-4 text-sm text-mu">{f("titleHint")}</p>
        <div className="grid gap-4 lg:grid-cols-2"><div className="grid gap-4"><T k="title_en" label={f("titleEn")} /><T k="desc_en" label={f("descEn")} /></div>
          <div className="grid gap-4"><T k="title_ar" label={f("titleAr")} dir="rtl" /><T k="desc_ar" label={f("descAr")} dir="rtl" /></div></div></section>

      {!listingId && (
        <section className={card}><h2 className={h2}>{f("photos")}</h2><p className="mb-4 text-sm text-mu">{f("photosHint")}</p>
          <label className="inline-flex min-h-[46px] cursor-pointer items-center rounded-full border-[1.5px] border-ln px-6 font-semibold hover:bg-bg">{f("addPhotos")}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { setFiles((x) => [...x, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} /></label>
          {files.length > 0 && <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">{previews.map((src, i) => (
            <li key={src} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-bg">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute start-2 top-2 rounded-full bg-gold-3 px-2 py-0.5 text-[10px] font-bold text-black">{f("photoCover")}</span>}
              <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label={f("removePhoto")} className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white">×</button></li>))}</ul>}
        </section>)}

      <div className="sticky bottom-3 z-20 flex flex-wrap gap-3 rounded-full glass p-2.5 shadow-xl">
        <button name="intent" value="save" disabled={busy} className="min-h-[46px] flex-1 rounded-full border-[1.5px] border-ln px-6 font-semibold hover:bg-surf disabled:opacity-50">{f("save")}</button>
        <button name="intent" value="submit" disabled={busy} className="min-h-[46px] flex-1 rounded-full bg-goldgrad px-6 font-bold text-[#1a1409] disabled:opacity-50">{isAdmin ? f("publish") : f("submit")}</button>
      </div>
    </form>
    </Defaults.Provider>
  );
}
