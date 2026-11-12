import { slugify } from "@/lib/slug";

/** Turns the listing form into the JSON that the database function save_listing() expects. Pure, so it can be tested. */
export function buildListingPayload(get: (k: string) => string, all: (k: string) => string[]) {
  const g = (k: string) => get(k).trim();
  return {
    listing_id: g("listing_id") || undefined, intent: g("intent") === "submit" ? "submit" : "save",
    purpose: g("purpose") || "sale", type: g("type") || "apartment", area_code: g("area_code"), area_name: g("area_name"), building_name: g("building_name"),
    bedrooms: g("bedrooms"), bathrooms: g("bathrooms"), size_sqft: g("size_sqft"), plot_sqft: g("plot_sqft"), floor_number: g("floor_number"), parking_spaces: g("parking_spaces"),
    furnishing: g("furnishing"), view_type: g("view_type"), completion_status: g("completion_status") || "ready", lat: g("lat"), lng: g("lng"),
    price: g("price"), currency: g("currency") || "AED", price_period: g("purpose") === "rent" ? g("price_period") || "yearly" : "", cheques: g("purpose") === "rent" ? g("cheques") : "",
    deposit_amount: g("deposit_amount"), permit_number: g("permit_number"), agent_id: g("agent_id"), amenities: all("amenities"),
    title_en: g("title_en"), desc_en: g("desc_en"), title_ar: g("title_ar"), desc_ar: g("desc_ar"),
    slug_en: slugify(g("title_en")), slug_ar: slugify(g("title_ar")),
  };
}
