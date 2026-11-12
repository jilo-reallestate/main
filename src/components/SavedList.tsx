"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { getListingsByPropertyIds, type ListingRow } from "@/lib/data";
import { ListingCard } from "@/components/ListingCard";
import { useApp } from "@/components/Providers";
import { btn } from "@/components/ui/Button";

export function SavedList() {
  const { saved } = useApp(), locale = useLocale(), t = useTranslations(), [rows, setRows] = useState<ListingRow[]>([]), [ready, setReady] = useState(false);
  useEffect(() => { let on = true; getListingsByPropertyIds([...saved], locale).then((r) => { if (on) { setRows(r); setReady(true); } }); return () => { on = false; }; }, [saved, locale]);
  const shown = rows.filter((r) => saved.has(r.property.id));
  if (ready && !shown.length) return (
    <div className="mt-8 rounded-lg bg-surf p-14 text-center"><h3 className="text-2xl">{t("v2.x.svE")}</h3><p className="mb-5 mt-2 text-mu">{t("v2.x.svE2")}</p><Link href="/properties" className={btn("primary")}>{t("v2.cta2")} →</Link></div>
  );
  return <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{shown.map((l) => <ListingCard key={l.id} l={l} locale={locale} />)}</div>;
}
