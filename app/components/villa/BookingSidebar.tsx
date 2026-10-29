"use client";

/* ===============================================================
   🛡️ BookingSidebar — CONTAINER/RENDER LAYER
   ===============================================================
   Domain logic'i (selection state, availability fetch, merged
   arrays, pricing, prepayment, minimum stay, navigation URL inşası)
   `useBookingEngine` hook'una delege edildi → codebase'de TEK booking
   state machine.

   Bu container yalnız:
     - UI state'i (openCalendar, openGuests, currentMonth, freshSelection)
     - DOM refs (click-outside)
     - Üst-seviye layout (price head + date pill + guests pill +
       summary + warning + CTA)

   Calendar/summary/warning gövdeleri paylaşılan child component'lere
   delege edildi (BookingCalendar, BookingSummary, BookingMinStayWarning)
   → modal aynı component'leri kullanır, drift YOK.

   DOKUNULMAYAN ÖZELLİKLER (BYTE-IDENTICAL kontrat):
     - DayPicker handler davranışı (BookingCalendar içinde)
     - Selection lifecycle (freshSelection / hasConflict / getValidEndDate)
     - Half-open `[)` semantic, adjacent reservation rule
     - alert davranışı
     - Network query'leri (engine içinde, aynı SQL)
     - Navigation URL formatı
     - Currency / pricing / prepayment hesap sonuçları
     - onClick/disabled/submit/validation handler'ları

   🎨 UI REVİZYONU (bu tur): "Booking Desk" editorial tasarım — sticky
   kaldırıldı (page.tsx'te), ağır kart yerine soft/minimal panel, ince
   separator'lar, CHECK-IN/CHECK-OUT kompozisyonu, marka gradienti CTA'da.
   Yalnız JSX/className; state/handler/prop kontratı DEĞİŞMEDİ.
   =============================================================== */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ArrowRight, CalendarDays, ChevronDown, Loader2, Users, X } from "lucide-react";

import { type VillaPriceEmbed } from "@/lib/villa-row.types";
import type { DiscountRange } from "@/lib/price.engine";
import {
  EMPTY_EXTERNAL_STRING_ARRAYS,
  type ExternalCalendarStringArrays,
} from "@/lib/external-calendar.public.shared";

import { useBookingEngine } from "@/app/components/villa/booking/useBookingEngine";
/* 🛡️ Aşama 7B — BookingCalendar (react-day-picker + date-fns + RDP CSS)
   artık STATİK import EDİLMEZ → villa detayının ilk JS bundle'ından çıktı.
   Takvim zaten yalnız `openCalendar` true iken render ediliyordu (SSR'da
   hiç yok); chunk ilk açılış niyetinde (hover / pointerdown / click)
   yüklenir, dropdown ancak bileşen HAZIR olunca açılır → boş/yarım takvim
   kutusu veya layout shift OLUŞMAZ, ilk tıklama kaybolmaz. */
import type BookingCalendarComponent from "@/app/components/villa/booking/BookingCalendar";
import BookingSummary from "@/app/components/villa/booking/BookingSummary";
import BookingMinStayWarning from "@/app/components/villa/booking/BookingMinStayWarning";
/* 🛡️ PHASE 10B — locale-aware UI stringleri. `locale` opsiyonel,
   default "tr" — mevcut TR call-site'ı (kiralik-villa/[slug]/page.tsx)
   hiç değişmeden byte-identical render eder. Selection/pricing/
   navigation mantığına (useBookingEngine) DOKUNULMADI — yalnız
   `locale` engine'e ve child component'lere iletiliyor. */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { DEFAULT_LOCALE, LOCALE_BCP47, type Locale } from "@/lib/i18n/config";
/* 🛡️ Villa detay "Müsaitlik Takvimi" popup'ı — yalnız açma olayı. */
import { VILLA_AVAILABILITY_OPEN_EVENT } from "@/app/components/villa/villa-detail-events";

/* 🛡️ HAVUZ ISITMA — yerleşim turu. Satır BookingSummary'nin içine
   taşındı (bkz. o dosyadaki yorum); bu dosyada artık formatCurrency/
   useCurrency import'una gerek yok — poolHeatingFee/Currency/Total
   AYNEN prop olarak BookingSummary'ye geçiliyor, dönüşüm/format
   YENİDEN BURADA YAPILMAZ. */

/* 🛡️ PURE UI FORMAT HELPER — CHECK-IN/CHECK-OUT pill'lerinde tek bir
   tarihin gösterim biçimi. Eski tek-pill kodundaki
   `toLocaleDateString("tr-TR", { day: "numeric", month: "short" })`
   çağrısıyla BİREBİR aynı; state/hesaplama YOK, yalnız display format. */
