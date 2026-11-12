/**
 * Demo content. Used automatically when Supabase keys are missing (or NEXT_PUBLIC_DEMO=1) so the whole site can be
 * shown to the client before the database is connected. Mirrors the shape of the real queries in data.ts.
 */
import type { Currency } from "@/lib/money";

export const DEMO_AREAS = [
  { id: "marina", code: "marina", en: "Dubai Marina", ar: "دبي مارينا", lat: 25.0805, lng: 55.1403 },
  { id: "downtown", code: "downtown", en: "Downtown Dubai", ar: "وسط مدينة دبي", lat: 25.1972, lng: 55.2744 },
  { id: "palm", code: "palm", en: "Palm Jumeirah", ar: "نخلة جميرا", lat: 25.1124, lng: 55.139 },
  { id: "business", code: "business", en: "Business Bay", ar: "الخليج التجاري", lat: 25.185, lng: 55.262 },
  { id: "jvc", code: "jvc", en: "Jumeirah Village Circle", ar: "قرية جميرا الدائرية", lat: 25.06, lng: 55.21 },
  { id: "hills", code: "hills", en: "Dubai Hills Estate", ar: "دبي هيلز استيت", lat: 25.105, lng: 55.245 },
  { id: "saadiyat", code: "saadiyat", en: "Saadiyat Island", ar: "جزيرة السعديات", lat: 24.54, lng: 54.43 },
];

export type DemoItem = {
  id: string; ref: string; type: string; beds: number; baths: number; sqft: number; purpose: "sale" | "rent"; price: number; cur: Currency;
  period: "yearly" | "monthly" | null; area: string; lat: number; lng: number; off?: boolean; nw?: boolean; dr?: boolean; featured?: boolean; aed: number;
  en: { title: string; desc: string }; ar: { title: string; desc: string };
};

