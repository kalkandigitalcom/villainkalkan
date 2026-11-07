import "server-only";

import { villaAdminRepository } from "@/lib/db/villa.repository.server";

/* ===============================================================
   🛡️ KİRALIK İLAN GUARD'I — satılık-only mülke rezervasyon YOK
   ===============================================================
   Migration 103 ile bir mülk `listed_for_rent=false` (yalnız satılık)
   olabilir. Böyle bir mülk için YENİ rezervasyon / blok oluşturulamaz ve
   mevcut bir kayıt BAŞKA bir villadan satılık-only villaya taşınamaz.

   KAPSAM (yalnız ek bir kapı — mevcut akışlar DEĞİŞMEZ):
     - listed_for_rent = true (veya NULL) → geçer (bugünkü davranış).
     - Villa bulunamadı / geçersiz id     → geçer; mevcut doğrulama
       katmanları (fiyat doğrulama, FK, service validation) AYNEN karar
       verir.
     - listed_for_rent = false            → reddedilir.
     - DB okunamadı                       → reddedilir (FAIL-CLOSED; fiyat
       doğrulamasının SEC-06 F5 politikasıyla aynı).
     - `currentVillaId` verilmiş ve hedef villa ile AYNI ise (düzenleme
       ekranında villa değişmiyor) → hiç okunmadan geçer. Böylece mevcut
       rezervasyonların düzenlenmesi ASLA engellenmez.

   Mevcut rezervasyon satırlarına DOKUNMAZ (yalnız SELECT).
=============================================================== */

export const SALE_ONLY_RESERVATION_ERROR =
  "Bu mülk yalnızca satılıktır; rezervasyon oluşturulamaz.";

export const RENTAL_LISTING_CHECK_FAILED_ERROR =
  "Villa durumu şu anda doğrulanamadı. Lütfen biraz sonra tekrar deneyin.";

export class RentalListingGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RentalListingGuardError";
  }
}

export async function assertVillaAcceptsRentalBooking(
  villaId: unknown,
  opts?: { currentVillaId?: string | null }
): Promise<void> {
  if (typeof villaId !== "string" || villaId.trim().length === 0) return;
  if (opts?.currentVillaId && opts.currentVillaId === villaId) return;

  let res: Awaited<
    ReturnType<typeof villaAdminRepository.findRentalListingStatusById>
  >;
  try {
    res = await villaAdminRepository.findRentalListingStatusById(villaId);
  } catch (err) {
    console.error(
      "[reservation.rentalListingGuard] read FAILED",
      err instanceof Error ? err.message : err
    );
    throw new RentalListingGuardError(RENTAL_LISTING_CHECK_FAILED_ERROR);
  }

  if (res?.error) {
    console.error("[reservation.rentalListingGuard] read FAILED", res.error.message);
    throw new RentalListingGuardError(RENTAL_LISTING_CHECK_FAILED_ERROR);
  }

  if (res?.data && res.data.listed_for_rent === false) {
    throw new RentalListingGuardError(SALE_ONLY_RESERVATION_ERROR);
  }
}
