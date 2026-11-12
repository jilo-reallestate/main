"use client";
import { useTranslations } from "next-intl";
import { btn } from "@/components/ui/Button";

/** Sticky Call / WhatsApp / Enquire bar for phones. */
export function PropertyActionBar({ whatsapp, phone }: { whatsapp?: string | null; phone?: string | null }) {
  const x = useTranslations("v2.x"), wa = whatsapp?.replace(/\D/g, "");
  return (
    <div className="glass fixed inset-x-3 bottom-3 z-50 flex gap-1.5 rounded-full p-1.5 shadow-2xl md:hidden">
      {phone && <a href={`tel:${phone}`} className={btn("outline", true, "flex-1")}>{x("cl2")}</a>}
      {wa && <a href={`https://wa.me/${wa}`} className={btn("gold", true, "flex-1")}>{x("wa")}</a>}
      <a href="#enquire" className={btn("primary", true, "flex-1")}>{x("en")}</a>
    </div>
  );
}
