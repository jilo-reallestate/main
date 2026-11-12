/** URL-safe slug that keeps Arabic letters. The database appends the property reference code to make it unique. */
export function slugify(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
