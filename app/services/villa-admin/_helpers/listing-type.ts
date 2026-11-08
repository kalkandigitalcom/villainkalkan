import { isListingType, listingFlagsFor } from "@/lib/sale-listing.helper";

/* ===============================================================
   🛡️ İLAN TÜRÜ → villa kolonları (migration 103) — SAF
   ===============================================================
   create / update orchestrator'ları `buildVillaCorePayload` çıktısına
   bunu SPREAD eder. `undefined` → {} (alan gönderilmez):
     • create → DB DEFAULT (listed_for_rent=TRUE, listed_for_sale=FALSE)
     • update → mevcut değer AYNEN kalır
   Böylece ilan türü göndermeyen eski çağıranların davranışı DEĞİŞMEZ.
   Geçersiz değer → throw (route 400). İkisi birden false üretilemez.
=============================================================== */
export function listingTypeColumns(
  listingType: unknown
): { listed_for_rent: boolean; listed_for_sale: boolean } | Record<string, never> {
  if (listingType === undefined || listingType === null) return {};
  if (!isListingType(listingType)) {
    throw new Error("Geçersiz ilan türü");
  }
  return listingFlagsFor(listingType);
}
