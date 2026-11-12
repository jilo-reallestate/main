/** Sends email through Resend (https://resend.com) when RESEND_API_KEY is set. Without it nothing is sent (alerts still appear in the app). */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "JILO Real Estate <onboarding@resend.dev>", to, subject, html }) });
  return res.ok ? { sent: true } : { sent: false, reason: `Resend ${res.status}` };
}
