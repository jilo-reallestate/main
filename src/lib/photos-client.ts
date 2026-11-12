import type { SupabaseClient } from "@supabase/supabase-js";

/** Browser-side photo helpers: shrink to 2000px WebP, then upload straight to Storage and register the row. */
export async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file), s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("resize failed"))), "image/webp", 0.85));
}

/** Uploads the files for a property that has no photos yet; the first one becomes the cover. Returns how many failed. */
export async function uploadNewPhotos(sb: SupabaseClient, propertyId: string, files: File[], onProgress?: (done: number) => void): Promise<number> {
  let failed = 0;
  for (const [i, f] of files.entries()) {
    try {
      const path = `${propertyId}/${crypto.randomUUID()}.webp`, up = await sb.storage.from("property-media").upload(path, await shrink(f), { contentType: "image/webp" });
      if (up.error) throw up.error;
      const { error } = await sb.from("property_media").insert({ property_id: propertyId, kind: "image", path, sort_order: i, is_cover: i === 0 });
      if (error) throw error;
    } catch { failed++; }
    onProgress?.(i + 1);
  }
  return failed;
}
