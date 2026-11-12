import { NextResponse } from "next/server";
import { hasServiceKey, serviceClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";

/**
 * Daily job (see vercel.json): finds new listings that match each saved search, creates the in-app notification, and emails the person.
 * Protected: the request must carry  Authorization: Bearer <CRON_SECRET>  (Vercel Cron adds this automatically).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasServiceKey()) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 503 });
  const { data, error } = await serviceClient().rpc("run_saved_search_alerts");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let emailed = 0, skipped = 0;
  for (const r of (data ?? []) as { email: string; locale: string; search_name: string; match_count: number; qs: string; sample: { slug: string; title: string; price: number; currency: string }[] }[]) {
    const ar = r.locale === "ar", base = `${SITE_URL}/${r.locale}`;
    const list = r.sample.map((s) => `<li><a href="${base}/properties/${encodeURIComponent(s.slug)}">${s.title}</a> — ${s.currency} ${Number(s.price).toLocaleString("en")}</li>`).join("");
    const html = `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif"><h2>${ar ? `${r.match_count} عقارات جديدة تطابق «${r.search_name}»` : `${r.match_count} new ${r.match_count === 1 ? "home matches" : "homes match"} “${r.search_name}”`}</h2><ul>${list}</ul><p><a href="${base}/properties?${r.qs}">${ar ? "عرض كل النتائج" : "See all results"}</a></p><p style="color:#888;font-size:12px">${ar ? "يمكنك إيقاف التنبيهات من حسابك." : "You can turn alerts off in your account."}</p></div>`;
    const res = await sendEmail({ to: r.email, subject: ar ? `عقارات جديدة: ${r.search_name}` : `New homes: ${r.search_name}`, html });
    res.sent ? emailed++ : skipped++;
  }
  return NextResponse.json({ alerts: (data ?? []).length, emailed, skipped });
}
