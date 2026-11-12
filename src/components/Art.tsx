import { skyArt } from "@/lib/art";
/** Generated artwork shown until a property has real photography. */
export function Art({ seed, h = 300, className }: { seed: number; h?: number; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: skyArt(seed, h) }} />;
}
export const seedOf = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
