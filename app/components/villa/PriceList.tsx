"use client";

import { useState } from "react";
import { ShieldCheck, Info } from "lucide-react";

import {
  canConvertForDisplay,
  collectSourceCurrencies,
  convertPrice,
  formatDisplayPrice,
} from "@/lib/currency";
import { useCurrency } from "@/app/context/CurrencyContext";
import {
  formatDateForLocale,
  formatDiscountDateRange,
  parseLocalDate,
  formatLocalDate,
  type DiscountDateRangeTemplates,
} from "@/lib/date-format";
import { applyDiscountToDailyPrice, type DiscountRange } from "@/lib/price.engine";
/* 🛡️ PHASE 10B — locale-aware UI stringleri + tarih formatı.
   `locale` opsiyonel, default "tr". `formatDateForLocale(x,"tr")`
   `formatDateTr(x)` ile BYTE-IDENTICAL çıktı üretir (AYNI Istanbul-
   offset + AYNI ay kısaltmaları) — bu yüzden eski `formatDateTr`
   import'u bu dosyada bu locale-aware karşılığıyla DEĞİŞTİRİLDİ;
   `lib/date-format.ts`'teki `formatDateTr`'nin KENDİSİ DOKUNULMADI,
   diğer TÜM çağıranları (mail/voucher/admin) etkilenmez. price.engine
   fonksiyonlarına (`applyDiscountToDailyPrice` vb.) DOKUNULMADI. */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/* ===============================================================
   🛡️ PriceList — EDITORIAL LIST (klasik kart/tablo DEĞİL)
   ===============================================================
   Her sezon ince bir border-bottom ile ayrılan yatay bir satır:
   solda büyük/güçlü tipografiyle tarih aralığı, sağda (aynı stille
   korunan) fiyat + kompakt bir "Bilgi" toggle. Bilgi paneli hover
   (desktop) veya tap (mobile — hover yok) ile açılır; absolute
   positioned popover olduğu için satırlar YER DEĞİŞTİRMEZ (layout
   jump yok).

   PRICING ENGINE DOKUNULMADI:
     - `convertPrice(price, currency, target, rates)` — AYNEN
     - `formatCurrency(value, currency)` — AYNEN
     - `useCurrency()` context — AYNEN
     - prices array sırası — service `start_date ASC` korunur
     - `Price` shape (id, start_date, end_date, price, currency) —
       birebir aynı; map iterasyonu aynı
     - Fiyat gösterimi (büyük rakam + "Gecelik" caption) AYNEN —
       yalnız satır içindeki KONUMU ve GÖRSEL stili değişti.

   MIN STAY KAYNAĞI (değişmedi):
     `props.minimumStayNights` — villa-level field
     (`villa.minimum_stay_nights`). Yeni hesap YOK; mevcut
     BookingSidebar `minimum_stay_nights` prop'u ile aynı kaynak.
     null/0 → Bilgi panelinde satır gösterilmez.

   DEPOZİTO (yeni prop, mevcut veri):
     `props.deposit` — villa-level field (`villa.deposit`), TRY
     cinsinden DB'de tutuluyor (bkz. useBookingEngine.ts:
     `convertPrice(deposit, "TRY", currency, rates)`). AYNI
     dönüşüm burada birebir tekrarlanıyor — yeni DB alanı / yeni
     hesap YOK, sadece BookingSidebar'ın zaten kullandığı villa-level
     depozito değeri, aynı yöntemle bu bilgi panelinde de gösteriliyor.
     null/0/negatif → Bilgi panelinde satır gösterilmez.

   TARIH FORMATI:
     `formatDateTr` (lib/date-format) → "11 May 2026" formatı.

   🛡️ GÖRSEL DÜZEN (2026-10 — yalnız görünüm; data/state/handler ve
   fiyat hesabı DEĞİŞMEDİ):
     - Beyaz bölüm kabı; her sezon tek satırlık yatay kart.
     - Sol: tarih aralığı ("1 Ekim - 10 Kasım 2026") + "Minimum N Gece".
     - Sağ (ince dikey ayraçla): gecelik fiyat (koyu lacivert, büyük) +
       "/ gecelik"; altında kısa süreli konaklama (temizlik) ücreti.
     - Mobilde iki bölüm alt alta (yatay ayraç), taşma yok.
     - Önceki gradient/gölge/accent çubuğu/giriş animasyonu kaldırıldı.
     - Bilgi popover'ı (depozito) konum/toggle davranışıyla korunur.
   =============================================================== */

