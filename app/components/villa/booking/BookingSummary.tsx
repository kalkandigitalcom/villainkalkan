"use client";

/* ===============================================================
   🛡️ BookingSummary — fiyat özet kartı
   ===============================================================
   PURE UI: BookingSidebar'daki "SUMMARY" bloğunun birebir karşılığı.
   Sidebar ve modal AYNI bu component'i kullanır.

   KONTRAT (yalnız UI/metin/sıralama/renk):
     - formatCurrency çağrı semantic'i DEĞİŞMEZ (tüm değerler aynı).
     - Conditional render kuralları DEĞİŞMEZ (result.cleaning > 0; deposit > 0).
     - Row order (UI): Konaklama Tutarı (N Gece) → Kısa Süreli Konaklama
       Ücreti → [ayraç] Toplam Tutar (yeşil, vurgulu) → Ön ödeme (mor) /
       Girişte ödenecek (turuncu) — iki ayrı vurgu kutusu → Hasar
       Depozitosu (ayrı, soft bilgi kutusu + açıklama).
     - Hasar depozitosu görsel olarak ayrı; toplama EKLENMEZ (hesap aynı).
     - "Temizlik Ücreti" label'ı "Kısa Süreli Konaklama Ücreti" oldu —
       yalnız görünen metin; `result.cleaning` DEĞİŞMEDİ.

   🛡️ HAVUZ ISITMA — yerleşim turu (yalnız bu tur — data/state/handler/
   hesap DEĞİŞMEDİ):
     - Havuz Isıtma satırı artık BURADA (Kısa Süreli Konaklama Ücreti'nin
       hemen altında, Toplam Tutar'ın hemen üstünde) — daha önce
       BookingSidebar/VillaCardBookingModal'da SUMMARY'nin DIŞINDA, ayrı
       büyük bordered bir kart olarak duruyordu (Misafir alanının altında).
       O kart tamamen kaldırıldı; checkbox + tutar artık normal bir fiyat
       satırı deseninde (Row ile aynı hizada, sol=checkbox+label, sağ=
       seçiliyse toplam).
     - Görünürlük koşulu AYNEN (yalnız taşındı): `poolHeatingFee` sayı ve
       >0. Eskiden ayrıca `startDate&&endDate&&selectedNights>0` de
       kontrol ediliyordu — bu component zaten yalnız `result` mevcutken
       (yani tarih seçili + gece>0) render edildiği için `result.nights>0`
       ile AYNI garantiyi taşır; caller'daki dış koşul DEĞİŞMEDİ.
     - Checked/unchecked state, handler (`onPoolHeatingChange` →
       `setPoolHeatingSelected`), toplam (`poolHeatingTotal` — engine'den,
       YENİDEN hesaplanmadı) BİREBİR aynı; yalnız JSX konumu/görünümü
       değişti.
     - Gecelik oran villa'nın KENDİ para biriminde (`poolHeatingCurrency`)
       gösterilir — eski "Gece başına X" metniyle AYNI kaynak/format.

   🛡️ HAVUZ ISITMA — metin standardizasyonu turu (yalnız bu tur — data/
   state/handler/hesap DEĞİŞMEDİ):
     - Checkbox label'ı "Havuz Isıtma" → "Havuz Isıtma Ücreti" oldu (satır
       hem toplam tutarı hem gecelik oranı gösterdiği için ücret ifade
       eden bir satır — repo genelinde aynı standarda çekildi). Teknik
       prop/field isimleri (`poolHeatingFee`, `poolHeatingSelected`,
       `poolHeatingTotal`, `pool_heating_fee` vb.) DEĞİŞMEDİ.

   🛡️ GÖRSEL REVİZYON (yalnız bu tur — data/state/handler/hesap DEĞİŞMEDİ):
     - Kart üstünde ince turuncu→mavi (#C8973A → #C8973A) accent çizgisi
       — PriceList.tsx / ShortStayFeeNotice.tsx'teki aynı marka imzası.
     - Toplam Tutar artık yumuşak yeşil zeminli, vurgulu bir satır
       (aynı yeşil semantik renk — yalnız daha belirgin).
     - Ön ödeme / Girişte ödenecek iki ayrı, kendi soft zeminli kutuda
       yan yana (mor / turuncu semantiği AYNEN korunuyor) — "şimdi
       ödenecek" ile "girişte ödenecek" ilk bakışta net ayrışıyor.
     - Hasar Depozitosu artık mavi tonlu, soft bordürlü ayrı bir bilgi
       kutusu + küçük ShieldCheck rozet ikonu (marka mavisi #C8973A).
       Açıklama METNİ BİREBİR AYNI.
     - Tüm değişiklik yalnız JSX/Tailwind class'ları; padding'ler
       mütevazı tutuldu (büyük kart/aşırı boşluk yok), sidebar genişliği
       ve responsive davranış etkilenmedi (dış container aynı).
   =============================================================== */

