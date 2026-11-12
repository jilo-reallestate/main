/** Company facts used in structured data. Everything comes from environment variables so nothing is invented: a field left empty is simply left out. */
const env = (k: string) => (process.env[k] ?? "").trim();
export const COMPANY = {
  name: "JILO Real Estate",
  legalName: env("NEXT_PUBLIC_COMPANY_LEGAL_NAME"),
  phone: env("NEXT_PUBLIC_COMPANY_PHONE") || "+971 55 827 7426",
  email: env("NEXT_PUBLIC_COMPANY_EMAIL"),
  street: env("NEXT_PUBLIC_COMPANY_ADDRESS"),
  city: env("NEXT_PUBLIC_COMPANY_CITY") || "Dubai",
  license: env("NEXT_PUBLIC_COMPANY_LICENSE"), // RERA ORN / DLD licence number
  social: env("NEXT_PUBLIC_SOCIAL_URLS").split(",").map((s) => s.trim()).filter(Boolean),
};
