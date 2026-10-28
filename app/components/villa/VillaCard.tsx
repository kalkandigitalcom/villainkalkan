"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MapPin,
  BedDouble,
  Bath,
  Users,
  ArrowUpRight,
  Star,
  CalendarRange,
  Sparkles,
} from "lucide-react";

import { convertPrice, formatCurrency } from "@/lib/currency";
import { useCurrency } from "@/app/context/CurrencyContext";
import {
  calculateNights,
  calculateGrandTotal,
  /* 🛡️ SALT-OKUNUR KARŞILAŞTIRMA — "indirim uygulanmasaydı toplam ne
     olurdu" sorusunun cevabı için motorun ZATEN export ettiği pure
     fonksiyon. Villa detaydaki `useBookingEngine` (satır ~797) ile
     BİREBİR AYNI desen; yeni formül/motor YOK. */
  calculateStayTotal,
  type DiscountRange,
} from "@/lib/price.engine";
import { parseLocalDate } from "@/lib/date-format";
/* 🛡️ Seçilen tarih aralığı etiketi — Hero/arama panelinin KULLANDIĞI
   pure helper'ın AYNISI ("8 Eki – 11 Eki"). Yeni tarih formatlama
   sistemi YAZILMADI; locale etiketi (LOCALE_BCP47) helper içinde. */
import { buildHeroDateLabel } from "@/app/components/ui/hero/_helpers/date-label";
/* 🛡️ PHASE 10G — locale-aware kart metinleri + locale-prefixed detay
   linki. `locale` OPSİYONEL, default "tr" → TR çıktısı (metin + href)
   BİREBİR AYNI. Fiyat/indirim/availability mantığı DEĞİŞMEDİ. */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { buildLocaleAlternates } from "@/lib/i18n/seo-alternates";
import type { Locale } from "@/lib/i18n/config";
/* 🛡️ FAZ 36 — Guest favorites button. localStorage-only;
   no DB / no API / no server action / no auth. */
import FavoriteButton from "@/app/components/favorites/FavoriteButton";
import { computeDiscountCardPricing } from "./discount-card-pricing";
/* Tip-only import → bundle'a modal kodunu SOKMAZ (7C lazy yükleme). */
import type BookingModalComponent from "./VillaCardBookingModal";

/* ===============================================================
   🛡️ VillaCardBookingModal — LAZY import (Aşama 7C: GERÇEK lazy)
   ===============================================================
   Önceki durum: `next/dynamic(ssr:false)` + modal `isOpen={false}` ile
   HER kartta render ediliyordu → modal chunk'ı (+ BookingCalendar,
   react-day-picker, date-fns, RDP CSS) hydration'dan hemen sonra,
   kullanıcı hiç tıklamadan indiriliyordu; SSR HTML'e de her kart için
   boş bir BAILOUT_TO_CLIENT_SIDE_RENDERING <template> yazılıyordu.

   Şimdi: modal modülü yalnız açılış niyetinde (fare üstüne gelme /
   basma / klavye odağı / tıklama) `import()` ile yüklenir ve modal
   YALNIZ `isBookingOpen && modül hazır` iken mount edilir. Suspense/
   next/dynamic kullanılmaz → React'in Suspense yeniden-deneme
   gecikmesi (fallback throttle) yok; modül hazır olduğu an açılır.
   Modal kapalıyken zaten `null` döndürüyor ve her açılışta içeriğini
   sıfırdan kuruyordu (apiData reset + ModalContent yeniden mount) →
   kapanma/yeniden açılma davranışı AYNI kalır. Aynı useBookingEngine
   + child component'leri kullanır (BookingSidebar ile TEK
   source-of-truth).
   =============================================================== */
type LazyBookingModalType = typeof BookingModalComponent;
let bookingModalPromise: Promise<LazyBookingModalType> | null = null;
let loadedBookingModal: LazyBookingModalType | null = null;
function loadVillaCardBookingModal(): Promise<LazyBookingModalType> {
  if (!bookingModalPromise) {
    bookingModalPromise = import("./VillaCardBookingModal").then(
      (mod) => {
        loadedBookingModal = mod.default;
        return mod.default;
      },
      (err: unknown) => {
        /* Hata → promise sıfırlanır; sonraki niyet/tıklama yeniden dener. */
        bookingModalPromise = null;
        throw err;
      }
    );
  }
  return bookingModalPromise;
}
function preloadVillaCardBookingModal() {
  loadVillaCardBookingModal().catch(() => {
    /* Önyükleme başarısızsa sessiz geç; tıklama yeniden dener. */
  });
}

type StayPrice = {
  price: number;
  currency: string;
  start_date: string;
  end_date: string;
};

