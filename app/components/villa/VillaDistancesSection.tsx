import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

import type { ReactNode } from "react";
import {
  MapPin,
  Utensils,
  ShoppingBasket,
  Plane,
  Bus,
  Crosshair,
  Cross,
  Fuel,
  GraduationCap,
  Umbrella,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DistanceIconKey } from "@/lib/distance.helper";

/* ===============================================================
   🛡️ VillaDistancesSection — PHASE 8D-2
   ===============================================================
   TR villa detay sayfasının (`app/(public)/kiralik-villa/[slug]/
   page.tsx`, "konum" tab slot'u, satır ~518-606) "Yakındaki
   Noktalar" bloğunun SALT-SUNUM extraction'ı. TR dosyası bu
   component'i KULLANMIYOR — kendi inline JSX'i AYNEN, DOKUNULMADAN
   duruyor; bu component YALNIZ EN/DE villa detay sayfaları
   tarafından import edilir (Phase 8D-2 audit'in onaylanan
   "3 küçük server component" kararı).

   Server component (interaktivite yok — useState/onClick YOK,
   "use client" GEREKMİYOR). Server-only translation/repository
   koduna HİÇ erişmez — yalnız ZATEN ÇÖZÜLMÜŞ `TranslatedDistance[]`
   prop'unu render eder; çeviri/fallback çözümü ÇAĞIRAN page.tsx
   içinde `getTranslationsForParents` (Phase 8D-1) +
   `resolveTranslatedField` ile yapılır.

   Hardcoded TR UI metinleri ("ÇEVREYİ KEŞFEDİN", "Yakındaki
   Noktalar", açıklama cümlesi, "Bilgi yok") BİLİNÇLİ OLARAK
   ÇEVRİLMEDİ — bu fazın kapsamı yalnız DB-backed veri çevirisi
   (UI dictionary/localization AYRI bir fazın konusu).

   🛡️ ICON KEY — `iconKey` prop'u ÇAĞIRAN TARAFTA, ORİJİNAL (TR)
   `distance.title`'dan hesaplanmış olarak gelir (`getDistanceIconKey`
   TÜRKÇE anahtar kelimeye bağlı — çevrilmiş başlıkla hesaplanırsa
   ikonlar sessizce "pin" fallback'ine düşer, bkz. Phase 8D-2 audit
   "DISTANCE ICON KRİTİK"). Bu component icon key HESAPLAMAZ, yalnız
   `DISTANCE_ICON_MAP[d.iconKey]` ile ikonu render eder.
   =============================================================== */

/* 2026-10 — referans görsele uygun ikonlar (aynı lucide kütüphanesi):
   market sepeti, çatal-bıçak, plaj şemsiyesi, otobüs, sağlık artısı,
   merkez nişangahı, uçak. Anahtar eşleşmesi (getDistanceIconKey)
   DEĞİŞMEDİ. */
const DISTANCE_ICON_MAP: Record<DistanceIconKey, LucideIcon> = {
  restaurant: Utensils,
  store: ShoppingBasket,
  waves: Umbrella,
  plane: Plane,
  bus: Bus,
  building: Crosshair,
  cross: Cross,
  fuel: Fuel,
  school: GraduationCap,
  pin: MapPin,
};

export type TranslatedDistance = {
  id: string;
  /** Gösterilecek metin — çevrilmişse çeviri, yoksa orijinal TR. */
  displayTitle: string;
  /** Gösterilecek mesafe metni — çevrilmişse çeviri, yoksa orijinal TR. */
  displayDistance: string;
  /** ORİJİNAL (TR) title'dan hesaplanmış ikon anahtarı — ÇEVRİLMİŞ
   *  değerle HESAPLANMAMALI (bkz. dosya başı yorum). */
  iconKey: DistanceIconKey;
};

export default function VillaDistancesSection({
  distances,
  locale,
  mapPanel,
}: {
  distances: TranslatedDistance[];
  /** 2026-10 — sağ panel (%40): "Haritada Göster" / "Yol Tarifi Al"
   *  aksiyonları. Çağıran taraf `<VillaMapModal variant="panel" />`
   *  geçirir (harita/yol tarifi işlevi orada, AYNEN). Verilmezse sol
   *  liste tam genişlik. */
  mapPanel?: ReactNode;
  /** 🛡️ PHASE 10G — opsiyonel; verilmezse "tr" (eski davranış). */
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  return (
    <section>
      <div className="max-w-xl">
        <div className="flex items-center gap-2.5 mb-3">
          <span
            aria-hidden="true"
            className="h-px w-9 bg-gradient-to-r from-accent to-brand"
          />
          <span className="text-[11px] font-semibold tracking-[0.16em] text-[var(--color-stone-400)]">
            {dict.villa.distancesEyebrow}
          </span>
        </div>
        <h2 className="font-display text-2xl md:text-3xl text-[var(--color-stone-900)] tracking-[-0.015em]">
          {dict.villa.distancesTitle}
        </h2>
        <p className="mt-2.5 text-[13px] md:text-[13.5px] text-[var(--color-stone-500)] leading-relaxed">
          {dict.villa.distancesSubtitle}
        </p>
      </div>

      {/* 🛡️ 2026-10 REFERANS DÜZENİ — tek, yuvarlatılmış kapsayıcı:
          sol (%60) açık mavi zeminde 2 sütunlu nokta grid'i; sağ (%40)
          hafif mavi→turkuaz geçişli harita/yol tarifi paneli. Mobilde
          alt alta. Satır animasyonu/hover kaydırması kaldırıldı. */}
      <div className="mt-6 md:mt-7 grid grid-cols-1 md:grid-cols-5 overflow-hidden rounded-[20px]">
        <div
          className={
            "min-w-0 bg-[#e8f1fd] px-6 py-7 sm:px-8 md:py-9 " +
            (mapPanel ? "md:col-span-3" : "md:col-span-5")
          }
        >
          {distances.length === 0 ? (
            <p className="text-[var(--color-stone-500)] text-sm italic">
              {dict.villa.distancesEmpty}
            </p>
          ) : (
            <div
              role="list"
              className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-7 md:gap-y-9"
            >
              {distances.map((d) => {
                const IconCmp: LucideIcon = DISTANCE_ICON_MAP[d.iconKey];
                return (
                  <div
                    role="listitem"
                    key={d.id}
                    className="flex min-w-0 items-start gap-4"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-neutral-900"
                    >
                      <IconCmp size={28} strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] md:text-[15px] leading-snug text-neutral-700 break-words">
                        {d.displayTitle}
                      </p>
                      <p
                        className="mt-1 font-display text-[18px] md:text-[20px] font-extrabold leading-tight tracking-[-0.01em] text-neutral-900"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {d.displayDistance}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {mapPanel && (
          <div className="min-w-0 md:col-span-2 bg-gradient-to-br from-[#dde9fb] to-[#dcf6ea]">
            {mapPanel}
          </div>
        )}
      </div>
    </section>
  );
}
