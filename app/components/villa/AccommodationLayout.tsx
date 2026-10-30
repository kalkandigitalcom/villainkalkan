import { BedDouble, Bath } from "lucide-react";

import {
  type BedroomLayoutItem,
  type BathroomLayoutItem,
} from "@/lib/villa-layout.helper";
/* 🛡️ PHASE 10E — locale-aware etiket/metin kaynakları. `lib/villa-layout.helper.ts`
   DEĞİŞTİRİLMEDİ; oradaki TR sabitleri (BED_TYPE_LABELS/BATHROOM_TYPE_LABELS) admin
   formunda aynen kullanılmaya devam ediyor. Bu component artık etiketleri dictionary
   üzerinden okuyor — TR dictionary değerleri o sabitlerle BİREBİR aynı olduğu için
   TR çıktısı DEĞİŞMEZ (tests/unit/villa-layout-label.helper.test.ts bunu kilitliyor). */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import {
  getBedTypeLabel,
  getBathroomTypeLabel,
  getBedroomNameLabel,
  getBathroomNameLabel,
} from "@/lib/villa-layout-label.helper";

/* ===============================================================
   🛡️ AccommodationLayout — public "Konaklama Düzeni" (mig 047)
   ===============================================================
   PURE PRESENTATIONAL (PriceList / VillaInfoBar paterni):
     - Server component'ten normalize edilmiş layout alır.
     - Airbnb tarzı kart grid; mevcut detay design dili (eyebrow +
       responsive grid + soft border kart).
     - Veri yoksa NULL render (caller zaten boş diziyse section
       çizmez; bu component ekstra guard).
   =============================================================== */

type Props = {
  bedrooms: BedroomLayoutItem[];
  bathrooms: BathroomLayoutItem[];
  /* 🛡️ PHASE 10E — OPSİYONEL. Verilmezse "tr" → mevcut çağrı imzası
     (TR page.tsx) HİÇ DEĞİŞMEDEN çalışmaya devam eder. */
  locale?: Locale;
};

export default function AccommodationLayout({
  bedrooms,
  bathrooms,
  locale = DEFAULT_LOCALE,
}: Props) {
  const hasBedrooms = bedrooms.length > 0;
  const hasBathrooms = bathrooms.length > 0;
  if (!hasBedrooms && !hasBathrooms) return null;

  const dict = getDictionary(locale);

  /* 🛡️ GÖRÜNEN AD ZİNCİRİ: sözlük çevirisi → numara fallback.
     Oda/banyo adları villa bazında DEĞİL, merkezi i18n sözlüğünden
     çözülür (lib/villa-layout-label.helper.ts → roomNameLabels).
     TR'de sözlük identity-map olduğu için TR çıktısı DEĞİŞMEZ; adı boş
     olan satır (TR'de de böyleydi) numara fallback'ine düşer. */

  /* Referans tasarım: ince gri-mavi çerçeveli, yuvarlatılmış beyaz oda
     kutusu; solda ikon karosu, sağda ad + detay. Gölge/hover-lift YOK. */
  const roomCardClass =
    "flex min-w-0 items-start gap-3 rounded-xl border border-[var(--color-stone-200)] bg-white px-3.5 py-3 md:px-4 md:py-3.5 transition-colors duration-200 hover:border-[var(--color-stone-300)] motion-reduce:transition-none";
  const iconTileClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-stone-50)] text-[var(--color-stone-700)]";
  const nameClass =
    "font-display text-[14px] font-semibold leading-snug text-[var(--color-stone-900)] tracking-[-0.01em] break-words";
  const detailClass =
    "mt-0.5 text-[13px] leading-relaxed text-[var(--color-stone-600)]";

  return (
    /* Görünür başlık + özet satırı kaldırıldı (2026-10); bölüm adı
       ekran okuyucular için aria-label ile korunur. */
    <section
      aria-label={dict.accommodation.sectionTitle}
      className="rounded-[20px] bg-white px-5 py-6 md:px-7 md:py-7"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* YATAK ODALARI */}
        {bedrooms.map((room, i) => (
          <div key={`bed-${i}`} className={roomCardClass}>
            <span className={iconTileClass}>
              <BedDouble size={16} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className={nameClass}>
                {getBedroomNameLabel(room.name, locale) ||
                  formatDictionaryString(dict.accommodation.bedroomFallback, {
                    n: i + 1,
                  })}
              </p>
              {room.beds.length > 0 ? (
                room.beds.map((b, j) => (
                  <p key={j} className={detailClass}>
                    {b.count} {getBedTypeLabel(b.type, locale)}
                  </p>
                ))
              ) : (
                <p className={detailClass}>{dict.accommodation.noDetail}</p>
              )}
            </div>
          </div>
        ))}

        {/* BANYOLAR */}
        {bathrooms.map((b, i) => (
          <div key={`bath-${i}`} className={roomCardClass}>
            <span className={iconTileClass}>
              <Bath size={16} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className={nameClass}>
                {getBathroomNameLabel(b.name, locale) ||
                  formatDictionaryString(dict.accommodation.bathroomFallback, {
                    n: i + 1,
                  })}
              </p>
              <p className={detailClass}>
                {getBathroomTypeLabel(b.type, locale)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