type Props = {
  /* 🛡️ FAZ 36 — villa.id (favorites identity).
     Eski caller'lar `id` geçmezse favorite buton render edilmez
     (defansif). Yeni caller'lar id'yi VillaDTO'dan geçer. */
  id?: string;
  slug: string;
  title: string;
  location: string;
  price?: number;
  currency?: string;
  images?: string[];
  bedrooms?: number;
  bathrooms?: number;
  guests?: number;
  /* 🛡️ DATE-SCOPED STAY PRICING — opsiyonel.
     Kullanıcı /arama'ya start+end ile geldiyse caller bu üçlüyü
     birlikte geçer; VillaCard mevcut pricing engine
     (lib/price.engine > calculateGrandTotal) ile aynı semantic'te
     toplam fiyat üretir (stay + cleaning_fee).
     VillaDetail/BookingSidebar/reservation create ile byte-identical
     hesap. Tarih yoksa eski "gecelik" davranış aynen devam eder. */
  stayStart?: string;
  stayEnd?: string;
  prices?: StayPrice[];
  /* 🛡️ OPSİYONEL — seçilen tarih aralığındaki aktif indirimler
     (villa_discounts). `prices` ile BİRLİKTE geçilir; AŞAĞIDAKİ
     MEVCUT `calculateGrandTotal` çağrısının ZATEN var olan opsiyonel
     `discounts` parametresine olduğu gibi iletilir — fiyat motoru,
     indirim mantığı ve currency/tarih hesabı DEĞİŞMEDİ. Verilmezse
     (undefined) motorun `discounts = null` default'u devreye girer →
     bu prop'u geçmeyen TÜM mevcut çağrı yerlerinde davranış BİREBİR
     aynı kalır. `discount` (tekil) prop'u ile KARIŞTIRILMAMALI: o
     yalnız "discount" variant'ının gecelik gösterimi içindir. */
  stayDiscounts?: DiscountRange[];
  /** Temizlik ücreti (orijinal currency). calculateGrandTotal kendi
   *  cleaning_limit kuralını uygular (nights >= limit ise muaf). */
  cleaningFee?: number;
  cleaningCurrency?: string;
  cleaningLimit?: number;
  /* 🛡️ FAZ 35 — REVIEW TRUST META (Airbnb / boutique hotel feel).
     Caller approved-only stats geçer; villa başına 1 tek meta satır.
     Eski caller'lar undefined geçerse hiçbir şey render edilmez —
     conditional, eski layout AYNEN korunur, layout shift YOK.
       reviewAverage: 1..5 (1 ondalık)
       reviewCount  : tamsayı; 0 ise hiç render etme (fake 5.0 yok). */
  reviewAverage?: number;
  reviewCount?: number;
  /* 🛡️ DISPLAY VARIANT — caller surface'ine göre layout density.
     "default" (eski + public davranış): editorial büyük kart,
       FavoriteButton + booking trigger + zengin tipografi.
     "curation" (admin Villa Listesi): compact taranabilir kart,
       FavoriteButton + booking trigger HIDE, küçük spacing/tipografi,
       daha sıkı image aspect. Logic (pricing/data/image selection)
       AYNEN — sadece presentation katmanı koşullu. */
  variant?: "default" | "curation" | "discount";
  /* 🛡️ OPSİYONEL — "Müsaitlik / Tarih Seç" butonunun HEMEN ALTINA gap
     bilgi alanı (açık yeşil) + tam genişlik "Hemen Rezervasyon Yap" CTA
     için VERİ. Verilmezse HİÇBİR ŞEY render edilmez → /arama, homepage ve
     diğer VillaCard kullanımları AYNEN korunur. CTA bir <button>'dır
     (kart Link'i içinde nested <a> olmaması için) → onClick router.push +
     stopPropagation (kartın detay navigasyonu tetiklenmez). */
  reserveInfo?: { label: string; nights: number; href: string };
  /** 🛡️ ADDITIVE — /arama "esnek" EK sonuç işareti. true ise fiyat
   *  GÖSTERİLMEZ (villa ana tarihte müsait değil); yerine "Esnek Tarih
   *  Fırsatı · ±3 gün içinde müsait" premium etiketi. Ana tarih/fiyat/
   *  href akışı DEĞİŞMEZ (yalnız bu kartın fiyat sunumu). Default false
   *  → mevcut kartlar birebir aynı. Yalnız default (public) variant. */
  isFlexible?: boolean;
  /** 🛡️ ADDITIVE — PASİF villa özel linki (/v/[token], locale önekli).
   *  Verilirse kart detay linki `/kiralik-villa/<slug>` YERİNE bu adres
   *  olur (tarih varsa start/end aynen eklenir) ve müsaitlik butonu
   *  rezervasyon modalını açmak yerine bu adrese gider (özel sayfa
   *  rezervasyon akışı sunmaz). Verilmezse davranış BİREBİR eskisi gibi.
   *  Tüketici: /liste/[token] (SharedListPageBody). */
  privateHref?: string;
  /* 🛡️ AKTİF İNDİRİM (yalnız "discount" variant tüketir) — ham
     villa_discounts kaydı (lib/cache.helpers > getCachedDiscountCollectionVillas
     tarafından price.engine > getActiveDiscount ile ÖNCEDEN seçilmiş,
     "bugün start_date..end_date arasında" tek kayıt). Nihai indirimli
     fiyat (currency-aware) burada, client tarafında (useCurrency rates
     ile) price.engine > applyDiscountToDailyPrice reuse edilerek
     hesaplanır — yeni bir fiyat hesaplama mantığı YOK. Verilmezse
     (undefined/null) davranış ESKİSİYLE aynı (indirim gösterimi yok). */
  discount?: {
    start_date: string;
    end_date: string;
    discount_type: "percent" | "fixed";
    discount_value: number;
    currency: string | null;
  } | null;
  /* 🛡️ İndirim penceresinin TAMAMI müsait mi? (server-side hesaplanır:
     lib/cache.helpers > getCachedDiscountCollectionVillas → toplu
     get_blocked_villa_ids RPC). YALNIZ "Hemen Rezervasyon Yap" CTA'sının
     HEDEF URL'ini etkiler; fiyat/indirim/tasarım/diğer variant'lar
     ETKİLENMEZ. `undefined` (prop verilmemiş) → kontrol uygulanmamış →
     MEVCUT davranış (geriye dönük uyumlu). */
  discountAvailable?: boolean;
  /** 🛡️ PHASE 10G — opsiyonel; verilmezse "tr" (eski davranış).
   *  Kart metinlerini ve detay linkinin locale prefix'ini belirler. */
  locale?: Locale;
  /** 🛡️ OPSİYONEL — yalnız "default" variant kart görselinin `sizes`
   *  değeri. Verilmezse mevcut değer AYNEN kullanılır → prop geçmeyen
   *  tüm çağrı noktaları (arama, ana sayfa, favoriler, …) birebir aynı.
   *  Görsel kaynağı/kalite/boyut/CSS'e etkisi YOK; yalnız tarayıcının
   *  srcset'ten seçeceği genişliği belirler. */
  sizes?: string;
  /** 🛡️ OPSİYONEL — liste sayfalarında yalnız İLK kart (olası LCP
   *  görseli) için. true → görsel `loading="eager"` + `fetchPriority="high"`
   *  (Next 16'da deprecated `priority` yerine önerilen yöntem). Verilmezse
   *  mevcut `loading="lazy"` AYNEN. Görsel kaynağı / sizes / srcSet /
   *  kalite / CSS'e etkisi YOK; yalnız yükleme zamanı ve önceliği. */
  isLcp?: boolean;
};

