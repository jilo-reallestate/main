"use client";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useApp, type CmpItem } from "@/components/Providers";

const Heart = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0112 6.2 5.4 5.4 0 0121.3 12C19 16.4 12 21 12 21z" /></svg>;

export function SaveButton({ id, className }: { id: string; className?: string }) {
  const { saved, toggleSave } = useApp(), t = useTranslations("v2.x"), on = saved.has(id);
  return (
    <button type="button" aria-pressed={on} aria-label={t("sv")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(id); }}
      className={clsx("grid h-10 w-10 place-items-center rounded-full bg-white/80 text-[#0B0D0E] backdrop-blur-md transition hover:scale-110", on && "text-danger [&_svg]:fill-danger", className)}><Heart /></button>
  );
}
export function SaveLabelButton({ id }: { id: string }) {
  const { saved, toggleSave } = useApp(), t = useTranslations("v2.x"), on = saved.has(id);
  return <button type="button" aria-pressed={on} onClick={() => toggleSave(id)} className={clsx("rounded-full border border-ln px-4 py-2 text-[13px] font-semibold hover:bg-surf", on && "text-danger")}>{on ? "♥" : "♡"} {on ? t("svT") : t("sv")}</button>;
}
export function ShareButton() {
  const { toast } = useApp(), t = useTranslations("v2.x");
  return <button type="button" onClick={() => { navigator.clipboard?.writeText(location.href).catch(() => {}); toast(t("cop")); }} className="rounded-full border border-ln px-4 py-2 text-[13px] font-semibold hover:bg-surf">{t("sh")}</button>;
}
export function CompareButton({ item }: { item: CmpItem }) {
  const { cmp, toggleCmp } = useApp(), t = useTranslations("v2.x"), on = cmp.some((x) => x.id === item.id);
  return (
    <button type="button" aria-pressed={on} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCmp(item); }}
      className={clsx("rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition md:opacity-0 md:group-hover:opacity-100", on ? "bg-ink text-white md:opacity-100" : "bg-white/80 text-[#0B0D0E]")}>{on ? "✓ " : "+ "}{t("cp")}</button>
  );
}
