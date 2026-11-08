import "server-only";

import { villaAdminRepository } from "@/lib/db/villa.repository.server";
import { reservationServerRepository } from "@/lib/db/reservation.repository.server";
import { todayIstanbulYmd } from "@/lib/date-format";
import { listingTypeFromFlags, type ListingType } from "@/lib/sale-listing.helper";

/* ===============================================================
   🛡️ İLAN TÜRÜ DEĞİŞİKLİK KAPISI (satılık modülü)
   ===============================================================
   Kiralık (veya kiralık+satılık) bir villa "Sadece satılık" yapılırsa
   public kiralık yüzeylerden ve rezervasyon akışından çıkar. Misafiri
   olan bir villanın sessizce kiralıktan çıkmaması için: ileri tarihli
   pending/confirmed rezervasyonu varsa değişiklik REDDEDİLİR.

   • Yalnız SELECT; rezervasyon / villa satırı DEĞİŞTİRMEZ.
   • "rent" / "both" / undefined → kontrol YOK (kiralık davranışı aynı).
   • Villa zaten satılık-only ise → kontrol YOK (değişiklik yok).
   • DB okunamazsa → reddeder (fail-closed).
   Dönüş: null = izinli; string = kullanıcıya gösterilecek hata.
=============================================================== */
export const LISTING_TYPE_UPCOMING_RESERVATION_ERROR =
  "Bu villanın ileri tarihli aktif (bekleyen/onaylı) rezervasyonu var. “Sadece satılık” yapmadan önce rezervasyonları tamamlayın veya iptal edin; isterseniz “Kiralık ve satılık” seçebilirsiniz.";

export const LISTING_TYPE_CHECK_FAILED_ERROR =
  "İlan türü değişikliği şu anda doğrulanamadı. Lütfen tekrar deneyin.";

export async function checkListingTypeChange(
  villaId: string,
  listingType: unknown
): Promise<string | null> {
  if (listingType !== "sale") return null;

  const status = await villaAdminRepository.findRentalListingStatusById(villaId);
  if (status.error) return LISTING_TYPE_CHECK_FAILED_ERROR;
  if (!status.data) return null; // villa yok → mevcut update akışı karar verir
  if (status.data.listed_for_rent === false) return null; // zaten satılık-only

  const upcoming = await reservationServerRepository.findUpcomingActiveIdForVilla(
    villaId,
    todayIstanbulYmd()
  );
  if (upcoming.error) return LISTING_TYPE_CHECK_FAILED_ERROR;
  if ((upcoming.data || []).length > 0) return LISTING_TYPE_UPCOMING_RESERVATION_ERROR;
  return null;
}

/** Audit için mevcut ilan türü (okunamazsa / villa yoksa null). */
export async function readCurrentListingType(
  villaId: string
): Promise<ListingType | null> {
  const { data, error } = await villaAdminRepository.findRentalListingStatusById(villaId);
  if (error || !data) return null;
  return listingTypeFromFlags(data);
}
