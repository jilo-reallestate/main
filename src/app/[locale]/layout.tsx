import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/Providers";
import { getAreas } from "@/lib/data";
import { SITE_URL } from "@/lib/seo";
import "../globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-arabic", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), applicationName: "JILO Real Estate", title: { default: "JILO Real Estate", template: "%s | JILO Real Estate" },
  openGraph: { siteName: "JILO Real Estate", type: "website" }, twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined, other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined },
};
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" as const };
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })); }

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "en" | "ar")) notFound();
  setRequestLocale(locale);
  const [messages, areas] = await Promise.all([getMessages(), getAreas(locale)]);
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${sans.variable} ${arabic.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('jilo-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}" }} /></head>
      <body>
        <noscript><style>{".reveal{opacity:1!important;transform:none!important}"}</style></noscript>
        <NextIntlClientProvider messages={messages}><Providers areas={areas}>{children}</Providers></NextIntlClientProvider>
      </body>
    </html>
  );
}