function formatDatePillLabel(date: Date, bcp47: string): string {
  return date.toLocaleDateString(bcp47, {
    day: "numeric",
    month: "short",
  });
}

type Props = {
  villaSlug: string;
  villaId: string;
  prices: VillaPriceEmbed[];
  /* Public-safe villa_discounts (villa-discount.service.ts). */
  discounts?: DiscountRange[];
  deposit?: number;
  cleaning_fee?: number;
  cleaning_currency?: string;
  cleaning_limit?: number;
  /* 🛡️ HAVUZ ISITMA — 5. adım (migration 074, villa.service.ts →
     page.tsx zincirinden gelir). NULL/undefined/0 → seçenek hiç
     render edilmez (useBookingEngine ile aynı semantik). */
  pool_heating_fee?: number | null;
  pool_heating_currency?: string | null;
  /* 🛡️ Migration 076 — sezonluk ay kısıtı. NULL/undefined = "ay
     kısıtlaması yok" (12 ay aktif). */
  pool_heating_months?: number[] | null;
  /* Villaya özel ön ödeme oranı (override).
     null/undefined ise global settings kullanılır. */
  custom_prepayment_rate?: number | null;
  /* Minimum konaklama gece sayısı.
     null veya <=1 → enforcement YOK. Detay: useBookingEngine. */
  minimum_stay_nights?: number | null;
  /* 🛡️ Orphan-gap kuralı (admin ayarı). Default false → geçilmezse
     mevcut davranış. Villa page settings'ten değeri geçer. */
  orphanGapRuleEnabled?: boolean;
  /* /arama → detail navigasyonunda URL üzerinden gelen tarihler.
     Engine ilk render'da hidrate eder (lazy initializer). */
  initialStart?: string | null;
  initialEnd?: string | null;
  /* External iCal block date strings (server-fetched).
     Engine reservation/manual array'leriyle merge eder. */
  externalBlocks?: ExternalCalendarStringArrays;
  /* 🛡️ PHASE 10B — opsiyonel, default "tr". */
  locale?: Locale;
  /* 🛡️ Gizli villa linki (/v/[token]) — villa pasif/yayında değil;
     amaç yalnız "göster + tarih seç + fiyat hesapla". true → yalnız
     "Rezervasyon Yap" butonu render EDİLMEZ (normal rezervasyon sayfası
     pasif villayı bulamaz). Tarih seçimi, fiyat hesabı ve özet AYNEN.
     Default false → normal villa sayfaları DEĞİŞMEZ. */
  hideReservationCta?: boolean;
};

/* 🛡️ Aşama 7B — lazy BookingCalendar yükleyici (modül seviyesi, tek
   promise). Aynı sayfada tekrar tekrar indirilmez; hata olursa promise
   sıfırlanır → sonraki açılış denemesi yeniden yükler. `loadedBookingCalendar`
   client-side navigasyonla sayfaya yeniden gelindiğinde bileşenin
   anında hazır olmasını sağlar (openCalendar=false başladığı için SSR/
   hydration çıktısını etkilemez). */
type LazyCalendarComponentType = typeof BookingCalendarComponent;
let bookingCalendarPromise: Promise<LazyCalendarComponentType> | null = null;
let loadedBookingCalendar: LazyCalendarComponentType | null = null;
function loadBookingCalendar(): Promise<LazyCalendarComponentType> {
  if (!bookingCalendarPromise) {
    bookingCalendarPromise = import(
      "@/app/components/villa/booking/BookingCalendar"
    ).then(
      (mod) => {
        loadedBookingCalendar = mod.default;
        return mod.default;
      },
      (err: unknown) => {
        bookingCalendarPromise = null;
        throw err;
      }
    );
  }
  return bookingCalendarPromise;
}

