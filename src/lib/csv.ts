/** Small CSV reader for the unit import: handles quotes, and comma / semicolon / tab separators. */
export type UnitRow = { unit_number: string; unit_type: string; bedrooms: string; size_sqft: string; price: string; status: string };

const ALIAS: Record<string, keyof UnitRow> = {
  unit_number: "unit_number", unit: "unit_number", unitno: "unit_number", unit_no: "unit_number", number: "unit_number", no: "unit_number",
  type: "unit_type", unit_type: "unit_type",
  bedrooms: "bedrooms", beds: "bedrooms", bed: "bedrooms", br: "bedrooms",
  size_sqft: "size_sqft", size: "size_sqft", sqft: "size_sqft", area: "size_sqft",
  price: "price", status: "status",
};

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const first = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (q) { if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && clean[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Turns CSV text into unit rows using the header names. Returns null when no recognisable header is found. */
export function unitsFromCsv(text: string): UnitRow[] | null {
  const rows = parseCsv(text); if (rows.length < 2) return null;
  const map = rows[0].map((h) => ALIAS[h.trim().toLowerCase().replace(/[\s-]+/g, "_")]);
  if (!map.includes("unit_number") || !map.includes("price")) return null;
  return rows.slice(1).map((r) => {
    const o: UnitRow = { unit_number: "", unit_type: "", bedrooms: "", size_sqft: "", price: "", status: "" };
    map.forEach((k, i) => { if (k) o[k] = (r[i] ?? "").trim(); });
    return o;
  });
}
