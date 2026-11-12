"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { importUnitsAction } from "@/actions/offplan";
import type { ImportResult } from "@/lib/offplan-service";
import { unitsFromCsv } from "@/lib/csv";
import { Button } from "@/components/ui/Button";
import { fieldCls } from "@/components/ui/Input";
import { formatNumber } from "@/lib/format";

/** CSV import with a validation preview. The preview and the real import use the same database rules; nothing is imported until every row is valid. */
export function UnitImporter({ projectId, locale }: { projectId: string; locale: string }) {
  const t = useTranslations("op"), [text, setText] = useState(""), [res, setRes] = useState<ImportResult | null>(null), [msg, setMsg] = useState<{ ok?: string; err?: string }>({}), [pending, go] = useTransition();
  const rows = () => { const r = unitsFromCsv(text); if (!r) { setMsg({ err: t("err.no_header") }); setRes(null); } return r; };
  const check = () => { setMsg({}); const r = rows(); if (!r) return; go(async () => { const x = await importUnitsAction(projectId, r, false); if (x.error) setMsg({ err: x.error }); else setRes(x.result!); }); };
  const commit = () => { const r = rows(); if (!r) return; go(async () => { const x = await importUnitsAction(projectId, r, true); if (x.error) setMsg({ err: x.error }); else { setMsg({ ok: t("unit.imported", { n: x.result!.inserted }) }); setRes(null); setText(""); } }); };
  return (
    <section className="rounded-lg bg-surf p-6">
      <h3 className="text-xl font-semibold">{t("unit.import")}</h3>
      <p className="mt-2 text-sm text-mu">{t("unit.csvHint")}</p>
      <label className="mt-4 grid gap-1.5 text-sm"><span className="label">{t("unit.chooseFile")}</span><input type="file" accept=".csv,text/csv,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); setRes(null); setMsg({}); } }} className="text-sm" /></label>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} placeholder={t("unit.csvPaste")} rows={6} dir="ltr" className={fieldCls + " mt-3 py-3 font-mono text-xs"} />
      <div className="mt-3 flex flex-wrap items-center gap-3"><Button type="button" variant="outline" small disabled={!text.trim() || pending} onClick={check}>{t("unit.preview")}</Button>
        {res && res.invalid === 0 && <Button type="button" variant="gold" small disabled={pending} onClick={commit}>{t("unit.confirm", { n: res.valid })}</Button>}</div>
      {msg.err && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{msg.err}</p>}
      {msg.ok && <p role="status" className="mt-3 text-sm font-semibold text-success">✓ {msg.ok}</p>}
      {res && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold"><span className="text-success">{t("unit.valid", { n: res.valid })}</span> · <span className={res.invalid ? "text-danger" : "text-mu"}>{t("unit.invalid", { n: res.invalid })}</span></p>
          {res.invalid > 0 && <p className="mb-2 text-sm text-mu">{t("unit.fixErrors")}</p>}
          <div className="max-h-96 overflow-auto rounded-2xl bg-bg"><table className="w-full min-w-[640px] text-sm"><thead><tr>{[t("unit.line"), t("unit.number"), t("unit.type"), t("unit.beds"), t("unit.size"), t("unit.price"), t("unit.status"), ""].map((h, i) => <th key={i} className="p-3 text-start text-xs font-semibold text-mu">{h}</th>)}</tr></thead>
            <tbody>{res.rows.map((r) => (
              <tr key={r.line} className={`border-t border-ln ${r.errors.length ? "bg-danger/5" : ""}`}>
                <td className="p-3" dir="ltr">{r.line + 1}</td><td className="p-3 font-semibold">{r.unit_number}</td><td className="p-3">{r.unit_type}</td><td className="p-3">{r.bedrooms}</td>
                <td className="p-3">{r.size_sqft ? formatNumber(Number(r.size_sqft), locale) : ""}</td><td className="p-3">{r.price ? formatNumber(Number(r.price), locale) : ""}</td><td className="p-3">{r.status}</td>
                <td className="p-3 text-danger">{r.errors.map((c) => t(`err.${c}` as "err.bad_price")).join(" · ")}</td></tr>))}</tbody></table></div>
        </div>)}
    </section>
  );
}