import { ShieldCheck } from "lucide-react";

import {
  canConvertForDisplay,
  collectSourceCurrencies,
  formatCurrency,
  formatDisplayPrice,
} from "@/lib/currency";
import { useCurrency } from "@/app/context/CurrencyContext";

import type { BookingResult, ActiveStayDiscount } from "./useBookingEngine";
/* 🛡️ PHASE 10B — locale-aware UI stringleri. `locale` opsiyonel,
   default "tr" — mevcut TR call-site'ları (BookingSidebar,
   VillaCardBookingModal) hiç değişmeden byte-identical render eder.
   Hesap/formatCurrency semantiğine DOKUNULMADI — yalnız metin
   kaynağı değişti. */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

type Props = {
  result: BookingResult;
  /* 🛡️ villa_discounts — GÖRSEL GÖSTERİM (UI-only, bkz. useBookingEngine.ts
     doc-comment). null/undefined → seçili aralıkta aktif indirim yok,
     satır AYNEN eskisi gibi (BYTE-IDENTICAL) render edilir. */
  activeStayDiscount?: ActiveStayDiscount | null;
  prepayment: number;
  prepaymentRate: number;
  convertedDeposit: number;
  deposit: number;
  /* 🛡️ HAVUZ ISITMA — yerleşim turu. Hepsi caller'ın zaten sahip olduğu
     engine değerleri (useBookingEngine) — burada YENİ bir hesaplama
     YAPILMAZ, yalnız render edilir. `poolHeatingFee`/`poolHeatingCurrency`
     villa'nın KENDİ (orijinal) gecelik ücreti/para birimi; `poolHeatingTotal`
     engine'in zaten display currency'ye çevirdiği çalışma toplamı. */
  poolHeatingFee?: number | null;
  poolHeatingCurrency?: string | null;
  poolHeatingSelected?: boolean;
  onPoolHeatingChange?: (checked: boolean) => void;
  poolHeatingTotal?: number;
  /* 🛡️ Migration 076 — sezonluk ay kısıtı. Villanın gerçek
     pool_heating_months'una göre rezervasyon tarih aralığı sezon
     dışındaysa checkbox HİÇ GÖSTERİLMEZ. Default true — eski
     caller'lar (varsa) bu prop'u geçmeden BYTE-IDENTICAL davranır
     (checkbox eskisi gibi yalnız fee>0'a bakarak görünür). */
  poolHeatingActiveForRange?: boolean;
  /* 🛡️ PHASE 10B — opsiyonel, default "tr". */
  locale?: Locale;
  /* 🛡️ Kur kapısı (useBookingEngine `summaryPriceReady` / `depositReady`).
     Verilmezse sonuçtaki para birimlerinden context ile hesaplanır. */
  priceReady?: boolean;
  depositReady?: boolean;
};

