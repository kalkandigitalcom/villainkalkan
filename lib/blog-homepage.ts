import { stripHtml } from "@/lib/html-sanitize";

/* ===============================================================
   🏝️ Ana sayfa "Neden Kalkan?" — blog içeriğinden özet (saf)
   ===============================================================
   Blog gövdesi Tiptap HTML'dir (kayıtta sanitizeHtml). Ana sayfada
   HTML BASILMAZ: etiketler sökülür, düz metin React ile (escape'li)
   render edilir → XSS yüzeyi yok. Bu modül yalnız metin çıkarır.
   =============================================================== */

/** Admin API — taslak yazı ana sayfaya alınamaz. */
export const HOMEPAGE_REQUIRES_ACTIVE =
  "Yalnız yayındaki yazılar ana sayfada gösterilebilir";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** sanitize-html çıktısındaki HTML entity'lerini düz metne çevirir. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff
        ? String.fromCodePoint(n)
        : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** HTML → tek satır düz metin. */
export function htmlToText(html: string | null | undefined): string {
  return decodeEntities(stripHtml(html)).replace(/\s+/g, " ").trim();
}

/** Metni kelime sınırında kısaltır ("…" ile). */
export function truncateText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  const base = (space > max * 0.6 ? cut.slice(0, space) : t.slice(0, max)).replace(
    /[\s,.;:–—-]+$/,
    "",
  );
  return `${base}…`;
}

/** Gövdedeki ilk paragraf(lar)dan özet — liste öğeleri hariç. */
export function bodySummary(html: string | null | undefined, max = 360): string {
  if (!html) return "";
  /* Liste blokları (maddeler ayrı gösterilir) özete karışmasın. */
  const prose = html.replace(/<(ul|ol)\b[\s\S]*?<\/\1>/gi, " ");
  const paragraphs = Array.from(prose.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => htmlToText(m[1]))
    .filter(Boolean);
  const text = paragraphs.length
    ? paragraphs.join(" ")
    : htmlToText(prose);
  return truncateText(text, max);
}

/** Gövdedeki ilk listenin öğeleri (en fazla `max`, her biri kısa). */
export function bodyHighlights(html: string | null | undefined, max = 4): string[] {
  if (!html) return [];
  return Array.from(html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
    .map((m) => truncateText(htmlToText(m[1]), 90))
    .filter(Boolean)
    .slice(0, max);
}