const D = (o: Omit<DemoItem, "id" | "ref">, n: number): DemoItem => ({ ...o, id: `demo-${n}`, ref: `JL-00${1000 + n}` });
export const DEMO_ITEMS: DemoItem[] = [
  D({ type: "apartment", beds: 2, baths: 3, sqft: 1480, purpose: "sale", price: 3450000, cur: "AED", period: null, area: "marina", lat: 25.0795, lng: 55.1415, nw: true, featured: true, aed: 3450000,
    en: { title: "Marina view two-bedroom", desc: "Bright corner apartment on a high floor with full marina views, a large balcony and two parking spaces." },
    ar: { title: "شقة بغرفتين وإطلالة على المارينا", desc: "شقة زاوية مشرقة في طابق مرتفع بإطلالة كاملة على المارينا، مع شرفة واسعة وموقفين للسيارات." } }, 0),
  D({ type: "apartment", beds: 2, baths: 2, sqft: 1210, purpose: "rent", price: 145000, cur: "AED", period: "yearly", area: "downtown", lat: 25.1962, lng: 55.2759, featured: true, aed: 145000,
    en: { title: "Furnished city view two-bedroom", desc: "Fully furnished two-bedroom minutes from the boulevard, available for yearly rent with up to four cheques." },
    ar: { title: "شقة مفروشة بإطلالة على المدينة", desc: "شقة مفروشة بالكامل بغرفتين على بعد دقائق من البوليفارد، متاحة للإيجار السنوي بأربع دفعات." } }, 1),
  D({ type: "villa", beds: 4, baths: 5, sqft: 4100, purpose: "sale", price: 3380000, cur: "USD", period: null, area: "saadiyat", lat: 24.5412, lng: 54.4312, featured: true, aed: 12413050,
    en: { title: "Four-bedroom garden villa", desc: "Family villa near the beach with a private garden, maid’s room and covered parking." },
    ar: { title: "فيلا بأربع غرف مع حديقة", desc: "فيلا عائلية قرب الشاطئ مع حديقة خاصة وغرفة خادمة ومواقف مغطاة." } }, 2),
  D({ type: "studio", beds: 0, baths: 1, sqft: 450, purpose: "rent", price: 48000, cur: "AED", period: "yearly", area: "jvc", lat: 25.0612, lng: 55.2112, dr: true, aed: 48000,
    en: { title: "Modern studio in JVC", desc: "Efficient studio with a built-in kitchen, close to parks and schools." },
    ar: { title: "استوديو عصري في JVC", desc: "استوديو عملي بمطبخ مدمج قريب من الحدائق والمدارس." } }, 3),
  D({ type: "penthouse", beds: 4, baths: 5, sqft: 6200, purpose: "sale", price: 18500000, cur: "AED", period: null, area: "palm", lat: 25.1131, lng: 55.1401, featured: true, aed: 18500000,
    en: { title: "Palm Jumeirah penthouse", desc: "Sky penthouse with a private pool terrace and panoramic sea views." },
    ar: { title: "بنتهاوس نخلة جميرا", desc: "بنتهاوس مرتفع مع تراس ومسبح خاص وإطلالة بانورامية على البحر." } }, 4),
  D({ type: "apartment", beds: 1, baths: 2, sqft: 820, purpose: "rent", price: 8500, cur: "AED", period: "monthly", area: "business", lat: 25.1858, lng: 55.2632, aed: 102000,
    en: { title: "Canal view one-bedroom", desc: "Modern one-bedroom with canal view and flexible monthly rent." },
    ar: { title: "شقة بغرفة وإطلالة على القناة", desc: "شقة حديثة بغرفة نوم وإطلالة على القناة، مع إيجار شهري مرن." } }, 5),
  D({ type: "townhouse", beds: 3, baths: 4, sqft: 2650, purpose: "sale", price: 4250000, cur: "AED", period: null, area: "hills", lat: 25.1061, lng: 55.2461, off: true, nw: true, aed: 4250000,
    en: { title: "Dubai Hills townhouse", desc: "Off-plan townhouse in a green, family-friendly community with a flexible payment plan." },
    ar: { title: "تاون هاوس في دبي هيلز", desc: "تاون هاوس على الخارطة في مجتمع أخضر مناسب للعائلات مع خطة دفع مرنة." } }, 6),
  D({ type: "apartment", beds: 1, baths: 2, sqft: 790, purpose: "rent", price: 78000, cur: "AED", period: "yearly", area: "marina", lat: 25.0818, lng: 55.1389, aed: 78000,
    en: { title: "One-bedroom in Dubai Marina", desc: "Well-kept one-bedroom steps from the marina walk, ideal for professionals." },
    ar: { title: "شقة بغرفة في دبي مارينا", desc: "شقة بغرفة نوم بحالة ممتازة على بعد خطوات من ممشى المارينا، مثالية للمهنيين." } }, 7),
  D({ type: "apartment", beds: 3, baths: 4, sqft: 2350, purpose: "sale", price: 6200000, cur: "AED", period: null, area: "downtown", lat: 25.1985, lng: 55.2731, aed: 6200000,
    en: { title: "Downtown three-bedroom", desc: "Spacious three-bedroom with skyline views in the heart of the city." },
    ar: { title: "شقة بثلاث غرف في الداون تاون", desc: "شقة واسعة بثلاث غرف وإطلالة على الأفق في قلب المدينة." } }, 8),
  D({ type: "studio", beds: 0, baths: 1, sqft: 430, purpose: "sale", price: 1150000, cur: "AED", period: null, area: "business", lat: 25.1841, lng: 55.2608, off: true, aed: 1150000,
    en: { title: "Business Bay studio", desc: "Off-plan studio with a smart layout and strong rental demand." },
    ar: { title: "استوديو في الخليج التجاري", desc: "استوديو على الخارطة بتصميم ذكي وطلب إيجاري قوي." } }, 9),
];

export const DEMO_AGENT = { id: "demo-agent", display_name_en: "Omar Khalil", display_name_ar: "عمر خليل", title_en: "Property Advisor", title_ar: "مستشار عقاري", license_number: "87654", photo_url: null, public_phone: "+971500000000", whatsapp: "+971500000000", languages: ["en", "ar"] };
export const DEMO_AVG_PPSF: Record<string, number> = { marina: 2600, downtown: 2900, palm: 3200, business: 2400, hills: 1700, saadiyat: 3000, jvc: 1500 };
export const DEMO_PLAN = [{ label_en: "On booking", label_ar: "عند الحجز", percentage: 20 }, { label_en: "During construction", label_ar: "أثناء البناء", percentage: 40 }, { label_en: "On handover", label_ar: "عند التسليم", percentage: 40 }];
export const slugOf = (it: DemoItem, loc: "en" | "ar") =>
  (loc === "en" ? it.en.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : it.ar.title.replace(/\s+/g, "-")) + "-" + it.ref.toLowerCase();