type Price = {
  id: string;
  start_date: string;
  end_date: string;
  price: number;
  currency: string;
};

/* ===============================================================
   🛡️ SEZON FİYATI İÇİNE İNDİRİM ARALIĞI YERLEŞTİRME (bu tur)
   ===============================================================
   AMAÇ: Villa detay sayfasındaki "Sezon Fiyatları" listesine, admin'in
   girdiği villa_discounts kayıtlarını (varsa) kronolojik konumuna
   YERLEŞTİRMEK — normal sezon fiyatlarının hesaplama mantığı, DB
   kaydı, price.engine davranışı veya rezervasyon akışı HİÇ
   değişmedi. Bu tamamen SUNUM KATMANI bölme işlemi:

     Sezon:    1 - 31 Ekim → 5.000₺
     İndirim:  8 - 15 Ekim → 3.000₺
     Sonuç:    1-7 Ekim (5.000₺) · 8-15 Ekim (3.000₺, İNDİRİMLİ) ·
               16-31 Ekim (5.000₺)

   TARİH SEMANTİĞİ: villa_discounts.start_date/end_date, villa_prices
   ile AYNI "kapalı interval" semantiğine sahip (bkz.
   formatDiscountDateRangeTr yorumu, lib/date-format.ts) — start_date
   ve end_date DAHİL. Bölme algoritması bunu birebir uygular:
   indirimden önceki parça `discount.start_date - 1 gün`de biter,
   sonraki parça `discount.end_date + 1 gün`de başlar.

   ÇAKIŞMA: villa_discounts kayıtları DB seviyesinde ÇAKIŞMAZ (mevcut
   constraint) — bu yüzden ekstra bir çakışma-çözme sistemi YOK;
   birden fazla indirim aynı sezona düşerse (üst üste binmeden) sırayla
   işlenir.

   FİYAT HESABI: her segment'in fiyatı, mevcut `convertPrice` +
   `applyDiscountToDailyPrice` (lib/price.engine.ts, DEĞİŞTİRİLMEDİ)
   ile hesaplanır — VillaCard'ın discount variant'ının kullandığı AYNI
   fonksiyon. Yeni bir fiyat hesaplama sistemi YAZILMADI.

   Bu fonksiyon PriceList'in DIŞINDA (module-level, saf/pure) —
   component'in render'ından bağımsız test edilebilir, hook'lara
   bağımlı değil. */
type PriceSegment = {
  key: string;
  start_date: string;
  end_date: string;
  price: number;
  currency: string;
  discount: DiscountRange | null;
};

/** "YYYY-MM-DD" + gün farkı → "YYYY-MM-DD" (LOCAL takvim aritmetiği,
 *  parseLocalDate/formatLocalDate ile — TZ kaymasız). Invalid input →
 *  değiştirilmeden geri döner (defansif; caller zaten geçerli
 *  start_date/end_date ile çağırır). */
function addLocalDays(dateStr: string, delta: number): string {
  const d = parseLocalDate(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + delta);
  return formatLocalDate(d);
}

/** İki "YYYY-MM-DD" tarihini LOCAL takvim günü olarak karşılaştırır.
 *  -1: a < b, 0: eşit, 1: a > b. Invalid input → 0 (no-op sıralama). */
