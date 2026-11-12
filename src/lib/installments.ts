/** Shared query + helpers for off-plan installments (admin list, admin overview, buyer page). */
export const installmentSelect = `id, sort_order, label_en, label_ar, due_date, amount, paid_amount, currency, status,
  deal:deals!deal_id(id, contact:contacts!contact_id(full_name), unit:units!unit_id(unit_number, project:projects(project_translations(locale, name))))`;

export type InstRow = {
  id: string; sort_order: number; label_en: string; label_ar: string | null; due_date: string; amount: number; paid_amount: number; currency: string; status: string;
  deal: { id: string; contact: { full_name: string } | null; unit: { unit_number: string; project: { project_translations: { locale: string; name: string }[] } | null } | null } | null;
};
/** The database marks "overdue" once a day; the screens work it out from the due date so it is never a day late. */
export const effStatus = (r: { status: string; due_date: string; amount: number; paid_amount: number }, today: string) =>
  r.status === "paid" || r.status === "waived" ? r.status : r.paid_amount >= r.amount ? "paid" : r.due_date < today ? "overdue" : r.paid_amount > 0 ? "partial" : "scheduled";
export const instName = (r: InstRow, locale: string) => {
  const u = r.deal?.unit; if (!u) return "—";
  return `${(u.project?.project_translations.find((x) => x.locale === locale) ?? u.project?.project_translations[0])?.name ?? ""} · ${u.unit_number}`;
};