export default function VillaCard({
  id,
  slug,
  title,
  location,
  price,
  currency: villaCurrency = "TRY",
  images = [],
  bedrooms = 1,
  bathrooms = 1,
  guests = 2,
  stayStart,
  stayEnd,
  prices,
  stayDiscounts,
  cleaningFee,
  cleaningCurrency,
  cleaningLimit,
  reviewAverage,
  reviewCount,
  variant = "default",
  reserveInfo,
  isFlexible = false,
  privateHref,
  discount = null,
  discountAvailable,
  locale,
  sizes: imageSizes,
  isLcp = false,
}: Props) {
  const dict = getDictionary(locale);
  const effectiveLocale: Locale = locale ?? "tr";
  const router = useRouter();
  /* Compact variant flag — curation flow için presentation density.
     Logic (price/state/handlers/modal) hiç dokunulmaz. */
  const isCuration = variant === "curation";
  /* 🛡️ Discount variant — default editorial layout + İndirimli badge +
     soft coral/turquoise accent. Logic (pricing/data/handlers) AYNEN. */
  const isDiscount = variant === "discount";
  /* Cover image: ilk geçerli URL'i seç.
     eski sağlayıcıdan null/empty değerler gelebileceği için filter. */
  const cover = (images || []).find(
    (u): u is string => typeof u === "string" && u.trim().length > 0
  );

  /* Broken URL fallback: <img onError> tetiklenirse premium
     "Görsel yakında" state'ine geç. (onLoad opacity oyununa girmiyoruz
     — gradient bg zaten skeleton görevi görüyor, hydration-safe.) */
  const [imgFailed, setImgFailed] = useState(false);

  /* 🛡️ Booking modal — lazy mount. isBookingOpen=false iken
     VillaCardBookingModal HİÇ mount edilmez (Aşama 7C) ve modülü
     indirilmez; bu yüzden fetch/engine de çalışmaz. */
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  /* 🛡️ Aşama 7C — lazy yüklenen modal bileşeni (null → henüz hazır
     değil). Tıklamada `isBookingOpen` HEMEN true olur (niyet kaybolmaz);
     bileşen hazır olduğu an modal açılır. Bu sayfada modül daha önce
     yüklendiyse (başka kart) anında hazırdır. */
  const [VillaCardBookingModal, setVillaCardBookingModal] =
    useState<LazyBookingModalType | null>(() => loadedBookingModal);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const ensureBookingModal = () => {
    if (VillaCardBookingModal) return;
    if (loadedBookingModal) {
      setVillaCardBookingModal(() => loadedBookingModal);
      return;
    }
    loadVillaCardBookingModal()
      .then((Modal) => {
        /* Unmount sonrası state güncellemesi YAPILMAZ. */
        if (isMountedRef.current) setVillaCardBookingModal(() => Modal);
      })
      .catch(() => {
        /* Yüklenemezse modal açılmaz; sonraki tıklama yeniden dener. */
      });
  };

  const { currency, rates } = useCurrency();

  const convertedPrice = convertPrice(
    Number(price || 0),
    villaCurrency,
    currency,
    rates
  );

  /* 🛡️ AKTİF İNDİRİM — yalnız "discount" variant'ta anlamlı; diğer
     variant'lar `discount` prop'unu hiç almaz (undefined) → bu blok
     no-op. Hesaplama TAMAMEN mevcut price.engine > applyDiscountToDailyPrice
     ile yapılır — yeni bir fiyat mantığı YAZILMADI.

     🔄 KÖK NEDEN DÜZELTMESİ (bu tur): Burada ÖNCEDEN, fixed tipte
     `discount.currency !== villaCurrency` ise indirim SESSİZCE iptal
     ediliyordu (kart yalnız düz fiyatı gösteriyordu — ekranda "₺5.000"
     görünüp üstü çizili eski fiyat/tarih aralığı HİÇ çıkmıyordu). Bu
     kontrol `discount-day-map.ts`'teki (admin fiyat takvimi önizlemesi)
     AYNI deseni kopyalamıştı, ANCAK oradaki gerekçe BURADA geçerli
     DEĞİL: discount-day-map.ts kasıtlı olarak `rates={}` (boş kur)
     ile çağırıyor, çünkü yanlış 1:1 dönüşüm üretmesin diye uyuşmayan
     günleri SESSİZCE atlıyor. Bu kartta ise `useCurrency()`'den GERÇEK
     `rates` zaten mevcut — `applyDiscountToDailyPrice` (DEĞİŞTİRİLMEDİ)
     zaten `discount.currency !== daily.original_currency` durumunda
     `convertPrice` ile DOĞRU dönüşümü kendisi yapıyor (bkz. public
     rezervasyon server-authoritative price-verify.ts'in AYNI senaryoyu
     — dövizli villa + farklı currency'de fixed özel fiyat — zaten
     doğru şekilde çözdüğü test edilmiş akış). Bu yüzden ön-kontrol
     kaldırıldı; currency uyuşmazlığı olsa bile indirim artık DOĞRU
     şekilde (gerekirse dönüştürülerek) gösterilir — yeni bir dönüşüm
     mantığı YAZILMADI, yalnızca gereksiz/hatalı bir erken-iptal kaldırıldı. */
  /* 🛡️ İNDİRİM KARTI MODELİ — hesaplama gövdesi BİREBİR
     `./discount-card-pricing.ts` dosyasına taşındı (ana sayfanın yeni
     indirim kartı tasarımları da AYNI fonksiyonu kullanır → tek kaynak).
     Girdiler ve çıktılar ÖNCEKİ yerel değişkenlerle aynı adları taşır. */
  const isDiscountVariant = variant === "discount";
  const {
    discountedPrice,
    discountDateRangeLabel,
    showDiscountPricing,
    discountBadgePercent,
    nightlySavingsLabel,
    discountReserveHref,
  } = computeDiscountCardPricing({
    isDiscountVariant,
    slug,
    price,
    villaCurrency,
    convertedPrice,
    currency,
    rates,
    discount,
    discountAvailable,
    privateHref,
    dict,
    effectiveLocale,
  });

  /* 🛡️ GRAND TOTAL — mevcut price.engine reuse (calculateGrandTotal).
     Aktif olması için: stayStart + stayEnd + prices[] üçlüsü
     birlikte verilmeli ve nights > 0 olmalı.

     calculateGrandTotal:
       - stay     = günlük fiyatlar toplamı (user currency)
       - cleaning = calculateCleaningFee(nights, fee, limit)
                    convertPrice ile user currency'sine çevrilmiş
       - total    = stay + cleaning
     Yani temizlik ücreti AYNI semantic ile (cleaning_limit muafiyeti
     dahil) hesaba dahil. VillaDetail/BookingSidebar/reservation
     create ile byte-identical. cleaning_fee=0 ise total = stay
     (eski davranışla aynı sonuç). */
  let stayNights = 0;
  let stayTotal: number | null = null;
  let hasCleaning = false;
  /* Temizlik payı — `hasCleaning`'in geldiği AYNI `result.cleaning`
     değeri; indirimsiz toplamı kurarken tekrar hesaplanmasın diye
     sayı olarak da saklanır (yeni hesap YOK). */
  let stayCleaning = 0;
  if (stayStart && stayEnd && Array.isArray(prices) && prices.length > 0) {
    stayNights = calculateNights(stayStart, stayEnd);
    if (stayNights > 0) {
      const result = calculateGrandTotal({
        start: stayStart,
        end: stayEnd,
        prices,
        currency,
        rates,
        cleaning_fee: Number(cleaningFee || 0),
        cleaning_currency: cleaningCurrency || "TRY",
        cleaning_limit: Number(cleaningLimit || 0),
        /* 🛡️ TEK EKLENEN SATIR — motorun ZATEN var olan opsiyonel
           parametresi. undefined ise motor `null` default'una düşer
           (eski davranış birebir). */
        discounts: stayDiscounts,
      });
      if (result.total > 0) {
        stayTotal = result.total;
        hasCleaning = result.cleaning > 0;
        stayCleaning = result.cleaning;
      }
    }
  }

  /* ===============================================================
     🛡️ İNDİRİMSİZ TOPLAM — YALNIZ GÖRSEL KARŞILAŞTIRMA (UI-only)
     ===============================================================
     Yukarıdaki `calculateGrandTotal` çağrısı ve dönen `stayTotal`
     HİÇ DEĞİŞMEDİ — gösterilen/ödenecek tutar AYNEN o hesaptan gelir.
     Burada yalnız "indirim olmasaydı ne olurdu" karşılaştırması için
     AYRI, salt-okunur bir çağrı yapılır: motorun ZATEN export ettiği
     `calculateStayTotal`, AYNI start/end/prices/currency/rates — tek
     fark son parametrenin `null` olması (indirim yokmuş gibi).
     Villa detay sayfasındaki `useBookingEngine` deseninin BİREBİR
     aynısı; yeni indirim FORMÜLÜ YAZILMADI.

     • Yalnız tarih seçili (stayTotal !== null) VE karta indirim verisi
       geçilmişse çalışır → indirimsiz kartlarda EK MALİYET SIFIR.
     • Temizlik her iki tarafta da aynı olduğu için mevcut
       `stayCleaning` iki toplama da eklenir.
     • 0.01 epsilon: kur yuvarlamasından doğan mikro farkı "sahte
       indirim" olarak göstermemek için (detay sayfasıyla aynı eşik).
     • `uncoveredNights > 0` → karşılaştırma güvenilmez, gösterilmez.
     =============================================================== */
  let stayTotalBeforeDiscount: number | null = null;
  if (
    stayTotal !== null &&
    Array.isArray(stayDiscounts) &&
    stayDiscounts.length > 0 &&
    stayStart &&
    stayEnd
  ) {
    const undiscountedStay = calculateStayTotal(
      stayStart,
      stayEnd,
      prices || [],
      currency,
      rates,
      null
    );
    const candidate = undiscountedStay.stay + stayCleaning;
    if (undiscountedStay.uncoveredNights === 0 && candidate - stayTotal > 0.01) {
      stayTotalBeforeDiscount = candidate;
    }
  }

  /* 🛡️ SEÇİLEN TARİHLER — yalnız tarih seçiliyken (stayTotal !== null)
     fiyatın ÜSTÜNDE gösterilir. Tarih matematiği/parse mevcut
     `parseLocalDate` + `buildHeroDateLabel` ile; YENİ format YOK. */
  const stayDateLabel =
    stayTotal !== null && stayStart && stayEnd
      ? buildHeroDateLabel(
          parseLocalDate(stayStart),
          parseLocalDate(stayEnd),
          effectiveLocale
        )
      : null;

  /* 🛡️ İNDİRİM TUTARI — ZATEN hesaplanmış iki değerin FARKI
     (indirimsiz toplam − indirimli toplam). Yeni indirim algoritması,
     yeni motor çağrısı, yeni yuvarlama/epsilon YOK: gösterim koşulu
     `stayTotalBeforeDiscount`in kendi 0.01 eşiğidir (yukarıda). */
  const stayDiscountSavings =
    stayTotalBeforeDiscount !== null && stayTotal !== null
      ? stayTotalBeforeDiscount - stayTotal
      : null;

  const showImage = !!cover && !imgFailed;
  const initial = (title?.trim()?.[0] || "·").toUpperCase();

  /* 🛡️ DATE CONTINUITY — /arama → detail geçişinde URL'de gelen
     start/end paramlarını detail href'ine append et. BookingSidebar
     URL'den initial state'i hydrate eder; refresh-safe. Tarih yoksa
     href eski formatta kalır (`/kiralik-villa/<slug>`). */
  /* 🛡️ PHASE 10G — locale prefix'i `buildLocaleAlternates` (Phase 7B,
     saf helper) üretir; "tr" için sonuç `/kiralik-villa/<slug>` —
     ESKİ DEĞERLE BİREBİR AYNI. Query-string mantığı DEĞİŞMEDİ. */
  let detailHref = privateHref
    ? privateHref
    : buildLocaleAlternates(`/kiralik-villa/${slug}`, effectiveLocale)
        .canonical;
  if (stayStart && stayEnd) {
    const qs = new URLSearchParams();
    qs.set("start", stayStart);
    qs.set("end", stayEnd);
    detailHref = `${detailHref}?${qs.toString()}`;
  }

  /* 🛡️ Müsaitlik / tarih seçimi modalı — ESKİ CTA handler'ının AYNISI
     (takvim ikonu ve altın "Rezervasyon" butonu bunu çağırır). Kart
     Link'i içinde olduğu için preventDefault/stopPropagation; pasif
     villa (privateHref) → modal yok, özel sayfaya gider. */
  const openAvailability = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (privateHref) {
      router.push(detailHref);
      return;
    }
    setIsBookingOpen(true);
    ensureBookingModal();
  };

  return (
    <>
    <CardOuter isCuration={isCuration} href={detailHref}>
      {/* ════════════════════════════════════════════════════
          🛡️ KART YAPISI — Variant dispatch
          ════════════════════════════════════════════════════
          Default variant (public list): yeni kompakt yapı —
            image aspect-[16/10] + alt content area + tek satır
            amenities. Kart yüksekliği ~%40 azaldı.
          Curation variant (admin curator): mevcut "image-dominant
            + amenity mini-cards" yapısı AYNEN korundu.
          State/props/handlers ve booking modal AYNI; sadece
          render path'i farklılaşır. ───────────────────────── */}
      {isCuration ? (
      <article
        className={
          "relative overflow-hidden bg-white " +
          /* Curation: static shadow, hover lift YOK — "selection
             workspace" UX'i. Image hover scale yine fire eder
             (image bloğunun kendi group-hover'ı). */
          "rounded-[20px] shadow-[0_8px_20px_-14px_rgba(27,26,23,0.18)] " +
          "transition-shadow duration-300 motion-reduce:transition-none"
        }
      >
        {/* ── IMAGE BLOCK with overlay content ────────────── */}
        <div
          className={
            "relative overflow-hidden " +
            "bg-gradient-to-br from-[var(--color-sand-100)] via-[var(--color-sand-50)] to-[var(--color-sand-100)] " +
            (isCuration ? "aspect-[4/5]" : "aspect-[5/6]")
          }
        >
          {showImage ? (
            <>
              {/* 🛡️ SCALE HARDENING — next/Image (responsive + lazy +
                 WebP/AVIF auto). Eski `<img>` davranışı korunur:
                   - aspect-locked parent → CLS=0 (Image fill mode)
                   - object-cover, object-center, group-hover scale aynen
                   - onError → setImgFailed (premium fallback'e geç)
                   - lazy default (above-the-fold yalnız bir kart varsa
                     parent caller priority verir; bu turda priority YOK).
                 SIZES:
                   - Mobile (default ≤640px): 100vw (tek kolon)
                   - sm (≥640): 50vw (2 col)
                   - xl (≥1280): 33vw (3 col)
                 max-w ~1280px / 3 col ≈ 420px image gen; R2 storage
                 + Next image optimizer (cdn-image) bunları auto. */}
              <Image
                src={cover}
                alt={title || dict.card.villaAlt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                loading="lazy"
                onError={() => setImgFailed(true)}
                className="
                  object-cover object-center
                  transition-transform duration-[1200ms] ease-out
                  group-hover:scale-[1.04]
                  motion-reduce:transition-none motion-reduce:group-hover:scale-100
                "
              />
            </>
          ) : (
            /* PREMIUM FALLBACK — large serif initial */
            <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
              <div className="font-display text-[88px] md:text-[104px] leading-none text-[var(--color-stone-300)] tracking-[-0.03em]">
                {initial}
              </div>
              <p className="mt-3 text-[10px] tracking-[0.28em] uppercase font-medium text-[var(--color-stone-400)]">
                {dict.card.imageComing}
              </p>
            </div>
          )}

          {/* Bottom editorial scrim — text readability */}
          <div
            aria-hidden="true"
            className="
              absolute inset-x-0 bottom-0 h-[65%]
              bg-gradient-to-t from-black/78 via-black/42 to-transparent
              pointer-events-none
            "
          />
          {/* Hover scrim deepen — subtle */}
          <div
            aria-hidden="true"
            className="
              absolute inset-x-0 bottom-0 h-[65%]
              bg-gradient-to-t from-black/14 to-transparent
              pointer-events-none
              opacity-0 group-hover:opacity-100
              transition-opacity duration-500 motion-reduce:transition-none
            "
          />
          {/* Top vignette — badge legibility */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/[0.18] via-black/[0.04] to-transparent pointer-events-none"
          />
          {/* Inner premium ring stroke */}
          <div
            aria-hidden="true"
            className="absolute inset-0 ring-1 ring-inset ring-white/15 pointer-events-none"
          />

          {/* FAV BUTTON — top-right (FAZ 36 white glass).
              🛡️ Curation variant: admin curator listesinde favori
              gereksiz → render edilmez. */}
          {id && !isCuration && (
            <FavoriteButton villaId={id} variant="card" alwaysVisible />
          )}

          {/* ════════════════════════════════════════════════
              OVERLAY CONTENT (bottom editorial)
              location → title → review → price + arrow
              ════════════════════════════════════════════════ */}
          <div
            className={
              "absolute inset-x-0 bottom-0 z-10 " +
              (isCuration ? "p-4" : "p-5 md:p-6")
            }
          >
            {/* LOCATION */}
            <p className="flex items-center gap-1.5 text-[10.5px] tracking-[0.18em] uppercase font-medium text-white/75 min-w-0 truncate">
              <MapPin
                size={11}
                className="text-white/70 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="truncate">{location || dict.card.noLocation}</span>
            </p>

            {/* TITLE — editorial white serif */}
            <h3
              className={
                "font-display text-white " +
                (isCuration
                  ? "text-[17px] md:text-[18px] mt-2 "
                  : "text-[22px] md:text-[26px] mt-2.5 ") +
                "leading-[1.08] tracking-[-0.022em] line-clamp-2 " +
                "group-hover:text-white/95 " +
                "transition-colors motion-reduce:transition-none " +
                "drop-shadow-[0_1px_2px_rgba(0,0,0,0.30)]"
              }
            >
              {title}
            </h3>

            {/* REVIEW META — amber star + compact */}
            {typeof reviewCount === "number" && reviewCount > 0 &&
              typeof reviewAverage === "number" && reviewAverage > 0 && (
                <div
                  className="flex items-center gap-1.5 mt-2 text-[12px] text-white/85"
                  aria-label={formatDictionaryString(
                    dict.card.ratingAriaLabel,
                    {
                      value: reviewAverage.toFixed(1),
                      count: reviewCount,
                    }
                  )}
                >
                  <Star
                    size={11}
                    className="text-brand shrink-0"
                    fill="currentColor"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span className="font-display text-[13px] text-white tracking-[-0.01em] tabular-nums leading-none">
                    {reviewAverage.toFixed(1)}
                  </span>
                  <span aria-hidden="true" className="text-white/40">·</span>
                  <span className="text-white/70 tabular-nums">
                    {formatDictionaryString(dict.card.reviewCount, {
                      n: reviewCount,
                    })}
                  </span>
                </div>
              )}

            {/* PRICE LINE + glass arrow CTA.
                stayTotal branch: 2 satır editorial layout
                  Üst: TOPLAM eyebrow + büyük fiyat
                  Alt: "N gece · Temizlik dahil" meta
                Tek satır truncate (kırpılma) sorunu kapanır; kullanıcı
                breakdown'u net görür. Gecelik branch tek satır eski
                davranış. calculateGrandTotal/hasCleaning/stayNights
                değerleri aynen reuse — yeni hesap YOK. */}
            <div
              className={
                "flex items-center justify-between gap-3 " +
                (isCuration ? "mt-2.5" : "mt-3.5 md:mt-4")
              }
            >
              <div className="flex flex-col min-w-0">
                {stayTotal !== null ? (
                  <>
                    {/* Üst satır: eyebrow + büyük fiyat */}
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-[10.5px] tracking-[0.14em] uppercase font-medium text-white/65">
                        {dict.card.total}
                      </span>
                      <span
                        className={
                          "font-display text-white tracking-[-0.015em] tabular-nums " +
                          (isCuration ? "text-[17px]" : "text-[22px]")
                        }
                      >
                        {formatCurrency(stayTotal, currency, effectiveLocale)}
                      </span>
                    </div>
                    {/* Alt satır: meta — gece + temizlik dahil bilgisi */}
                    <p
                      className={
                        "text-white/70 leading-snug " +
                        (isCuration ? "text-[11px] mt-0.5" : "text-[12px] mt-1")
                      }
                    >
                      <span className="tabular-nums">
                        {formatDictionaryString(dict.card.nights, {
                          n: stayNights,
                        })}
                      </span>
                      {hasCleaning ? (
                        <>
                          <span
                            aria-hidden
                            className="text-white/40 mx-1.5"
                          >
                            ·
                          </span>
                          <span className="text-white/65">
                            {dict.card.cleaningIncluded}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col min-w-0">
                    <span
                      className={
                        "font-display text-white tracking-[-0.015em] tabular-nums " +
                        (isCuration ? "text-[17px]" : "text-[22px]")
                      }
                    >
                      {price
                        ? formatCurrency(convertedPrice, currency, effectiveLocale)
                        : dict.card.priceOnRequest}
                    </span>
                    {price ? (
                      <span
                        className={
                          "text-white/65 " +
                          (isCuration ? "text-[11px]" : "text-[12px]")
                        }
                      >
                        {dict.card.startingFromUpper}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
              {/* Glass arrow CTA */}
              <span
                aria-hidden="true"
                className={
                  "inline-flex items-center justify-center rounded-full shrink-0 " +
                  (isCuration ? "w-8 h-8 " : "w-9 h-9 ") +
                  "bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/30 text-white " +
                  "group-hover:bg-[var(--brand-coral)] group-hover:ring-[var(--brand-coral)] group-hover:text-ink " +
                  "transition-[background-color,color,box-shadow] duration-300 motion-reduce:transition-none"
                }
              >
                <ArrowUpRight size={isCuration ? 13 : 14} strokeWidth={1.75} />
              </span>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            🛡️ BOOKING TRIGGER — "Müsaitlik / Tarih Seç"
            ════════════════════════════════════════════════
            Card içinde tek booking entry point butonu. Tıklayınca:
              - e.preventDefault + stopPropagation → outer Link'in
                detail navigation'ı tetiklenmez
              - setIsBookingOpen(true) → lazy modal mount
            Modal kapalıyken VillaCardBookingModal HİÇ mount edilmez
            (next/dynamic ssr:false + erken-return).
            DOM konum: image bloğunun ALTINDA, amenity strip'in ÜSTÜNDE
            → mevcut layout'a dokunulmaz, sabit yükseklik. */}
        {/* 🛡️ Booking trigger — admin curation'da admin "müşterinin
            ne göreceğini" hızlıca önizleyebilsin diye CTA korunur,
            sadece sizing/spacing compact'lenir. */}
        <div
          className={
            "bg-white " + (isCuration ? "px-2 pt-2" : "px-3 pt-3")
          }
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              /* Pasif villa → rezervasyon modalı yok; özel sayfaya git. */
              if (privateHref) {
                router.push(detailHref);
                return;
              }
              setIsBookingOpen(true);
              ensureBookingModal();
            }}
            onPointerEnter={preloadVillaCardBookingModal}
            onPointerDown={preloadVillaCardBookingModal}
            onFocus={preloadVillaCardBookingModal}
            aria-label={dict.card.availabilityAriaLabel}
            className={
              "w-full inline-flex items-center justify-center gap-2 " +
              "bg-[var(--color-stone-900)] text-white uppercase font-medium " +
              "hover:bg-[var(--color-stone-800)] " +
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-champagne-500)]/40 " +
              "transition-colors duration-200 motion-reduce:transition-none " +
              (isCuration
                ? "h-9 rounded-xl text-[11px] tracking-[0.06em]"
                : "h-11 rounded-2xl text-[12px] tracking-[0.08em]")
            }
          >
            <CalendarRange
              size={isCuration ? 12 : 14}
              strokeWidth={1.75}
              aria-hidden
            />
            {dict.card.availabilityCta}
          </button>
        </div>

        {/* ════════════════════════════════════════════════
            🛡️ FAZ 39K — AMENITY MINI-CARDS (3 luxury pastel)
            ════════════════════════════════════════════════
            Image bloğunun altında, article içinde sabit
            yükseklikli (h-24) 3-col luxury amenity strip.
            Tonlar:
              - Yatak  : coral  (#FBF6EC · #926b27)
              - Banyo  : green  (#EEF8F0 · #1f7a4d)
              - Kişi   : blue   (#FBF6EC · #C8973A)
            Hover: subtle brighten (-translate-y-[1px]).
            CSS soup yok — tek tone map + helper component. */}
        <div
          className={
            "grid grid-cols-3 bg-white " +
            (isCuration ? "gap-1.5 p-2" : "gap-2 p-3")
          }
        >
          <AmenityMini
            tone="coral"
            icon={<BedDouble size={18} strokeWidth={1.6} aria-hidden />}
            value={bedrooms}
            label={dict.card.bedroom}
          />
          <AmenityMini
            tone="green"
            icon={<Bath size={18} strokeWidth={1.6} aria-hidden />}
            value={bathrooms}
            label={dict.card.bathroom}
          />
          <AmenityMini
            tone="blue"
            icon={<Users size={18} strokeWidth={1.6} aria-hidden />}
            value={guests}
            label={dict.card.person}
          />
        </div>
      </article>
      ) : (
      /* ════════════════════════════════════════════════════
         🛡️ PUBLIC KART — "PETROL FİYAT PANELİ" TASARIM SİSTEMİ
         ════════════════════════════════════════════════════
         Tüm public yüzeyler (default variant) ve ana sayfa indirim
         kartı (discount variant) AYNI yapıyı kullanır:
           <article @container>
             ├─ FOTOĞRAF (geniş, üst köşeler kartla bütünleşik)
             │    ├─ sol üst: villa rozeti (koyu cam şerit) +
             │    │           indirim yüzdesi (altın şerit, yalnız discount)
             │    ├─ sağ üst: takvim (müsaitlik modalı) + favori
             │    └─ sol alt: gerçek puan (varsa)
             └─ GÖVDE
                  ├─ BİLGİ: ad · ince çizgi · konum · kişi/oda/banyo
                  │         (+ kısa-süreli tarihlerde rezervasyon aralığı)
                  └─ FİYAT PANELİ (petrol, kavisli sol kenar)
                       fiyat/indirim/toplam/esnek bilgisi + altın CTA
         Kart dar ise (@container < 26rem) panel bilgi alanının ALTINA
         iner (kavisli üst-sol köşe, tam genişlik altın CTA); geniş
         kartta referanstaki gibi sağ tarafta durur.

         MANTIK DEĞİŞMEDİ: tüm değerler yukarıdaki MEVCUT hesaplardan
         (stayTotal / stayTotalBeforeDiscount / stayDiscountSavings /
         convertedPrice / computeDiscountCardPricing) gelir; CTA'lar
         MEVCUT handler'ları çağırır (müsaitlik modalı, reserveInfo
         router.push, discountReserveHref ?? detailHref, privateHref).
         ──────────────────────────────────────────────────── */
      <article
        data-villa-card={isDiscount ? "discount" : "default"}
        className={
          "@container relative flex h-full flex-col overflow-hidden bg-white " +
          "rounded-[22px] border !border-ink/[0.09] " +
          "shadow-[0_18px_40px_-28px_rgba(26,40,56,0.35)] " +
          "group-hover:shadow-[0_30px_60px_-30px_rgba(26,40,56,0.45)] " +
          "transition-[box-shadow,transform] duration-500 motion-reduce:transition-none " +
          "group-hover:-translate-y-[3px] motion-reduce:group-hover:translate-y-0"
        }
      >
        {/* ── FOTOĞRAF ── */}
        <div className="relative aspect-[16/11] @[30rem]:aspect-[16/9] overflow-hidden bg-gradient-to-br from-[var(--color-sand-100)] via-[var(--color-sand-50)] to-[var(--color-sand-100)]">
          {showImage ? (
            <Image
              src={cover}
              alt={title || dict.card.villaAlt}
              fill
              sizes={
                imageSizes ??
                (isDiscount
                  ? "(max-width: 640px) 86vw, 360px"
                  : "(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw")
              }
              loading={isLcp ? "eager" : "lazy"}
              fetchPriority={isLcp ? "high" : undefined}
              onError={() => setImgFailed(true)}
              className="
                object-cover object-center
                transition-transform duration-[1000ms] ease-out
                group-hover:scale-[1.05]
                motion-reduce:transition-none motion-reduce:group-hover:scale-100
              "
            />
          ) : (
            /* PREMIUM FALLBACK — baş harf */
            <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
              <div className="font-display text-[68px] leading-none text-ink/25 tracking-[-0.03em]">
                {initial}
              </div>
              <p className="mt-2 text-[10px] tracking-[0.24em] uppercase font-medium text-[var(--color-stone-400)]">
                {dict.card.imageComing}
              </p>
            </div>
          )}

          {/* Üst vinyet — rozet ve aksiyon okunurluğu */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/[0.28] via-black/[0.06] to-transparent pointer-events-none"
          />

          {/* SOL ÜST — indirim rozeti (yalnız gerçek veri). */}
          {isDiscount && discountBadgePercent !== null && (
            <div className="absolute left-0 top-4 z-10 flex max-w-[calc(100%-6.5rem)] flex-col items-start gap-2">
              {isDiscount && discountBadgePercent !== null && (
                <span
                  className="inline-flex items-center rounded-r-full bg-accent py-1.5 pl-3.5 pr-4 text-[11px] font-bold uppercase tracking-[0.08em] text-ink shadow-[0_8px_18px_-10px_rgba(26,40,56,0.6)]"
                  aria-label={formatDictionaryString(
                    dict.card.discountBadgeAriaLabel,
                    { percent: discountBadgePercent }
                  )}
                >
                  {formatDictionaryString(dict.card.discountBadge, {
                    percent: discountBadgePercent,
                  })}
                </span>
              )}
            </div>
          )}

          {/* SAĞ ÜST — takvim (müsaitlik / tarih seçimi modalı; MEVCUT
              handler) + favori (MEVCUT FavoriteButton, top-4 right-4). */}
          <button
            type="button"
            onClick={openAvailability}
            onPointerEnter={preloadVillaCardBookingModal}
            onPointerDown={preloadVillaCardBookingModal}
            onFocus={preloadVillaCardBookingModal}
            aria-label={dict.card.availabilityAriaLabel}
            title={dict.card.availabilityCta}
            className="absolute top-4 right-[3.75rem] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-[var(--color-stone-700)] shadow-[0_2px_8px_-2px_rgb(27_26_23/0.18)] hover:bg-white transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <CalendarRange size={15} strokeWidth={1.75} aria-hidden />
          </button>
          {id && <FavoriteButton villaId={id} variant="card" alwaysVisible />}

          {/* SOL ALT — gerçek puan (0/undefined → render YOK). */}
          {typeof reviewCount === "number" && reviewCount > 0 &&
            typeof reviewAverage === "number" && reviewAverage > 0 && (
              <div
                className="absolute bottom-3.5 left-3.5 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur-md shadow-[0_4px_14px_-4px_rgba(0,0,0,0.28)]"
                aria-label={formatDictionaryString(dict.card.ratingAriaLabel, {
                  value: reviewAverage.toFixed(1),
                  count: reviewCount,
                })}
              >
                <Star size={11} className="text-accent shrink-0" fill="currentColor" strokeWidth={1.5} aria-hidden />
                <span className="tabular-nums">{reviewAverage.toFixed(1)}</span>
                <span aria-hidden="true" className="text-[var(--color-stone-400)]">·</span>
                <span className="tabular-nums">
                  {formatDictionaryString(dict.card.reviewCount, { n: reviewCount })}
                </span>
              </div>
            )}
        </div>

        {/* ── GÖVDE: bilgi + fiyat paneli ── */}
        <div className="relative flex flex-1 flex-col @[26rem]:flex-row">
          {/* BİLGİ */}
          <div className="min-w-0 flex-1 px-5 pt-4 pb-4 @[26rem]:pb-5">
            <h3 className="font-display text-[19px] @[26rem]:text-[21px] font-bold leading-[1.15] tracking-[-0.02em] text-ink line-clamp-1">
              {title}
            </h3>
            <div aria-hidden="true" className="mt-3 h-px bg-brand/10" />
            <p className="mt-3 flex min-w-0 items-center gap-2 text-[13px] text-[var(--color-stone-700)]">
              <MapPin size={15} className="shrink-0 text-brand" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{location || dict.card.noLocation}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12.5px] text-[var(--color-stone-700)]">
              <span
                className="inline-flex items-center gap-1.5"
                aria-label={formatDictionaryString(dict.card.guestsAriaLabel, { n: guests })}
              >
                <Users size={15} className="text-brand" strokeWidth={1.75} aria-hidden />
                <span className="tabular-nums">
                  {formatDictionaryString(dict.card.guestsValue, { n: guests })}
                </span>
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                aria-label={formatDictionaryString(dict.card.bedroomsAriaLabel, { n: bedrooms })}
              >
                <BedDouble size={15} className="text-brand" strokeWidth={1.75} aria-hidden />
                <span className="tabular-nums">
                  {formatDictionaryString(dict.card.bedroomsValue, { n: bedrooms })}
                </span>
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                aria-label={formatDictionaryString(dict.card.bathroomsAriaLabel, { n: bathrooms })}
              >
                <Bath size={15} className="text-brand" strokeWidth={1.75} aria-hidden />
                <span className="tabular-nums">
                  {formatDictionaryString(dict.card.bathroomsValue, { n: bathrooms })}
                </span>
              </span>
            </div>
            {/* Kısa-süreli tarihler — MEVCUT reserveInfo etiketi. */}
            {reserveInfo && (
              <p className="mt-3 inline-flex rounded-full bg-brand/[0.07] px-3 py-1 text-[12px] font-medium text-ink">
                {reserveInfo.label} ·{" "}
                {formatDictionaryString(dict.card.reserveNights, {
                  n: reserveInfo.nights,
                })}
              </p>
            )}
          </div>

          {/* FİYAT PANELİ — kavisli sol/üst kenar (geniş kartta %41, 140px).
              Fiyat tutarı beyaz; diğer metinler mevcut stilde; panelin
              tamamında 10px üst boşluk. */}
          <div
            data-price-panel
            className="
              relative mt-[10px] flex shrink-0 flex-col items-stretch gap-3.5
              rounded-tl-[44px] bg-brand px-5 pt-4 pb-4 pl-7 text-ink
              @[26rem]:w-[41%] @[26rem]:items-end @[26rem]:justify-center @[26rem]:gap-0
              @[26rem]:rounded-tl-[140px] @[26rem]:pl-8 @[26rem]:pr-5 @[26rem]:py-5 @[26rem]:text-right
            "
          >
            {/* Fiyat bilgisi grubu. */}
            <div data-price-info className="min-w-0">
              {isFlexible ? (
                /* 🛡️ ESNEK EK SONUÇ — fiyat gösterilmez (MEVCUT kural). */
                <>
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
                    <Sparkles size={12} strokeWidth={2} className="text-ink" aria-hidden />
                    {dict.card.flexibleTitle}
                  </p>
                  <p className="mt-1 text-[12px] text-ink/90">{dict.card.flexibleSubtitle}</p>
                </>
              ) : stayTotal !== null ? (
                /* 🛡️ TARİH SEÇİLİ — konaklama TOPLAMI (MEVCUT hesap). */
                <>
                  {stayDateLabel && (
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink/90 tabular-nums">
                      {stayDateLabel}
                    </p>
                  )}
                  {stayTotalBeforeDiscount !== null && (
                    <p className="mt-1 text-[12.5px] text-ink/85 line-through tabular-nums">
                      {formatCurrency(stayTotalBeforeDiscount, currency, effectiveLocale)}
                    </p>
                  )}
                  <p data-price-amount className="font-display text-[24px] @[26rem]:text-[28px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-white">
                    {formatCurrency(stayTotal, currency, effectiveLocale)}
                  </p>
                  {/* "N gece" gösterilmez (tarih üst satırda — MEVCUT karar);
                      "Temizlik dahil" MEVCUT koşuluyla. */}
                  {hasCleaning && (
                    <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink/85">
                      {dict.card.cleaningIncluded}
                    </p>
                  )}
                  {stayDiscountSavings !== null && (
                    <p data-price-savings className="mt-1 text-[12px] font-semibold text-ink tabular-nums">
                      {formatDictionaryString(dict.card.totalSavings, {
                        amount: formatCurrency(stayDiscountSavings, currency, effectiveLocale),
                      })}
                    </p>
                  )}
                </>
              ) : isDiscount && showDiscountPricing ? (
                /* 🛡️ İNDİRİM — computeDiscountCardPricing çıktıları. */
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/90">
                    {dict.card.nightly}
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink/85 line-through tabular-nums">
                    <span className="sr-only">{dict.card.originalPriceLabel}: </span>
                    {formatCurrency(convertedPrice, currency, effectiveLocale)}
                  </p>
                  <p data-price-amount className="font-display text-[24px] @[26rem]:text-[28px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-white">
                    <span className="sr-only">{dict.card.discountedPriceLabel}: </span>
                    {formatCurrency(discountedPrice!.converted, currency, effectiveLocale)}
                  </p>
                  {nightlySavingsLabel && (
                    <p className="mt-1.5 text-[12px] font-semibold text-ink">
                      {nightlySavingsLabel}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-ink/90">{discountDateRangeLabel}</p>
                </>
              ) : price ? (
                /* Tarih seçilmemiş — gecelik başlangıç fiyatı (MEVCUT). */
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/90">
                    {dict.card.nightly}
                  </p>
                  <p data-price-amount className="mt-0.5 font-display text-[24px] @[26rem]:text-[28px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-white">
                    {formatCurrency(convertedPrice, currency, effectiveLocale)}
                  </p>
                  <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink/85">
                    {dict.card.startingFromUpper}
                  </p>
                </>
              ) : (
                <p className="font-display text-[17px] font-bold leading-tight">
                  {dict.card.priceOnRequest}
                </p>
              )}
            </div>

            {/* ALTIN CTA — MEVCUT hedefler:
                  discount  → discountReserveHref ?? detailHref
                  reserveInfo → reserveInfo.href
                  diğer     → müsaitlik/rezervasyon modalı (privateHref → detay) */}
            <button
              type="button"
              onClick={(e) => {
                if (isDiscount && !reserveInfo) {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(discountReserveHref ?? detailHref);
                  return;
                }
                if (reserveInfo) {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(reserveInfo.href);
                  return;
                }
                openAvailability(e);
              }}
              aria-label={isDiscount || reserveInfo ? dict.card.bookNowAriaLabel : undefined}
              onPointerEnter={isDiscount || reserveInfo ? undefined : preloadVillaCardBookingModal}
              onFocus={isDiscount || reserveInfo ? undefined : preloadVillaCardBookingModal}
              className="
                shrink-0 inline-flex w-full items-center justify-center whitespace-nowrap
                h-10 rounded-full bg-white px-5 @[26rem]:mt-4 @[26rem]:w-auto
                text-[12px] font-bold uppercase tracking-[0.1em] text-brand-strong
                shadow-[0_10px_22px_-12px_rgba(0,0,0,0.55)]
                hover:bg-brand-soft transition-colors duration-200 motion-reduce:transition-none
                focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand
              "
            >
              {dict.card.reserve}
            </button>
          </div>
        </div>
      </article>
      )}

    </CardOuter>

    {/* ════════════════════════════════════════════════════
        🛡️ BOOKING MODAL — LAZY MOUNT (Link DIŞINDA)
        ════════════════════════════════════════════════════
        Modal Link'in dışında render edilir → `<a>` içine
        fixed-positioned interactive content nesting'i YOK,
        HTML semantic temiz, screen reader doğru announce.

        Performance:
          - isOpen=false iken VillaCardBookingModal erken-return
            yapar (early null) → engine YOK, fetch YOK, DOM YOK
          - next/dynamic ssr:false → modal bundle parse user
            tıklayana kadar gecikir
          - Modal kendi fixed inset-0 portal-like davranışıyla
            DOM hiyerarşisinden bağımsız render olur
        Erişim:
          - villaId yoksa modal hiç render edilmez (defansif).
            Trigger butonu da id yokken set state'i tetiklerse
            buton görsel olarak çalışır ama modal mount olmaz —
            UX'i bozmaz, sadece açılmaz.
        ──────────────────────────────────────────────────── */}
    {id && isBookingOpen && VillaCardBookingModal && (
      /* Modal artık `prices` / `cleaning_*` prop'larını ALMAZ — kendi
         server-side API çağrısıyla (BookingSidebar ile birebir aynı
         kaynaktan) çeker. Bu drift kapatır: VillaCard caller'ları
         (anasayfa collection, favoriler, /arama-tarihsiz) bu prop'ları
         zaten geçmiyordu → eski implementasyonda engine boş prices
         ile mount oluyor, fiyat 0 görünüyordu. */
      <VillaCardBookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        villaId={id}
        villaSlug={slug}
        villaTitle={title}
        locale={locale}
        /* 🛡️ ADDITIVE — /arama URL'inden gelen konaklama aralığı
           (`stayStart`/`stayEnd`, AramaPageBody'de zaten doğrulanmış)
           modal takviminde SEÇİLİ açılsın. Yalnız İKİSİ de varsa
           geçilir; aksi halde undefined → takvim BOŞ (mevcut davranış).
           Yeni URL parse/tarih hesabı YOK — mevcut prop zinciri. */
        initialStart={stayStart && stayEnd ? stayStart : undefined}
        initialEnd={stayStart && stayEnd ? stayEnd : undefined}
      />
    )}
    </>
  );
}

/* ===============================================================
   🛡️ CARD OUTER WRAPPER — variant-aware
   ===============================================================
   Default variant: <Link> — public detail page navigation aktif.
   Curation variant: <div> — admin "selection workspace" UX'i.
     - href yok → navigation YOK
     - cursor / focus ring YOK (clickable hissi vermez)
     - `group` class yine duruyor → image hover scale (group-hover:scale-[1.04])
       ve overlay scrim hover'ı korunur; sadece kart wrapper'ı interactive
       değil.
=============================================================== */
function CardOuter({
  isCuration,
  href,
  children,
}: {
  isCuration: boolean;
  href: string;
  children: React.ReactNode;
}) {
  if (isCuration) {
    return (
      <div className="block group rounded-[20px]">{children}</div>
    );
  }
  return (
    <Link
      href={href}
      className="
        block group h-full rounded-[22px]
        focus:outline-none focus-visible:ring-2
        focus-visible:ring-brand/45 focus-visible:ring-offset-2
      "
    >
      {children}
    </Link>
  );
}

/* ===============================================================
   🛡️ FAZ 39K — AMENITY MINI-CARD (luxury pastel tile)
   ===============================================================
   3 tone variant — VillaCard bottom strip. Sabit yükseklik (h-24),
   kompakt typography hierarchy: büyük tabular sayı + küçük label.
   No hover scale (cinematic restraint); subtle brighten only.
=============================================================== */
type AmenityTone = "coral" | "green" | "blue";

const AMENITY_TONE: Record<
  AmenityTone,
  { surface: string; icon: string; numText: string; label: string }
> = {
  coral: {
    surface: "bg-[#FBF6EC] group-hover:bg-[#F5EAD3]",
    icon: "text-[#926b27]",
    numText: "text-[#74551f]",
    label: "text-[#b08330]",
  },
  green: {
    surface: "bg-[#EEF8F0] group-hover:bg-[#E2F2E6]",
    icon: "text-[#1f7a4d]",
    numText: "text-[#0f4429]",
    label: "text-[#36805a]",
  },
  blue: {
    surface: "bg-[#EEF5F3] group-hover:bg-[#DCEBE7]",
    icon: "text-[#244c45]",
    numText: "text-[#1c3c36]",
    label: "text-[#2f6b5f]",
  },
};

function AmenityMini({
  tone,
  icon,
  value,
  label,
}: {
  tone: AmenityTone;
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  const t = AMENITY_TONE[tone];
  return (
    <div
      className={
        "h-24 rounded-2xl px-3.5 py-3 flex flex-col justify-between " +
        "transition-colors duration-300 motion-reduce:transition-none " +
        t.surface
      }
    >
      <span className={t.icon}>{icon}</span>
      <div className="leading-none">
        <p
          className={
            "font-display text-[22px] tracking-[-0.015em] tabular-nums " +
            t.numText
          }
        >
          {value}
        </p>
        <p
          className={
            "text-[10.5px] tracking-[0.06em] mt-1 font-medium " + t.label
          }
        >
          {label}
        </p>
      </div>
    </div>
  );
}
