import { useTranslations } from "next-intl";
import { formatMoney, type Currency } from "@/lib/money";

type M = { sort_order: number; label_en: string; label_ar: string | null; percentage: number; trigger_type: string; due_offset_days: number | null; fixed_date: string | null; construction_stage: string | null };
const day = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

/** Payment plan as a visual timeline: a proportional bar on top, then one step per milestone with when it falls due. Pass price to show amounts. */
export function PlanTimeline({ milestones, locale, handover, price, currency = "AED" }: { milestones: M[]; locale: string; handover?: string | null; price?: number; currency?: string }) {
  const t = useTranslations("op.pub"), ar = locale === "ar";
  const due = (m: M) => {
    const d = m.due_offset_days ?? 0;
    if (m.fixed_date) return day(m.fixed_date, locale);
    if (m.trigger_type === "on_handover") return handover ? `${t("handoverStep")} · ${day(handover, locale)}` : t("handoverStep");
    if (m.trigger_type === "post_handover") return t("afterHandover", { d });
    return d === 0 ? t("booking") : t("afterBooking", { d });
  };
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surf" aria-hidden>{milestones.map((m, i) => <span key={m.sort_order} style={{ width: `${m.percentage}%` }} className={i % 2 ? "bg-gold-1" : "bg-gold-2"} />)}</div>
      <ol className="mt-6 border-s-2 border-ln">
        {milestones.map((m) => (
          <li key={m.sort_order} className="relative ps-6 pb-6 last:pb-0">
            <span className="absolute -start-[9px] top-1 h-4 w-4 rounded-full border-2 border-bg bg-goldgrad" />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <b className="text-2xl font-semibold" dir="ltr">{Number(m.percentage)}%</b>
              <span className="font-semibold">{(ar ? m.label_ar : null) ?? m.label_en}{m.construction_stage ? ` · ${m.construction_stage}` : ""}</span>
            </div>
            <p className="text-sm text-mu">{due(m)}{price ? <span> · {formatMoney(Math.round((price * Number(m.percentage)) / 100), currency as Currency, locale)}</span> : null}</p>
          </li>))}
      </ol>
    </div>
  );
}
