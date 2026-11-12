"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { OpState } from "@/actions/offplan";
import { btn } from "@/components/ui/Button";

type Variant = Parameters<typeof btn>[0];
/** Form that runs a server action and shows its result. Inputs keep their values on an error (React would otherwise clear them).
 *  okText may contain {n}, replaced with the number the action returns. An error starting with "code:" is a validation code that is translated. */
export function OpForm({ action, children, submit, okText, reset, confirm, small, variant = "primary", className, buttonClassName }: {
  action: (p: OpState, fd: FormData) => Promise<OpState>; children?: React.ReactNode; submit: string; okText?: string; reset?: boolean; confirm?: string;
  small?: boolean; variant?: Variant; className?: string; buttonClassName?: string;
}) {
  const t = useTranslations("op"), ref = useRef<HTMLFormElement>(null);
  const [s, run, pending] = useActionState<OpState, FormData>(action, null);
  useEffect(() => { if (s?.ok && reset) ref.current?.reset(); }, [s, reset]);
  const err = s?.error ? (s.error.startsWith("code:") ? t(`err.${s.error.slice(5)}` as "err.bad_price") : s.error) : null;
  return (
    <form ref={ref} className={className} onSubmit={(e) => { e.preventDefault(); if (confirm && !window.confirm(confirm)) return; const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
      {children}
      {err && <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-sm font-semibold text-danger">{err}</p>}
      {s?.ok && <p role="status" className="text-sm font-semibold text-success">✓ {(okText ?? t("c.saved")).replace("{n}", s.msg ?? "")}</p>}
      <button type="submit" disabled={pending} className={btn(variant, small, buttonClassName)}>{pending ? "…" : submit}</button>
    </form>
  );
}