function compareLocalDates(a: string, b: string): number {
  const da = parseLocalDate(a).getTime();
  const db = parseLocalDate(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  if (da === db) return 0;
  return da < db ? -1 : 1;
}

/** Sezon fiyatlarını (prices), varsa örtüşen indirim aralıklarıyla
 *  (discounts) kronolojik segment'lere böler. İndirim yoksa veya hiç
 *  örtüşme yoksa, her price BİREBİR tek bir segment olarak döner
 *  (mevcut davranışla %100 aynı görünüm). */
function buildSeasonSegments(
  prices: Price[],
  discounts: DiscountRange[]
): PriceSegment[] {
  const segments: PriceSegment[] = [];

  for (const p of prices) {
    const overlapping = discounts
      .filter(
        (d) =>
          !!d.start_date &&
          !!d.end_date &&
          compareLocalDates(d.start_date, p.end_date) <= 0 &&
          compareLocalDates(d.end_date, p.start_date) >= 0
      )
      .slice()
      .sort((a, b) => compareLocalDates(a.start_date, b.start_date));

    if (overlapping.length === 0) {
      segments.push({
        key: p.id,
        start_date: p.start_date,
        end_date: p.end_date,
        price: p.price,
        currency: p.currency,
        discount: null,
      });
      continue;
    }

    let cursor = p.start_date;
    overlapping.forEach((d, i) => {
      const clippedStart =
        compareLocalDates(d.start_date, p.start_date) > 0
          ? d.start_date
          : p.start_date;
      const clippedEnd =
        compareLocalDates(d.end_date, p.end_date) < 0
          ? d.end_date
          : p.end_date;

      if (compareLocalDates(cursor, clippedStart) < 0) {
        segments.push({
          key: `${p.id}-pre-${i}`,
          start_date: cursor,
          end_date: addLocalDays(clippedStart, -1),
          price: p.price,
          currency: p.currency,
          discount: null,
        });
      }

      segments.push({
        key: `${p.id}-disc-${i}`,
        start_date: clippedStart,
        end_date: clippedEnd,
        price: p.price,
        currency: p.currency,
        discount: d,
      });

      cursor = addLocalDays(clippedEnd, 1);
    });

    if (compareLocalDates(cursor, p.end_date) <= 0) {
      segments.push({
        key: `${p.id}-post`,
        start_date: cursor,
        end_date: p.end_date,
        price: p.price,
        currency: p.currency,
        discount: null,
      });
    }
  }

  return segments;
}

export default function PriceList({
  prices,
  minimumStayNights = null,
  deposit = null,
  discounts = null,
  cleaningFee = null,
  cleaningCurrency = null,
  cleaningLimit = null,
  locale,
}: {
  prices: Price[];
  /* Villa-level min stay. null veya 0 → Bilgi panelinde satır yok.
     Optional + default null → eski caller'lar backward-compat çalışır. */
  minimumStayNights?: number | null;
  /* Villa-level depozito (TRY). null/0 → Bilgi panelinde satır yok.
     Optional + default null → eski caller'lar backward-compat çalışır. */
  deposit?: number | null;
  /* 🛡️ YENİ (bu tur) — villa_discounts kayıtları (aynı `DiscountRange`
     şekli, lib/price.engine.ts; homepage/VillaCard'ın zaten kullandığı
     TİP). Verilmezse/null ise (eski caller'lar, örn. /v/[token] paylaşım
     sayfası) davranış BİREBİR ESKİSİYLE aynı — hiçbir segment bölünmez,
     her sezon tek satır olarak görünür. */
  discounts?: DiscountRange[] | null;
  /* 🛡️ 2026-10 — kısa süreli konaklama/temizlik ücreti satırı için
     villa-level alanlar (ShortStayFeeNotice ile AYNI kaynak ve AYNI
     dönüşüm). Verilmezse satır gösterilmez (eski caller'lar aynen). */
  cleaningFee?: number | null;
  cleaningCurrency?: string | null;
  cleaningLimit?: number | null;
  /* 🛡️ PHASE 10B — opsiyonel, default "tr". */
  locale?: Locale;
}) {
  const { currency, rates } = useCurrency();
  const [openId, setOpenId] = useState<string | null>(null);
  const dict = getDictionary(locale);
  const effectiveLocale = locale ?? DEFAULT_LOCALE;

  /* Boş array yine de gelirse defansif fallback (caller outer'da
     zaten ternary ile koruyor; bu inner guard backward-compat). */
  if (!prices || prices.length === 0) {
    return (
      <p className="text-[var(--color-stone-400)] text-sm italic">
        {dict.price.noPriceInfo}
      </p>
    );
  }

  /* Bilgi panelinde gösterilecek veriler — yalnız GERÇEKTEN mevcutsa. */
  const hasMinStay =
    typeof minimumStayNights === "number" &&
    Number.isFinite(minimumStayNights) &&
    minimumStayNights > 0;

  const hasDeposit =
    typeof deposit === "number" && Number.isFinite(deposit) && deposit > 0;

  const convertedDeposit = hasDeposit
    ? convertPrice(deposit as number, "TRY", currency, rates)
    : 0;

  /* 🛡️ Depozito TRY → seçili para birimi (TRY seçiliyse kur gerekmez). */
  const depositReady = canConvertForDisplay(rates, currency, ["TRY"]);

  /* Minimum gece artık her satırda görünür → Bilgi paneli yalnız
     depozito için. */
  const hasInfo = hasDeposit;

  /* Kısa süreli konaklama (temizlik) ücreti — ShortStayFeeNotice ile
     BİREBİR aynı koşul + dönüşüm (yeni kural/hesap YOK). */
  const hasShortStayFee =
    typeof cleaningFee === "number" &&
    Number.isFinite(cleaningFee) &&
    cleaningFee > 0 &&
    typeof cleaningLimit === "number" &&
    Number.isFinite(cleaningLimit) &&
    cleaningLimit > 0;
  const convertedFee = hasShortStayFee
    ? convertPrice(cleaningFee as number, cleaningCurrency || "TRY", currency, rates)
    : 0;
  const feeReady = canConvertForDisplay(rates, currency, [cleaningCurrency || "TRY"]);

  /* Tarih aralığı — "1 Ekim - 10 Kasım 2026" (ay adları `home.months`,
     mevcut `formatDiscountDateRange` çekirdeği; yeni tarih sistemi YOK). */
  const monthName = (m: number) =>
    dict.home.months[m as keyof typeof dict.home.months] ?? "";
  const rangeTemplates: DiscountDateRangeTemplates = {
    sameMonth: dict.price.seasonRangeSameMonth,
    sameYear: dict.price.seasonRangeSameYear,
    full: dict.price.seasonRangeFull,
  };

  /* 🛡️ İndirim aralıklarını sezon fiyatlarının içine kronolojik olarak
     yerleştir (bkz. buildSeasonSegments yukarıda). discounts
     verilmemişse/null ise boş dizi ile çağrılır → segments === prices
     ile birebir aynı (bölme YOK, mevcut görünüm korunur). */
  const segments = buildSeasonSegments(prices, discounts || []);

  return (
    /* 🛡️ 2026-10 SADE YATAY KART DÜZENİ — yalnız görünüm. Beyaz bölüm
       kabı; her sezon tek satır, iki bölümlü yatay kart (sol: tarih +
       minimum gece, sağ: gecelik fiyat + kısa süreli konaklama/temizlik
       ücreti). Gradient, gölge, giriş animasyonu ve hover-lift YOK.
       Container'a `overflow-hidden` BİLEREK eklenmedi — Bilgi popover'ı
       kart sınırının dışına taşabilir. */
    <div className="mt-5 rounded-[20px] bg-white p-4 md:p-6">
      <div className="space-y-3">
        {segments.map((seg, idx) => {
        /* Currency conversion — eski mantık AYNEN (segment artık
           `Price` satırının kendisi ya da onun indirimle bölünmüş bir
           alt-parçası olabilir; her iki durumda da fiyat/currency alanları
           AYNI `convertPrice` çağrısından geçer). */
        const convertedPrice = convertPrice(
          Number(seg.price || 0),
          seg.currency || "TRY",
          currency,
          rates
        );
        /* 🛡️ İNDİRİMLİ SEGMENT — indirimli fiyat MEVCUT price.engine
           fonksiyonu `applyDiscountToDailyPrice` ile hesaplanır (VillaCard
           discount variant'ı ile AYNI); yeni fiyat hesabı YOK. */
        const discountedResult = seg.discount
          ? applyDiscountToDailyPrice(
              {
                converted: convertedPrice,
                original: Number(seg.price || 0),
                original_currency: seg.currency || "TRY",
              },
              seg.discount,
              currency,
              rates
            )
          : null;
        /* 🛡️ Kur kapısı — yalnız bu segmentin kaynak para birimleri. */
        const segPriceReady = canConvertForDisplay(rates, currency, [seg.currency]);
        const segDiscountReady = canConvertForDisplay(rates, currency,
          collectSourceCurrencies(seg.currency, seg.discount ? [seg.discount] : null)
        );
        const isDiscounted =
          !!seg.discount &&
          !!discountedResult &&
          discountedResult.converted < convertedPrice;
        /* Badge yüzdesi — VillaCard discountBadgePercent ile AYNI desen. */
        const discountPercent = (() => {
          if (!isDiscounted || !seg.discount || !discountedResult) return null;
          if (seg.discount.discount_type === "percent") {
            const pct = Math.round(Number(seg.discount.discount_value) || 0);
            return pct > 0 ? pct : null;
          }
          if (convertedPrice > 0) {
            const pct = Math.round(
              ((convertedPrice - discountedResult.converted) / convertedPrice) * 100
            );
            return pct > 0 ? pct : null;
          }
          return null;
        })();

        const isOpen = openId === seg.key;
        /* Son sezon satırı — popover'ı yukarı doğru aç. */
        const isLastRow = idx === segments.length - 1;

        return (
          <div
            key={seg.key}
            className={
              "relative flex flex-col sm:flex-row rounded-xl border " +
              (isDiscounted
                ? "border-green-200 "
                : "border-[var(--color-stone-200)] ") +
              /* Açık popover'lı satır diğerlerinin üstünde kalsın. */
              (isOpen ? "z-20" : "z-0")
            }
          >
            {/* LEFT — tarih aralığı + minimum gece */}
            <div
              className={
                "min-w-0 flex-1 rounded-t-xl sm:rounded-tr-none sm:rounded-l-xl px-4 py-3.5 md:px-5 md:py-4 " +
                (isDiscounted ? "bg-green-50/60" : "bg-[var(--color-stone-50)]")
              }
            >
              {isDiscounted && (
                <span className="mb-1.5 inline-flex items-center rounded-full bg-green-600 px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-white">
                  {discountPercent !== null
                    ? formatDictionaryString(
                        dict.price.discountedBadgeWithPercent,
                        { percent: discountPercent }
                      )
                    : dict.price.discountedBadge}
                </span>
              )}
              <p className="font-display text-[14px] md:text-[15px] font-medium leading-snug tracking-[-0.01em] text-[var(--color-stone-900)] tabular-nums">
                {formatDiscountDateRange(
                  seg.start_date,
                  seg.end_date,
                  monthName,
                  rangeTemplates
                ) ||
                  `${formatDateForLocale(seg.start_date, effectiveLocale)} - ${formatDateForLocale(seg.end_date, effectiveLocale)}`}
              </p>
              {hasMinStay && (
                <p className="mt-1 text-[12.5px] md:text-[13px] text-[var(--color-stone-500)]">
                  {formatDictionaryString(dict.price.minNightsLong, {
                    n: minimumStayNights as number,
                  })}
                </p>
              )}
            </div>

            {/* RIGHT — gecelik fiyat + ücret satırı; ince dikey ayraç
                (mobilde yatay ayraç, alt alta). */}
            <div className="flex shrink-0 items-start justify-between gap-3 rounded-b-xl sm:rounded-bl-none sm:rounded-r-xl border-t sm:border-t-0 sm:border-l border-[var(--color-stone-200)] bg-white px-4 py-3.5 md:px-5 md:py-4 sm:min-w-[220px]">
              <div className="min-w-0 text-left sm:text-right sm:ml-auto">
                {isDiscounted && (
                  <p className="text-[11.5px] text-[var(--color-stone-400)] line-through tabular-nums leading-none mb-1">
                    {formatDisplayPrice(convertedPrice, currency, effectiveLocale, segPriceReady)}
                  </p>
                )}
                <p className="leading-none whitespace-nowrap">
                  <span
                    className={
                      "font-display font-bold text-[19px] md:text-[20px] tracking-[-0.02em] " +
                      (isDiscounted ? "text-green-700" : "text-ink")
                    }
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {isDiscounted
                      ? formatDisplayPrice(discountedResult!.converted, currency, effectiveLocale, segDiscountReady)
                      : formatDisplayPrice(convertedPrice, currency, effectiveLocale, segPriceReady)}
                  </span>{" "}
                  <span className="text-[12.5px] md:text-[13px] font-medium text-[var(--color-stone-500)]">
                    {dict.price.perNightSuffix}
                  </span>
                </p>
                {hasShortStayFee && (
                  <p className="mt-1.5 text-[12px] md:text-[12.5px] text-[var(--color-stone-500)]">
                    {formatDictionaryString(dict.price.shortStayFeeLine, {
                      n: cleaningLimit as number,
                      amount: formatDisplayPrice(convertedFee, currency, effectiveLocale, feeReady),
                    })}
                  </p>
                )}
              </div>

              {/* BILGI — yalnız depozito verisi varsa. Desktop hover,
                  mobil tap ile açılır; davranış DEĞİŞMEDİ. */}
              {hasInfo && (
                <div
                  className="relative shrink-0"
                  onMouseEnter={() => setOpenId(seg.key)}
                  onMouseLeave={() =>
                    setOpenId((cur) => (cur === seg.key ? null : cur))
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenId((cur) => (cur === seg.key ? null : seg.key))
                    }
                    aria-expanded={isOpen}
                    aria-label={dict.price.infoAriaLabel}
                    className={
                      "inline-flex items-center justify-center rounded-full border p-1.5 transition-colors duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 " +
                      (isOpen
                        ? "border-brand/40 bg-brand/[0.08] text-brand-strong"
                        : "border-[var(--color-stone-200)] text-[var(--color-stone-500)] hover:border-brand/40 hover:text-brand")
                    }
                  >
                    <Info size={12} strokeWidth={2} aria-hidden />
                  </button>

                  {isOpen && (
                    <div
                      role="note"
                      className={
                        "absolute right-0 z-20 w-60 rounded-xl border border-[var(--color-stone-200)] bg-white p-3.5 shadow-[0_12px_28px_-16px_rgba(27,46,94,0.25)] " +
                        (isLastRow ? "bottom-full mb-2" : "top-full mt-2")
                      }
                    >
                      <ul className="space-y-2.5">
                        {hasDeposit && (
                          <li className="flex items-center gap-2.5 text-[12px] text-[var(--color-stone-700)]">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand/10 text-ink shrink-0">
                              <ShieldCheck size={12} strokeWidth={1.9} aria-hidden />
                            </span>
                            {formatDictionaryString(dict.price.damageDeposit, {
                              amount: formatDisplayPrice(convertedDeposit, currency, effectiveLocale, depositReady),
                            })}
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