export default function BookingSidebar({
  villaSlug,
  villaId,
  prices,
  discounts = [],
  deposit = 0,
  cleaning_fee = 0,
  cleaning_currency = "TRY",
  cleaning_limit = 0,
  pool_heating_fee = null,
  pool_heating_currency = "TRY",
  pool_heating_months = null,
  custom_prepayment_rate = null,
  minimum_stay_nights = null,
  orphanGapRuleEnabled = false,
  externalBlocks = EMPTY_EXTERNAL_STRING_ARRAYS,
  initialStart = null,
  initialEnd = null,
  locale,
  hideReservationCta = false,
}: Props) {
  const dict = getDictionary(locale);
  const bcp47 = LOCALE_BCP47[locale ?? DEFAULT_LOCALE];

  /* === DOMAIN — TEK SOURCE-OF-TRUTH === */
  const engine = useBookingEngine({
    villaSlug,
    villaId,
    prices,
    discounts,
    deposit,
    cleaning_fee,
    cleaning_currency,
    cleaning_limit,
    pool_heating_fee,
    pool_heating_currency,
    pool_heating_months,
    custom_prepayment_rate,
    minimum_stay_nights,
    orphanGapRuleEnabled,
    externalBlocks,
    initialStart,
    initialEnd,
    locale,
  });

  const {
    startDate,
    endDate,
    adults,
    children,
    setAdults,
    setChildren,
    prepaymentRate,
    selectedNights,
    minStayThreshold,
    minimumStayValid,
    priceUnavailable,
    isGapOverride,
    result,
    activeStayDiscount,
    prepayment,
    convertedDeposit,
    /* 🛡️ Kur kapısı (yalnız gösterim). */
    summaryPriceReady,
    depositReady,
    parseLocalDate,
    handleReservation,
    /* 🛡️ alert() yerine inline banner — null → gizli. */
    reservationError,
    /* 🛡️ Başlangıç aralığının müsaitliği doğrulanana kadar CTA bekler. */
    availabilityPending,
    initialRangeConflict,
    /* 🛡️ HAVUZ ISITMA — 5. adım. YENİ bir hesaplama YOK; üçü de
       useBookingEngine'den (4. adım) geldiği gibi kullanılır. */
    poolHeatingSelected,
    setPoolHeatingSelected,
    poolHeatingTotal,
    /* 🛡️ Migration 076 — sezonluk ay kısıtı (checkbox görünürlüğü). */
    poolHeatingActiveForRange,
    /* 🎨 Panel başlığı — MEVCUT engine değeri (formatCurrency +
       convertPrice ile zaten biçimlenmiş); yeni hesaplama YOK. */
    startingPrice,
  } = engine;
  const hasStartingPrice =
    prices.length > 0 && Number(prices[0]?.price || 0) > 0;
  const ctaDisabled =
    !minimumStayValid || priceUnavailable || availabilityPending || initialRangeConflict;


  /* === UI STATE — CONTAINER OWNS === */
  const [openGuests, setOpenGuests] = useState(false);
  const [openCalendar, setOpenCalendar] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* 🛡️ Aşama 7B — lazy takvim bileşeni. null → henüz yüklenmedi.
     Dropdown yalnız `openCalendar && BookingCalendar` iken render edilir:
     kullanıcı tıkladığında `openCalendar` HEMEN true olur (niyet
     kaybolmaz); bileşen hazır olduğu an takvim açılır. Bu arada dışarı
     tıklanırsa mevcut click-outside handler'ı `openCalendar`'ı kapatır →
     bekleyen açılış da iptal olur (eski davranışla aynı semantik). */
  const [BookingCalendar, setBookingCalendar] =
    useState<LazyCalendarComponentType | null>(() => loadedBookingCalendar);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const ensureBookingCalendar = () => {
    if (BookingCalendar) return;
    loadBookingCalendar()
      .then((Cal) => {
        /* Unmount sonrası state güncellemesi YAPILMAZ. */
        if (isMountedRef.current) setBookingCalendar(() => Cal);
      })
      .catch(() => {
        /* Chunk yüklenemezse takvim açılmaz; sonraki tıklama yeniden
           dener (promise sıfırlandı). */
      });
  };
  const guestsRef = useRef<HTMLDivElement>(null);

  /* currentMonth: takvim ilk açıldığında hangi ayı göstereceği.
     initialStart varsa o ay açılır → kullanıcı tarihlerini
     hemen görür. Yoksa bugünün ayı (eski davranış). */
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    initialStart ? parseLocalDate(initialStart) : new Date()
  );
  /* freshSelection state'i kaldırıldı (UX polish — Booking.com pattern).
     Eskiden: pill açılışında freshSelection=true → calendar ilk click
     reset yapardı. Karmaşık state machine'di.
     Yeni: completed range varsa BookingCalendar onSelect kendi içinde
     resetler (selectedDay yeni `from` olur). Pill açılışında özel state
     gerekmiyor — kullanıcı önceki range'i görür, yeni güne tıklayınca
     reset olur (Booking.com/Airbnb davranışı). */

  /* === MÜSAİTLİK POPUP — EK UI state ===
     Villa detaydaki "Müsaitlik Takvimi" butonu / şerit öğesi
     `villa-detail:availability-open` olayını yayınlar. Popup, dropdown
     ile AYNI `BookingCalendar` + AYNI `engine` (tarih state'i) ile
     açılır → seçilen tarihler bu formda anında görünür. Seçim,
     fiyat, müsaitlik ve rezervasyon mantığı DEĞİŞMEZ. */
  const [openAvailabilityModal, setOpenAvailabilityModal] = useState(false);
  const availabilityTitleId = useId();
  const availabilityCloseRef = useRef<HTMLButtonElement>(null);
  /* Güncel tarih state'ini gören açılış fonksiyonu; dinleyici tek
     sefer kurulur ve her zaman en güncel fonksiyonu çağırır. */
  const openAvailabilityRef = useRef<() => void>(() => {});
  useEffect(() => {
    openAvailabilityRef.current = () => {
      /* Pill tıklamasıyla AYNI ay seçimi. */
      const targetMonth =
        endDate ||
        startDate ||
        (initialRangeConflict && initialStart
          ? parseLocalDate(initialStart)
          : new Date());
      setCurrentMonth(targetMonth);
      setOpenCalendar(false);
      setOpenAvailabilityModal(true);
      ensureBookingCalendar();
    };
  });
  useEffect(() => {
    const onOpen = () => openAvailabilityRef.current();
    window.addEventListener(VILLA_AVAILABILITY_OPEN_EVENT, onOpen);
    return () =>
      window.removeEventListener(VILLA_AVAILABILITY_OPEN_EVENT, onOpen);
  }, []);

  /* Escape ile kapat + arka plan kaydırma kilidi (VillaMapModal /
     VillaCardBookingModal ile aynı desen; kaydırma konumu korunur). */
  useEffect(() => {
    if (!openAvailabilityModal) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenAvailabilityModal(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    availabilityCloseRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [openAvailabilityModal]);

  /* === CLICK-OUTSIDE — UI dropdown close === */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        setOpenCalendar(false);
      }
      if (
        guestsRef.current &&
        target &&
        !guestsRef.current.contains(target)
      ) {
        setOpenGuests(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      data-booking-panel
      className="
        relative rounded-[28px]
        bg-white border border-[var(--color-stone-100)]
        shadow-[0_28px_64px_-36px_rgba(27,46,94,0.42),0_2px_6px_-2px_rgba(27,46,94,0.06)]
        px-5 pt-7 pb-6 sm:px-6 md:px-7 md:pt-8
        space-y-5
      "
    >
      {/* İnce altın üst çizgi — marka imzası (dekoratif). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-brand to-transparent"
      />

      {/* ═══ FİYAT BAŞLIĞI — gecelik fiyat tipografiyle öne çıkar.
          Değer MEVCUT engine.startingPrice (para birimi/kur dahil);
          fiyat yoksa yalnız başlık metinleri gösterilir. ═══ */}
      <div data-booking-header>
        <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-brand-strong">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rotate-45 rounded-[1px] bg-brand" />
          {dict.booking.sidebarEyebrow}
        </span>
        {hasStartingPrice ? (
          <p data-booking-nightly className="mt-2.5 flex items-baseline gap-1.5">
            <span className="font-display text-[30px] md:text-[32px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">
              {startingPrice}
            </span>
            <span className="text-[14px] font-medium text-[var(--color-stone-500)]">
              {dict.booking.perNightSuffix}
            </span>
          </p>
        ) : (
          <h2 className="mt-2 font-display text-[22px] leading-tight tracking-[-0.02em] text-ink">
            {dict.booking.sidebarTitle}
          </h2>
        )}
        <p className="mt-2 text-[12.5px] text-[var(--color-stone-500)] leading-relaxed">
          {dict.booking.sidebarSubtitle}
        </p>
      </div>

      {/* ═══ TARİH + MİSAFİR — tek çerçeveli form grubu: üstte giriş/çıkış
          yan yana, altta misafir. Tüm alanlar tıklanabilir; datepicker,
          dropdown ve guest state/handler'ları AYNEN. ═══ */}
      <div
        data-booking-fields
        className="rounded-2xl border border-[var(--color-stone-200)] bg-white shadow-[0_1px_2px_rgba(27,46,94,0.04)]"
      >
      {/* DATE      <div aria-hidden="true" className="h-px bg-[var(--color-stone-100)]" />

      {/* DATE — mevcut tarih seçim state/behavior/handler AYNEN; yalnız
         CHECK-IN / CHECK-OUT kompozisyonuna çevrildi. */}
      {/* 🛡️ id="booking-date-field" — MobileBookingCta scroll hedefi.
         Yalnız anchor; tasarım/tarih-seçim mantığı DEĞİŞMEZ. */}
      <div ref={ref} id="booking-date-field" className="relative">
        <div
          /* 🛡️ Aşama 7B — açılış niyetinde (fare üstüne gelme / basma)
             chunk'ı önceden yükle; yalnız network isteği başlatır,
             UI/state DEĞİŞMEZ. */
          onPointerEnter={ensureBookingCalendar}
          onPointerDown={ensureBookingCalendar}
          onClick={() => {
            /* 🛡️ Başlangıç aralığı dolu çıkıp seçim temizlendiyse takvim
               yine aranan ayda açılır (bugünün ayına düşmez). Seçim varsa
               veya URL tarihi yoksa davranış AYNEN. */
            const targetMonth =
              endDate ||
              startDate ||
              (initialRangeConflict && initialStart
                ? parseLocalDate(initialStart)
                : new Date());
            setCurrentMonth(targetMonth);
            setOpenCalendar(true);
            ensureBookingCalendar();
          }}
          role="button"
          tabIndex={0}
          aria-expanded={openCalendar}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              (e.currentTarget as HTMLElement).click();
            }
          }}
          className="grid grid-cols-2 divide-x divide-[var(--color-stone-200)] cursor-pointer rounded-t-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50"
        >
          <div className="group min-w-0 px-4 py-3.5 transition-colors duration-200 hover:bg-[#FFFAF1] rounded-tl-2xl motion-reduce:transition-none">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] tracking-[0.18em] uppercase font-semibold text-[var(--color-stone-400)] group-hover:text-brand-strong transition-colors duration-200 motion-reduce:transition-none">
                {dict.booking.checkInPillLabel}
              </span>
              <CalendarDays size={15} strokeWidth={1.75} aria-hidden className="shrink-0 text-brand" />
            </div>
            <div
              className={`mt-1.5 text-[14.5px] font-semibold truncate ${
                startDate ? "text-ink" : "text-[var(--color-stone-400)] font-medium"
              }`}
            >
              {startDate
                ? formatDatePillLabel(startDate, bcp47)
                : dict.booking.selectDatePlaceholder}
            </div>
          </div>

          <div className="group min-w-0 px-4 py-3.5 transition-colors duration-200 hover:bg-[#FFFAF1] rounded-tr-2xl motion-reduce:transition-none">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] tracking-[0.18em] uppercase font-semibold text-[var(--color-stone-400)] group-hover:text-brand-strong transition-colors duration-200 motion-reduce:transition-none">
                {dict.booking.checkOutPillLabel}
              </span>
              <CalendarDays size={15} strokeWidth={1.75} aria-hidden className="shrink-0 text-brand" />
            </div>
            <div
              className={`mt-1.5 text-[14.5px] font-semibold truncate ${
                endDate ? "text-ink" : "text-[var(--color-stone-400)] font-medium"
              }`}
            >
              {endDate
                ? formatDatePillLabel(endDate, bcp47)
                : dict.booking.selectDatePlaceholder}
            </div>
          </div>
        </div>

        {openCalendar && BookingCalendar && (
          <div
            className="
              absolute right-0 z-[999] mt-2 bg-white border border-[var(--color-stone-100)]
              rounded-2xl shadow-[0_16px_40px_-16px_rgba(27,46,94,0.16)]
              p-4 md:p-5
              w-[min(22rem,calc(100vw-2.5rem))]
            "
          >
            <BookingCalendar
              engine={engine}
              currentMonth={currentMonth}
              onCurrentMonthChange={setCurrentMonth}
              onSelectComplete={() => setOpenCalendar(false)}
              locale={locale}
            />
          </div>
        )}
      </div>

      {/* GUESTS — mevcut guest selector state/behavior/handler AYNEN. */}
      <div ref={guestsRef} className="relative border-t border-[var(--color-stone-200)]">
        <div
          onClick={() => setOpenGuests(!openGuests)}
          role="button"
          tabIndex={0}
          aria-expanded={openGuests}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpenGuests(!openGuests);
            }
          }}
          className="group flex items-center gap-3 cursor-pointer px-4 py-3.5 rounded-b-2xl transition-colors duration-200 hover:bg-[#FFFAF1] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50 motion-reduce:transition-none"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-[var(--color-stone-400)] group-hover:text-brand-strong transition-colors duration-200 motion-reduce:transition-none">
              {dict.booking.guestsLabel}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[14.5px] font-semibold text-ink">
              <Users size={15} strokeWidth={1.75} aria-hidden className="shrink-0 text-brand" />
              {formatDictionaryString(dict.booking.guestsSummary, {
                adults,
                children,
              })}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`shrink-0 text-[var(--color-stone-400)] transition-transform duration-200 motion-reduce:transition-none ${
              openGuests ? "rotate-180" : ""
            }`}
          />
        </div>

        {openGuests && (
          <div className="absolute z-50 mt-2 w-full bg-white border border-[var(--color-stone-100)] rounded-2xl shadow-[0_20px_44px_-18px_rgba(27,46,94,0.28)] p-5 space-y-4">
            <Counter
              label={dict.booking.adultsLabel}
              value={adults}
              min={1}
              onChange={setAdults}
            />
            <Counter
              label={dict.booking.childrenLabel}
              value={children}
              min={0}
              onChange={setChildren}
            />
            <button
              onClick={() => setOpenGuests(false)}
              className="w-full rounded-full bg-ink hover:bg-ink/90 text-white text-[13px] font-semibold py-2.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {dict.booking.confirm}
            </button>
          </div>
        )}
      </div>

      </div>
      {/* /data-booking-fields */}

      {/* ═══════════════════════════════════════════════════════
          🛡️ FAZ 26B — MINIMUM STAY WARNING CARD
          ═══════════════════════════════════════════════════════
          Yalnız: threshold>0 + BOTH dates selected + nights<threshold.
          Konum: SUMMARY yerine aynı blokta render olur → layout
          shift YOK (warning ile summary mutually exclusive). Koşul AYNEN. */}
      {minStayThreshold > 0 &&
        !!startDate &&
        !!endDate &&
        selectedNights < minStayThreshold &&
        !isGapOverride && (
          <BookingMinStayWarning
            minStayThreshold={minStayThreshold}
            selectedNights={selectedNights}
            locale={locale}
          />
        )}

      {/* 🛡️ EKSİK SEZON FİYATI — yanlış/düşük tutar göstermek yerine
          durumu açıkça bildir. Yalnız fiyatı tanımlı olmayan gece
          varken render edilir; diğer TÜM durumlarda hiçbir şey
          değişmez (additive blok). */}
      {priceUnavailable && (
        <p
          role="status"
          className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
        >
          {dict.booking.priceUnavailableNotice}
        </p>
      )}

      {/* 🛡️ GAP OVERRIDE bilgi metni — koşul AYNEN. */}
      {isGapOverride && (
        <p className="text-[12px] text-emerald-700 bg-emerald-50/70 border border-emerald-100 rounded-xl px-3 py-2">
          {dict.booking.gapOverrideNotice}
        </p>
      )}

      {/* SUMMARY — minimum stay valid + result mevcut ise (koşul AYNEN).
         İnce üst-ayraç ile akışa entegre; BookingSummary'nin kendi
         içeriğine/hesabına dokunulmadı. */}
      {startDate && endDate && result && (
        <div data-booking-summary>
          <BookingSummary
            result={result}
            activeStayDiscount={activeStayDiscount}
            prepayment={prepayment}
            prepaymentRate={prepaymentRate}
            convertedDeposit={convertedDeposit}
            priceReady={summaryPriceReady}
            depositReady={depositReady}
            deposit={deposit}
            /* 🛡️ HAVUZ ISITMA — yerleşim turu. Satır artık SUMMARY'nin
               içinde (Kısa Süreli Konaklama Ücreti altında); değerler
               AYNEN engine'den (poolHeatingSelected/setPoolHeatingSelected/
               poolHeatingTotal — YENİ hesaplama YOK, yalnız konum değişti). */
            poolHeatingFee={pool_heating_fee}
            poolHeatingCurrency={pool_heating_currency}
            poolHeatingSelected={poolHeatingSelected}
            onPoolHeatingChange={setPoolHeatingSelected}
            poolHeatingTotal={poolHeatingTotal}
            poolHeatingActiveForRange={poolHeatingActiveForRange}
            locale={locale}
          />
        </div>
      )}

      {/* 🛡️ INLINE RESERVATION ERROR — alert() yerine modern banner
          (koşul AYNEN). */}
      {reservationError && (
        <div
          role="alert"
          className="
            rounded-xl border border-red-200 bg-red-50
            px-3 py-2 text-[12.5px] text-red-700
            flex items-center gap-2
          "
        >
          <span aria-hidden>⚠️</span>
          <span className="flex-1">{reservationError}</span>
        </div>
      )}

      {/* CTA — FAZ 26B: minimum stay invalid → disabled (koşul AYNEN).
          onClick/disabled/handler DEĞİŞMEDİ; yalnız görünüm yenilendi:
          lacivert zemin + beyaz yazı + altın ok detayı. Başlangıç
          aralığı doğrulanırken (availabilityPending) yükleniyor durumu. */}
      <div className="space-y-3">
        {!hideReservationCta && (
          <button
            type="button"
            data-booking-cta
            onClick={handleReservation}
            disabled={ctaDisabled}
            aria-busy={availabilityPending || undefined}
            className="
              group relative flex w-full items-center justify-center gap-3
              h-14 rounded-full px-6
              text-[15px] font-semibold tracking-[0.01em]
              bg-ink text-white
              shadow-[0_18px_36px_-16px_rgba(27,46,94,0.65)]
              transition-[background-color,box-shadow,transform] duration-200
              hover:bg-[#22397a] hover:shadow-[0_22px_44px_-16px_rgba(27,46,94,0.7)] hover:-translate-y-0.5
              active:translate-y-0
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:bg-[var(--color-stone-200)] disabled:text-[var(--color-stone-500)]
              disabled:shadow-none disabled:hover:translate-y-0
              motion-reduce:transition-none motion-reduce:hover:translate-y-0
            "
          >
            {availabilityPending ? (
              <Loader2 size={18} aria-hidden className="animate-spin text-brand motion-reduce:animate-none" />
            ) : null}
            <span>{dict.booking.bookNow}</span>
            {!availabilityPending && (
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-ink transition-transform duration-200 group-hover:translate-x-0.5 group-disabled:bg-[var(--color-stone-300)] group-disabled:text-white group-disabled:translate-x-0 motion-reduce:transition-none"
              >
                <ArrowRight size={15} strokeWidth={2.25} />
              </span>
            )}
          </button>
        )}

        <p className="text-[11px] text-[var(--color-stone-400)] text-center leading-relaxed">
          {dict.booking.feeAutoCalculated}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════
          🛡️ ÖDEME FIRSATI — "Öne Çıkan" alanının YERİNE geldi.
          ═══════════════════════════════════════════════════════
          Oran ARTIK DİNAMİK: mevcut `prepaymentRate` (useBookingEngine'den,
          BookingSummary'nin de kullandığı AYNI değer — villa override →
          global settings → engine'in kendi fallback'i; kanonik hesap
          BookingSidebar/engine içinde zaten var, burada YENİDEN
          hesaplanmadı/fetch edilmedi). Görünürlük guard'ı PrepaymentBadge
          ile AYNI kural: yalnız 0 < oran < 100 iken gösterilir (aksi halde
          "%0" / "%100 şimdi..." gibi anlamsız metin render edilmez).
          Bu, galerinin sol-üstündeki eski PrepaymentBadge overlay'inin
          YERİNE geçen TEK gösterim — aynı kampanya artık iki yerde
          render edilmiyor. Hesaplama/API/DB çağrısı hâlâ YOK; yalnız
          UI text/data-binding düzeltmesi. Konum: rezervasyon formunun
          EN ALTI (değişmedi). */}
      {prepaymentRate > 0 && prepaymentRate < 100 && (
        <div className="pt-1">
          <style>{`
            @media (prefers-reduced-motion: no-preference) {
              .pp-perk-shimmer { animation: pp-perk-sweep 7s ease-in-out infinite; }
            }
            @keyframes pp-perk-sweep {
              0% { background-position: 160% 0; }
              100% { background-position: -60% 0; }
            }
          `}</style>
          <div
            className="
              group relative overflow-hidden rounded-[22px]
              border border-[var(--color-stone-100)]
              bg-[#FFFAF1]
              px-5 py-5 md:px-6 md:py-5
              transition-transform duration-300 motion-reduce:transition-none
              hover:-translate-y-1 motion-reduce:hover:translate-y-0
            "
          >
            {/* İnce üst accent çizgisi — turuncu → mavi, çok yavaş shimmer */}
            <span
              aria-hidden="true"
              className="pp-perk-shimmer absolute inset-x-5 top-0 h-[2px] rounded-full opacity-60"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #C8973A, #C8973A, transparent)",
                backgroundSize: "220% 100%",
              }}
            />

            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-stone-400)]">
              {dict.booking.installmentEyebrow}
            </span>

            <div className="mt-2.5 flex items-center gap-4">
              <span
                className="
                  shrink-0 font-display text-[42px] md:text-[46px]
                  leading-none tracking-[-0.02em] text-brand-strong
                  animate-pulse [animation-duration:5s] motion-reduce:animate-none
                "
              >
                %{prepaymentRate}
              </span>
              <span
                aria-hidden="true"
                className="h-10 w-px shrink-0 bg-[var(--color-stone-100)]"
              />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-[var(--color-stone-900)] leading-snug">
                  {dict.booking.payNowPerk}
                </p>
                <p className="mt-0.5 text-[13.5px] text-[var(--color-stone-500)] leading-snug">
                  {dict.booking.payAtCheckinPerk}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ MÜSAİTLİK TAKVİMİ POPUP — dropdown'daki takvimin aynısı
          (aynı BookingCalendar + aynı engine). body'ye portal edilir. */}
      {openAvailabilityModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={availabilityTitleId}
            data-villa-availability-modal
            className="fade-in fixed inset-0 z-[1100] flex items-end sm:items-center justify-center sm:p-4"
          >
            <div
              aria-hidden="true"
              data-villa-availability-backdrop
              onClick={() => setOpenAvailabilityModal(false)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-[2px]"
            />
            <div
              className="
                relative w-full sm:max-w-[26rem] md:max-w-[46rem] lg:max-w-[66rem]
                max-h-[92dvh] overflow-y-auto overscroll-contain
                rounded-t-3xl sm:rounded-3xl bg-white
                shadow-[0_30px_80px_-30px_rgba(27,46,94,0.55)]
                px-5 pt-5 pb-6 md:px-6 md:pt-6
              "
            >
              <div className="flex items-start justify-between gap-4">
                <h2
                  id={availabilityTitleId}
                  className="font-display text-[21px] md:text-[23px] leading-tight tracking-[-0.02em] text-[var(--color-stone-900)]"
                >
                  {dict.villaHero.availabilityCalendar}
                </h2>
                <button
                  ref={availabilityCloseRef}
                  type="button"
                  onClick={() => setOpenAvailabilityModal(false)}
                  aria-label={dict.common.close}
                  className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-stone-500)] hover:bg-[var(--color-stone-50)] hover:text-[var(--color-stone-900)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                >
                  <X size={18} strokeWidth={1.8} aria-hidden />
                </button>
              </div>

              {/* Formdaki seçili tarihler — aynı state, yalnız gösterim. */}
              <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[var(--color-stone-100)] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-[var(--color-stone-400)]">
                    {dict.booking.checkInPillLabel}
                  </div>
                  <div className="mt-1 text-[14px] font-medium text-[var(--color-stone-900)] truncate">
                    {startDate
                      ? formatDatePillLabel(startDate, bcp47)
                      : dict.booking.selectDatePlaceholder}
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className="w-px h-8 bg-[var(--color-stone-100)] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] tracking-[0.18em] uppercase font-semibold text-[var(--color-stone-400)]">
                    {dict.booking.checkOutPillLabel}
                  </div>
                  <div className="mt-1 text-[14px] font-medium text-[var(--color-stone-900)] truncate">
                    {endDate
                      ? formatDatePillLabel(endDate, bcp47)
                      : dict.booking.selectDatePlaceholder}
                  </div>
                </div>
              </div>

              {/* Dar ekranda olası taşmada ilk ay kırpılmasın: güvenli
                  ortalama (yalnız bu popup'ın sarmalayıcısında). */}
              <div className="mt-4 min-h-[22rem] overflow-x-auto [&_.rdp_.rdp-months]:![justify-content:safe_center]">
                {BookingCalendar && (
                  <AvailabilityPopupCalendar
                    Calendar={BookingCalendar}
                    engine={engine}
                    currentMonth={currentMonth}
                    onCurrentMonthChange={setCurrentMonth}
                    onSelectComplete={() => setOpenAvailabilityModal(false)}
                    locale={locale}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
/* ── Helpers ── */

/* 🛡️ Müsaitlik popup'ı — MEVCUT BookingCalendar'ı ekran genişliğine
   göre 1/2/3 ay yan yana gösterir (eski sayfa takvimiyle aynı düzen:
   mobil 1, tablet 2, geniş ekran 3). Yalnız görünüm; seçim, müsaitlik
   ve fiyat mantığı aynı `engine` üzerinden AYNEN çalışır. Dinleyiciler
   yalnız popup açıkken (bu bileşen mount'luyken) yaşar. */
const POPUP_TWO_MONTHS_QUERY = "(min-width: 768px)";
const POPUP_THREE_MONTHS_QUERY = "(min-width: 1024px)";

function AvailabilityPopupCalendar({
  Calendar,
  ...props
}: { Calendar: LazyCalendarComponentType } & Omit<
  React.ComponentProps<LazyCalendarComponentType>,
  "numberOfMonths"
>) {
  const [months, setMonths] = useState(1);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const two = window.matchMedia(POPUP_TWO_MONTHS_QUERY);
    const three = window.matchMedia(POPUP_THREE_MONTHS_QUERY);
    const update = () => setMonths(three.matches ? 3 : two.matches ? 2 : 1);
    update();
    two.addEventListener("change", update);
    three.addEventListener("change", update);
    return () => {
      two.removeEventListener("change", update);
      three.removeEventListener("change", update);
    };
  }, []);
  return <Calendar {...props} numberOfMonths={months} />;
}

function Counter({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium text-[var(--color-stone-700)]">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 rounded-full border border-[var(--color-stone-200)] flex items-center justify-center text-[var(--color-stone-700)] hover:border-brand/60 hover:text-brand transition disabled:opacity-30"
          disabled={value <= min}
        >
          −
        </button>
        <span className="w-6 text-center font-medium text-[var(--color-stone-900)]">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full border border-[var(--color-stone-200)] flex items-center justify-center text-[var(--color-stone-700)] hover:border-brand/60 hover:text-brand transition"
        >
          +
        </button>
      </div>
    </div>
  );
}
