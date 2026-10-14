/* ===============================================================
   🛡️ VILLA DETAIL — sayfa içi navigasyon köprüsü (yalnız görünüm)
   ===============================================================
   Açıklama, Fiyatlar, Müsaitlik, Konum ve Özellikler bölümleri
   sayfada ARDIŞIK ve hep açık durur. Üst navigasyon şeridi
   (VillaSectionNav) ve rezervasyon kartının "Müsaitlik Takvimi"
   kısayolu `scrollToVillaSection` ile ilgili bölüme yumuşakça
   kaydırır; hedef, sabit Header + yapışkan şeridin ALTINDA kalır.
   Her kaydırma isteği tek bir window olayıyla duyurulur → şerit
   tıklanan / hedeflenen öğeyi hemen aktif gösterir.
   Hiçbir URL/hash/query değişmez, veri çekilmez.
   =============================================================== */

export const VILLA_SECTION_IDS = [
  "aciklama",
  "fiyatlar",
  "musaitlik",
  "konum",
  "ozellikler",
] as const;
export type VillaSectionId = (typeof VILLA_SECTION_IDS)[number];

/** Bölümün DOM id'si (kaydırma hedefi). */
export function villaSectionAnchorId(id: VillaSectionId): string {
  return `villa-${id}`;
}

/** Açıklama bölümünün kaydırma hedefi. */
export const VILLA_DESCRIPTION_ANCHOR_ID = villaSectionAnchorId("aciklama");

/** Bir bölüme kaydırma isteği yapıldı (detail: { id }). */
export const VILLA_SECTION_SCROLL_EVENT = "villa-detail:section-scroll";
/** Gallery lightbox'ını ilk fotoğraftan açma isteği. */
export const VILLA_GALLERY_OPEN_EVENT = "villa-detail:gallery-open";

/** Yapışkan navigasyon şeridinin işaretçisi (yükseklik ölçümü için). */
export const VILLA_SECTION_NAV_ATTR = "data-villa-section-nav-bar";

export function isVillaSectionId(value: unknown): value is VillaSectionId {
  return (
    typeof value === "string" &&
    (VILLA_SECTION_IDS as readonly string[]).includes(value)
  );
}

/** Sabit Header'ın (TopBar dahil) GERÇEK yüksekliği. */
export function getFixedHeaderHeight(): number {
  if (typeof document === "undefined") return 0;
  const header = document.querySelector("header");
  if (!header) return 0;
  const position = window.getComputedStyle(header).position;
  if (position !== "fixed" && position !== "sticky") return 0;
  return Math.round(header.getBoundingClientRect().height);
}

/** Bölüm başlığının duracağı üst boşluk: Header + şerit + nefes payı. */
export function getVillaStickyOffset(): number {
  if (typeof document === "undefined") return 0;
  const nav = document.querySelector(`[${VILLA_SECTION_NAV_ATTR}]`);
  const navHeight = nav ? nav.getBoundingClientRect().height : 0;
  return getFixedHeaderHeight() + navHeight + 16;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** İlgili bölüme yumuşak kaydırır (Header + yapışkan şerit payı ile). */
export function scrollToVillaSection(id: VillaSectionId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(VILLA_SECTION_SCROLL_EVENT, { detail: { id } }),
  );
  const el = document.getElementById(villaSectionAnchorId(id));
  if (!el) return;
  const top =
    el.getBoundingClientRect().top + window.scrollY - getVillaStickyOffset();
  window.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

/** Galeri lightbox'ını ilk fotoğraftan açar. */
export function openVillaGallery() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VILLA_GALLERY_OPEN_EVENT));
}