export default function BookingSummary({
  result,
  activeStayDiscount = null,
  prepayment,
  prepaymentRate,
  convertedDeposit,
  deposit,
  poolHeatingFee = null,
  poolHeatingCurrency = "TRY",
  poolHeatingSelected = false,
  onPoolHeatingChange,
  poolHeatingTotal = 0,
  poolHeatingActiveForRange = true,
  locale,
  priceReady,
  depositReady,
}: Props) {
  const { currency, rates } = useCurrency();
  const summaryReady =
    priceReady ??
    canConvertForDisplay(rates, currency,
      collectSourceCurrencies(
        result.original_currency,
        result.cleaning > 0 ? result.original_cleaning_currency : null,
        poolHeatingSelected ? poolHeatingCurrency : null,
        activeStayDiscount ? [activeStayDiscount.discount] : null
      )
    );
  const depositDisplayReady = depositReady ?? canConvertForDisplay(rates, currency, ["TRY"]);
  const dict = getDictionary(locale);
  const accommodationLabel = formatDictionaryString(
    dict.booking.accommodationAmountLabel,
    { n: result.nights }
  );

  const fmt = (v: number) =>
    formatDisplayPrice(v, currency, locale ?? DEFAULT_LOCALE, summaryReady);
  return (
    <div className="space-y-3 text-[13.5px]">
      {/* 🎨 PREMIUM DÖKÜM — fildişi zemin, ince ayırıcılı satırlar,
          tipografik olarak belirgin toplam. Satırlar/koşullar/değerler
          AYNEN (yalnız görünüm). */}
      <div
        data-booking-breakdown
        className="relative rounded-2xl border border-brand/15 bg-[#FFFAF1] px-4"
      >
        <div className="divide-y divide-[var(--color-stone-200)]">
          {/* Konaklama Tutarı (N Gece) — indirim aktifse eski/yeni fiyat
              + etiket (activeStayDiscount price.engine çıktısı). */}
          {activeStayDiscount ? (
            <div className="flex items-start justify-between gap-3 py-3">
              <span className="text-[var(--color-stone-600)]">
                {accommodationLabel}
              </span>
              <div className="text-right">
                <span className="block text-[11.5px] text-[var(--color-stone-400)] line-through tabular-nums">
                  {fmt(activeStayDiscount.originalStay)}
                </span>
                <span className="block font-semibold text-ink tabular-nums">
                  {fmt(activeStayDiscount.discountedStay)}
                </span>
                <span className="mt-1 inline-block rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-semibold text-ink text-center whitespace-nowrap">
                  {dict.booking.discountedTotal}
                </span>
              </div>
            </div>
          ) : (
            <Row label={accommodationLabel} value={fmt(result.stay)} />
          )}

          {result.cleaning > 0 && (
            <Row label={dict.booking.shortStayFeeLabel} value={fmt(result.cleaning)} />
          )}

          {/* HAVUZ ISITMA — checkbox + (seçiliyse) toplam; koşul AYNEN. */}
          {typeof poolHeatingFee === "number" &&
            poolHeatingFee > 0 &&
            poolHeatingActiveForRange && (
            <div className="py-3">
              <label className="flex items-center justify-between gap-3 cursor-pointer group">
                <span className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={poolHeatingSelected}
                    onChange={(e) => onPoolHeatingChange?.(e.target.checked)}
                    className="!w-4 !h-4 shrink-0 accent-[var(--color-champagne-500)] !rounded"
                  />
                  <span className="text-[var(--color-stone-600)] group-hover:text-ink transition-colors">
                    {dict.booking.poolHeatingFeeLabel}
                  </span>
                </span>
                {poolHeatingSelected && (
                  <span className="font-semibold text-ink tabular-nums">
                    {fmt(poolHeatingTotal)}
                  </span>
                )}
              </label>
              <p className="pl-[26px] mt-0.5 text-[11px] text-[var(--color-stone-400)]">
                {formatCurrency(poolHeatingFee, poolHeatingCurrency || "TRY", locale ?? DEFAULT_LOCALE)}{" "}
                {dict.booking.poolHeatingPerNightSuffix}
                {poolHeatingSelected &&
                  ` ${formatDictionaryString(dict.booking.poolHeatingNightsMultiplier, {
                    n: result.nights,
                  })}`}
              </p>
            </div>
          )}

          {/* TOPLAM TUTAR — tipografik vurgu (lacivert, büyük). */}
          <div data-booking-total className="flex items-baseline justify-between gap-3 py-3.5">
            <span className="font-semibold text-ink">{dict.booking.total}</span>
            <span className="font-display text-[22px] font-bold leading-none tracking-[-0.01em] text-ink tabular-nums">
              {fmt(result.total)}
            </span>
          </div>

          {/* ÖN ÖDEME + GİRİŞTE ÖDENECEK — sade satırlar; ön ödeme altın. */}
          <div className="space-y-2 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[var(--color-stone-600)]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-brand" />
                {formatDictionaryString(dict.booking.prepaymentAmountLabel, {
                  rate: prepaymentRate,
                })}
              </span>
              <span className="font-semibold text-brand-strong tabular-nums">
                {fmt(prepayment)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[var(--color-stone-600)]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-[var(--color-stone-300)]" />
                {dict.booking.dueAtCheckinLabel}
              </span>
              <span className="font-semibold text-ink tabular-nums">
                {fmt(result.total - prepayment)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* HASAR DEPOZİTOSU — toplama dahil değil (hesap aynı); sade bilgi
          notu. Açıklama metni BİREBİR AYNI. */}
      {deposit > 0 && (
        <div data-booking-deposit className="flex gap-3 rounded-2xl border border-[var(--color-stone-200)] bg-white px-4 py-3">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink">
            <ShieldCheck size={14} strokeWidth={1.9} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-ink">{dict.booking.depositLabel}</span>
              <span className="font-semibold text-ink tabular-nums">
                {formatDisplayPrice(convertedDeposit, currency, locale ?? DEFAULT_LOCALE, depositDisplayReady)}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] text-[var(--color-stone-500)] leading-relaxed">
              {dict.booking.depositNote}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-[var(--color-stone-600)]">{label}</span>
      <span className="font-semibold text-ink tabular-nums">{value}</span>
    </div>
  );
}
