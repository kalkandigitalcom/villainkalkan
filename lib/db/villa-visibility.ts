/* ===============================================================
   🛡️ VILLA PUBLIC GÖRÜNÜRLÜK — MERKEZİ KİRALIK FİLTRESİ
   ===============================================================
   Satılık Villalar modülü (migration 103) ile bir mülk:
     - yalnız kiralık   (listed_for_rent=true,  listed_for_sale=false)
     - kiralık+satılık  (listed_for_rent=true,  listed_for_sale=true)
     - yalnız satılık   (listed_for_rent=false, listed_for_sale=true)
   olabilir. Kiralık public yüzeyler (liste, arama, detay, benzer
   villalar, kısa süreli fırsatlar, koleksiyonlar, sitemap, favoriler…)
   YALNIZ `listed_for_rent=true` mülkleri göstermelidir.

   ⚠️ KESIN KURAL: Kiralık public villa sorguları görünürlük filtresini
   ELLE yazmaz; bu dosyadaki yardımcıları kullanır. Böylece kural tek
   yerde kalır ve `tests/unit/villa-rental-visibility.test.ts` ile
   kilitlenir.
=============================================================== */

/** Görünürlük yardımcılarının ihtiyaç duyduğu minimal query zinciri. */
export interface VisibilityFilterable<Self> {
  eq(column: string, value: unknown): Self;
  is(column: string, value: null | boolean): Self;
}

/** Kiralık public yüzeyde mülkü gösteren bayrak kolonu (migration 103). */
export const RENTAL_LISTING_COLUMN = "listed_for_rent" as const;

/**
 * Kiralık PUBLIC görünürlük: aktif + silinmemiş + kiralık ilan.
 * Eski `.eq("is_active", true).is("deleted_at", null)` zincirinin
 * yerini alır (aynı iki koşul + kiralık bayrağı).
 */
export function withPublicRentalVisibility<Q extends VisibilityFilterable<Q>>(
  query: Q
): Q {
  return query
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq(RENTAL_LISTING_COLUMN, true);
}

/**
 * Yalnız kiralık ilan bayrağı. `is_active` filtresini bilinçli olarak
 * UYGULAMAYAN kiralık yüzeyler (özel link /v/[token], paylaşılan liste)
 * için: pasif villa kuralı caller'da kalır, satılık-only mülk ise hiç
 * gelmez. `deleted_at` filtresi caller sorgusunda AYNEN kalır.
 */
export function withRentalListing<Q extends VisibilityFilterable<Q>>(
  query: Q
): Q {
  return query.eq(RENTAL_LISTING_COLUMN, true);
}

/**
 * JS tarafı eşdeğeri (embed edilmiş villa satırları için; ör. ana sayfa
 * ve indirim koleksiyonları). GERİYE DÖNÜK UYUM: `listed_for_rent`
 * alanı satırda yoksa/NULL ise mülk KİRALIK sayılır (migration 103
 * DEFAULT TRUE ile birebir).
 */
export function isPublicRentalVillaRow(
  v:
    | {
        is_active?: boolean | null;
        deleted_at?: string | null;
        listed_for_rent?: boolean | null;
      }
    | null
    | undefined
): boolean {
  if (!v) return false;
  if (v.is_active === false) return false;
  if (v.deleted_at != null) return false;
  if (v.listed_for_rent === false) return false;
  return true;
}

/**
 * Admin kiralık seçim listeleri (rezervasyon / manuel blok / koleksiyon
 * seçicileri) için: satılık-only (`listed_for_rent === false`) mülkleri
 * çıkarır. `includeId` verilirse o mülk satılık-only olsa bile KORUNUR —
 * düzenleme ekranında mevcut kaydın villası listeden kaybolmasın (mevcut
 * rezervasyonlar değişmez). Alan yok/NULL → kiralık (geriye dönük uyum).
 */
export function filterRentalSelectList<
  T extends { id?: unknown; listed_for_rent?: unknown },
>(villas: ReadonlyArray<T>, includeId?: string | null): T[] {
  return villas.filter(
    (v) => v.listed_for_rent !== false || (!!includeId && v.id === includeId)
  );
}
