/* ===============================================================
   🛡️ VILLA DETAIL — sayfa içi UI olay köprüsü (yalnız görünüm)
   ===============================================================
   Üst navigasyon şeridi, rezervasyon kartının "Müsaitlik Takvimi"
   butonu ve "Fotoğrafları Göster" butonu; MEVCUT VillaDetailTabs
   sekme state'ine ve Gallery lightbox'ına bu window olaylarıyla
   ULAŞIR. Hiçbir URL/hash/query değişmez, veri çekilmez; mevcut
   sekme tıklamaları ve galeri tıklamaları AYNEN çalışmaya devam
   eder — bu köprü yalnız EK bir tetikleyicidir.
   =============================================================== */

export const VILLA_TAB_IDS = [
  "fiyatlar",
  "musaitlik",
  "konum",
  "ozellikler",
] as const;
export type VillaTabId = (typeof VILLA_TAB_IDS)[number];

/** Dışarıdan sekme açma isteği (detail: { id }). */
export const VILLA_TAB_OPEN_EVENT = "villa-detail:tab-open";
/** VillaDetailTabs aktif sekme değiştiğinde yayınlar (detail: { id }). */
export const VILLA_TAB_CHANGED_EVENT = "villa-detail:tab-changed";
/** Gallery lightbox'ını ilk fotoğraftan açma isteği. */
export const VILLA_GALLERY_OPEN_EVENT = "villa-detail:gallery-open";

/** Sekme bandının kaydırma hedefi (VillaDetailTabs kök elemanı). */
export const VILLA_TABS_ANCHOR_ID = "villa-detay-sekmeler";
/** Açıklama bölümünün kaydırma hedefi. */
export const VILLA_DESCRIPTION_ANCHOR_ID = "villa-aciklama";

export function isVillaTabId(value: unknown): value is VillaTabId {
  return (
    typeof value === "string" &&
    (VILLA_TAB_IDS as readonly string[]).includes(value)
  );
}

function scrollToAnchor(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  const reduce =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
}

/** Mevcut sekmeyi açar ve sekme bandına kaydırır. */
export function openVillaTab(id: VillaTabId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(VILLA_TAB_OPEN_EVENT, { detail: { id } }),
  );
  scrollToAnchor(VILLA_TABS_ANCHOR_ID);
}

/** Açıklama bölümüne kaydırır. */
export function scrollToVillaDescription() {
  scrollToAnchor(VILLA_DESCRIPTION_ANCHOR_ID);
}

/** Galeri lightbox'ını ilk fotoğraftan açar. */
export function openVillaGallery() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VILLA_GALLERY_OPEN_EVENT));
}
